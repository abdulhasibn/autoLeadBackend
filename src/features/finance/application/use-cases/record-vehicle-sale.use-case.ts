import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toLeadId, type LeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { SealedFinanceEntry } from '../../domain/sealed-finance-records';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import type { IFinanceLeadConversion } from '../../domain/finance-lead-conversion.port';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { VehicleMoneyTally } from '../../domain/vehicle-money';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { RecordVehicleSaleCommand } from '../dtos/record-vehicle-sale-command';
import { toVehicleDealStateDto, type VehicleDealStateDto } from '../dtos/vehicle-deal.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Records the finalised price. A sale always closes against a lead:
 * - car already sold (its lead was converted from the CRM): just the price;
 * - otherwise the buyer's booking-confirmed lead is converted first, which
 *   marks the car sold (ADR-0011), then the price is saved.
 * The conversion runs first so a failed save is finished by repeating the
 * request: the car is sold by then and the price alone is saved.
 *
 * A price below what the sale's lead has already paid (net of refunds, plus the
 * `buyerPayment`) is refused (`SALE_PRICE_BELOW_RECEIVED`): another lead's
 * money on the car never counts (BE-77 §4.6). The sale's lead is `leadId`, or
 * the car's sold lead once it is sold. Unless `keepOverpayment` says the buyer really
 * overpaid, so a lowered price can't leave a phantom overpayment (#31). The
 * check runs before the lead is converted: a refused request changes nothing.
 * With `buyerPayments: "adjust"` the lead's earlier payments are cut down to fit
 * instead (newest first), and put back if the sale then fails.
 *
 * A `buyerPayment` is saved as a `sale` income entry in the same request
 * (#32, #33). It is written before the lead is converted, and soft-deleted if
 * the conversion or the price save then fails, so a sale's payment never
 * outlives a failed sale and a repeated request can't save it twice.
 */
export const SALE_PAYMENT_NOTE = 'Received from the buyer when the sale was recorded';

export class RecordVehicleSaleUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly leadConversion: IFinanceLeadConversion,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly entries: Pick<IFinanceEntryQueries, 'scan'>,
    private readonly entrySealer: EntrySealer,
    private readonly clock: Clock,
    private readonly entryRepo: Pick<IFinanceEntryRepository, 'save'>,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: RecordVehicleSaleCommand,
    ctx: AuthenticatedContext,
  ): Promise<VehicleDealStateDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findLinkable(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }
    // Validate the price on a scratch deal before converting anything.
    const finalisedPrice = Money.ofPaise(command.finalisedPricePaise);
    const soldOn = CalendarDate.create(command.soldOn);
    VehicleDeal.empty(vehicleId, null, this.clock.now()).recordSale(
      finalisedPrice,
      soldOn,
      ctx.userId,
      this.clock.now(),
    );

    const payment = command.buyerPayment ?? null;
    const paymentDate = payment === null ? null : CalendarDate.create(payment.paidOn);
    const saleLeadId: LeadId | null =
      vehicle.status === 'sold'
        ? vehicle.soldLeadId
        : command.leadId === null
          ? null
          : toLeadId(command.leadId);
    const mine = await this.leadPayments(vehicle, saleLeadId, cipher);
    const incoming = payment?.amountPaise ?? 0;
    let trimmed: TrimmedPayment[] = [];
    if (mine.net + incoming > finalisedPrice.paise) {
      if (command.buyerPayments === 'adjust') {
        trimmed = planTrim(mine.sale, mine.net + incoming - finalisedPrice.paise);
      }
      const cut = trimmed.reduce((t, p) => t + (p.entry.amount.paise - p.keepPaise), 0);
      const left = mine.net + incoming - cut;
      if (left > finalisedPrice.paise && !command.keepOverpayment) {
        throw new BusinessRuleViolationError(
          'SALE_PRICE_BELOW_RECEIVED',
          'The buyer has already paid more than this price: reduce their payments first, or keep the overpayment',
          {
            receivedFromBuyer: left / 100,
            finalisedPrice: finalisedPrice.paise / 100,
          },
        );
      }
    }

    if (vehicle.status !== 'sold' && command.leadId === null) {
      throw new BusinessRuleViolationError(
        'SALE_NEEDS_BOOKED_LEAD',
        'Pick the buyer’s lead: a sale is recorded against a lead whose booking is confirmed',
      );
    }

    const restore = await this.applyTrim(trimmed, cipher);
    let paymentEntry: FinanceEntry | null = null;
    try {
      paymentEntry =
        payment === null || paymentDate === null
          ? null
          : await this.savePayment(
              vehicle,
              payment.amountPaise,
              paymentDate,
              saleLeadId,
              cipher,
              ctx,
            );
    } catch (err) {
      await this.putBack(restore);
      throw err;
    }

    try {
      if (vehicle.status !== 'sold' && command.leadId !== null) {
        await this.leadConversion.convertBookedLead(vehicleId, toLeadId(command.leadId), ctx);
      }

      const now = this.clock.now();
      const sealed = await this.deals.find(vehicleId);
      const deal =
        sealed === null
          ? VehicleDeal.empty(vehicleId, null, now)
          : this.sealer.open(sealed, cipher);

      deal.recordSale(finalisedPrice, soldOn, ctx.userId, now);
      await this.deals.save(this.sealer.seal(deal, cipher));
      return toVehicleDealStateDto(deal);
    } catch (err) {
      if (paymentEntry !== null) {
        paymentEntry.softDelete(this.clock.now());
        await this.entryRepo.save(this.entrySealer.seal(paymentEntry, cipher));
      }
      await this.putBack(restore);
      throw err;
    }
  }

  /**
   * The sale lead's `sale` entries (on a sold car also the unassigned ones,
   * which count as theirs) and their net after refunds.
   */
  private async leadPayments(
    vehicle: FinanceVehicleFacts,
    leadId: LeadId | null,
    cipher: FinanceCipher,
  ): Promise<{ net: number; sale: PaymentRow[] }> {
    const tally = new VehicleMoneyTally();
    const sale: PaymentRow[] = [];
    const carSold = vehicle.status === 'sold';
    for await (const page of this.entries.scan({ vehicleId: vehicle.id })) {
      for (const row of page) {
        const entry = this.entrySealer.open(row, cipher);
        tally.add(entry);
        const theirs = entry.leadId === leadId || (carSold && entry.leadId === null);
        if (entry.purpose === 'sale' && theirs) sale.push({ entry, row });
      }
    }
    const nets = tally.netByLead({
      carSold,
      soldLeadId: carSold ? leadId : null,
      bookedLeadIds: [],
    });
    return { net: nets.get(leadId ?? '') ?? 0, sale };
  }

  private async putBack(rows: readonly SealedFinanceEntry[]): Promise<void> {
    for (const row of rows) await this.entryRepo.save(row);
  }

  /** Writes the trimmed amounts; returns the stored rows to put back if the sale then fails. */
  private async applyTrim(
    trimmed: readonly TrimmedPayment[],
    cipher: FinanceCipher,
  ): Promise<SealedFinanceEntry[]> {
    const now = this.clock.now();
    const originals: SealedFinanceEntry[] = [];
    for (const { entry, row, keepPaise } of trimmed) {
      originals.push(row);
      if (keepPaise === 0) entry.softDelete(now);
      else entry.changeAmount(Money.ofPaise(keepPaise), now);
      await this.entryRepo.save(this.entrySealer.seal(entry, cipher));
    }
    return originals;
  }

  private async savePayment(
    vehicle: FinanceVehicleFacts,
    amountPaise: number,
    paidOn: CalendarDate,
    leadId: LeadId | null,
    cipher: FinanceCipher,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntry> {
    const entry = FinanceEntry.create({
      id: toFinanceEntryId(this.ids.generate()),
      kind: 'income',
      amount: Money.ofPaise(amountPaise),
      entryDate: paidOn,
      purpose: 'sale',
      tagIds: [],
      vehicleId: vehicle.id,
      leadId,
      showroomId: vehicle.showroomId,
      party: null,
      note: SALE_PAYMENT_NOTE,
      recordedBy: ctx.userId,
      now: this.clock.now(),
    });
    await this.entryRepo.save(this.entrySealer.seal(entry, cipher));
    return entry;
  }
}

interface PaymentRow {
  readonly entry: FinanceEntry;
  readonly row: SealedFinanceEntry;
}

interface TrimmedPayment extends PaymentRow {
  /** Paise left on the entry; 0 removes it. */
  readonly keepPaise: number;
}

/** Cuts `excess` paise off the payments, newest first. */
function planTrim(payments: readonly PaymentRow[], excess: number): TrimmedPayment[] {
  const newestFirst = [...payments].sort(
    (a, b) =>
      b.entry.entryDate.value.localeCompare(a.entry.entryDate.value) ||
      b.entry.createdAt.getTime() - a.entry.createdAt.getTime(),
  );
  const plan: TrimmedPayment[] = [];
  let left = excess;
  for (const payment of newestFirst) {
    if (left <= 0) break;
    const paise = payment.entry.amount.paise;
    plan.push({ ...payment, keepPaise: Math.max(paise - left, 0) });
    left -= paise;
  }
  return plan;
}
