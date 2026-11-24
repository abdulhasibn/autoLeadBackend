import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { assertTagsUsable } from '../../domain/finance-tag-rules';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
} from '../../domain/finance-vehicle-lookup.port';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import { hasDealTerms, isSellerPayment } from '../../domain/vehicle-money';
import { Money } from '../../domain/money.value-object';
import { toFinanceEntryDto, type FinanceEntryDto } from '../dtos/finance-entry.dto';
import type { UpdateFinanceEntryCommand } from '../dtos/update-finance-entry-command';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import { leadsOfEntries } from '../services/entry-leads';
import type { RefundGuard } from '../services/refund-guard';
import type { SaleIncomeGuard } from '../services/sale-income-guard';
import { dealTermsFor } from '../services/deal-terms-input';
import type { SellerPaymentGuard } from '../services/seller-payment-guard';
import type { TagSealer } from '../services/tag.sealer';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Edits an entry. Sending `vehicleId` links, moves or (with null) unlinks it;
 * the purpose then resets to the default unless `purpose` is sent too.
 * Linking or turning an entry into money from a buyer on a car with no buyer
 * is refused (`SALE_NOT_RECORDED`); edits that keep the car and purpose are not.
 *
 * Turning an entry into a payment to a car's seller needs the car's deal
 * terms (`DEAL_TERMS_REQUIRED`, or send them as `deal`); editing an existing
 * payment does not. Any edit that pays the seller beyond what they're owed is
 * refused (`SELLER_PAID_ABOVE_RATE`) unless `keepOverpayment` is set. If the
 * deal save fails after the entry is saved, the entry is put back.
 */
export class UpdateFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryRepository,
    private readonly tags: IFinanceTagRepository,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly entrySealer: EntrySealer,
    private readonly tagSealer: TagSealer,
    private readonly clock: Clock,
    private readonly saleIncome: SaleIncomeGuard,
    private readonly sellerPayments: SellerPaymentGuard,
    private readonly deals: Pick<IVehicleDealRepository, 'save'>,
    private readonly dealSealer: VehicleDealSealer,
    private readonly refunds: RefundGuard,
    private readonly leads: Pick<IFinanceLeadLookup, 'findMany'>,
  ) {}

  async execute(
    command: UpdateFinanceEntryCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const sealed = await this.entries.findById(toFinanceEntryId(command.entryId));
    if (sealed === null) {
      throw new NotFoundError(`Finance entry not found for id ${command.entryId}`);
    }
    const entry = this.entrySealer.open(sealed, cipher);
    this.entrySealer.assertWritable(entry);
    const paidSellerOf = isSellerPayment(entry) ? entry.vehicleId : null;
    const now = this.clock.now();
    const before = {
      vehicleId: entry.vehicleId,
      purpose: entry.purpose,
      amountPaise: entry.amount.paise,
    };

    if (command.amountPaise !== undefined) {
      entry.changeAmount(Money.ofPaise(command.amountPaise), now);
    }
    if (command.entryDate !== undefined) {
      entry.changeDate(CalendarDate.create(command.entryDate), now);
    }
    if (command.party !== undefined) {
      entry.changeParty(command.party, now);
    }
    if (command.note !== undefined) {
      entry.changeNote(command.note, now);
    }

    let vehicle: FinanceVehicleFacts | null = null;
    if (command.vehicleId === null) {
      entry.unlink(
        command.showroomId === undefined ? entry.showroomId : toShowroomId(command.showroomId),
        now,
      );
      if (command.purpose !== undefined) {
        entry.changePurpose(command.purpose, now);
      }
    } else if (command.vehicleId !== undefined) {
      vehicle = await this.vehicles.findLinkable(toVehicleId(command.vehicleId));
      if (vehicle === null) {
        throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
      }
      const carriedLead =
        command.leadId !== undefined
          ? command.leadId === null
            ? null
            : toLeadId(command.leadId)
          : command.keepLead === true
            ? entry.leadId
            : undefined;
      entry.linkToVehicle(
        vehicle.id,
        vehicle.showroomId,
        command.purpose ?? null,
        now,
        carriedLead,
      );
      if (command.showroomId !== undefined) {
        entry.moveToShowroom(toShowroomId(command.showroomId), now);
      }
    } else {
      if (command.purpose !== undefined) {
        entry.changePurpose(command.purpose, now);
      }
      if (command.showroomId !== undefined) {
        entry.moveToShowroom(toShowroomId(command.showroomId), now);
      }
      if (entry.vehicleId !== null) {
        [vehicle = null] = await this.vehicles.findMany([entry.vehicleId]);
      }
    }
    await this.attributeLead(entry, vehicle, before, command, cipher, now);

    const nextTagIds = command.tagIds?.map(toFinanceTagId) ?? entry.tagIds;
    const tags = this.tagSealer.openAll(await this.tags.findByIds(nextTagIds), cipher);
    const tagsById = new Map(tags.map((tag) => [tag.id as string, tag]));
    if (command.tagIds !== undefined) {
      assertTagsUsable(nextTagIds, entry.tagIds, tagsById);
      entry.retag(nextTagIds, now);
    }

    const newDeal = isSellerPayment(entry)
      ? await this.checkSellerPayment(entry, paidSellerOf, command, cipher)
      : null;

    await this.entries.save(this.entrySealer.seal(entry, cipher));
    if (newDeal !== null) {
      try {
        await this.deals.save(this.dealSealer.seal(newDeal, cipher));
      } catch (err) {
        await this.entries.save(sealed);
        throw err;
      }
    }

    const vehicles =
      entry.vehicleId === null ? [] : await this.vehicles.findMany([entry.vehicleId]);
    return toFinanceEntryDto(
      entry,
      tagsById,
      new Map(vehicles.map((v) => [v.id as string, v])),
      await leadsOfEntries(this.leads, [entry]),
    );
  }

  /**
   * Puts a `sale` / `refund` entry on its lead (BE-77 §4.2-4.3). A new buyer
   * payment or refund (car, purpose or lead changed) gets the create rules; an
   * edit that keeps car, purpose and lead is not re-checked, except that a
   * refund must still fit what the lead paid. A change of lead alone accepts
   * any existing lead.
   */
  private async attributeLead(
    entry: FinanceEntry,
    vehicle: FinanceVehicleFacts | null,
    before: {
      readonly vehicleId: string | null;
      readonly purpose: string;
      readonly amountPaise: number;
    },
    command: UpdateFinanceEntryCommand,
    cipher: FinanceCipher,
    now: Date,
  ): Promise<void> {
    if (vehicle === null || (entry.purpose !== 'sale' && entry.purpose !== 'refund')) {
      return;
    }
    const requested =
      command.leadId === undefined
        ? entry.leadId
        : command.leadId === null
          ? null
          : toLeadId(command.leadId);
    const moved = before.vehicleId !== entry.vehicleId;
    const created = moved || before.purpose !== entry.purpose;
    if (entry.purpose === 'sale') {
      if (created) {
        await this.saleIncome.attribute(
          entry,
          vehicle,
          {
            leadId: requested,
            accepts: moved && before.vehicleId !== null ? 'on-car' : 'current-buyers',
          },
          now,
        );
      } else if (command.leadId !== undefined) {
        if (requested !== null) await this.saleIncome.assertLeadExists(requested);
        entry.assignLead(requested, now);
      }
      return;
    }
    const raised = entry.amount.paise > before.amountPaise;
    if (created || command.leadId !== undefined || raised) {
      if (!created && command.leadId !== undefined && requested !== null) {
        await this.saleIncome.assertLeadExists(requested);
      }
      await this.refunds.attribute(entry, vehicle, requested, cipher, now);
    }
  }

  /** Returns the deal to save with the entry when `deal` supplies missing terms. */
  private async checkSellerPayment(
    entry: FinanceEntry,
    paidSellerOf: string | null,
    command: UpdateFinanceEntryCommand,
    cipher: FinanceCipher,
  ): Promise<VehicleDeal | null> {
    const vehicleId = entry.vehicleId;
    if (vehicleId === null) return null;
    const [vehicle]: readonly (FinanceVehicleFacts | undefined)[] = await this.vehicles.findMany([
      vehicleId,
    ]);
    if (vehicle === undefined) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleId}`);
    }
    const current = await this.sellerPayments.loadDeal(vehicle.id, cipher);
    const terms = current?.terms ?? null;
    let newDeal: VehicleDeal | null = null;
    if (!hasDealTerms(vehicle.saleModel, terms) && command.deal != null) {
      newDeal = current ?? VehicleDeal.empty(vehicle.id, null, this.clock.now());
      newDeal.setTerms(dealTermsFor(vehicle.saleModel, command.deal), this.clock.now());
    }
    const nextTerms = newDeal?.terms ?? terms;
    if (paidSellerOf !== vehicleId) {
      this.sellerPayments.assertTerms(vehicle, nextTerms);
    }
    await this.sellerPayments.assertNotOverpaid({
      vehicle,
      cipher,
      terms,
      nextTerms,
      finalisedPrice: current?.sale?.finalisedPrice ?? null,
      changed: [entry],
      keepOverpayment: command.keepOverpayment ?? false,
    });
    return newDeal;
  }
}
