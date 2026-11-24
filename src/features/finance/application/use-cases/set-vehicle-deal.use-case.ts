import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { SetVehicleDealCommand } from '../dtos/set-vehicle-deal-command';
import { toVehicleDealStateDto, type VehicleDealStateDto } from '../dtos/vehicle-deal.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import { dealTermsFor } from '../services/deal-terms-input';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { SellerPaymentGuard } from '../services/seller-payment-guard';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

export const DEAL_PAYMENT_NOTE = 'Paid to the seller, recorded with the deal';

/**
 * Sets the terms agreed with the owner (and optionally the listed price): a
 * purchase rate for a purchase car, a commission % for a commission car
 * (ADR-0017). The sale is untouched.
 *
 * A `sellerPayment` is saved in the same request as a `purchase` expense. It
 * is written first and soft-deleted if the deal save then fails, so a retry
 * can't save it twice. Terms that leave the seller paid above the rate are
 * refused (`SELLER_PAID_ABOVE_RATE`) unless `keepOverpayment` is set.
 */
export class SetVehicleDealUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly clock: Clock,
    private readonly sellerPayments: SellerPaymentGuard,
    private readonly entries: Pick<IFinanceEntryRepository, 'save'>,
    private readonly entrySealer: EntrySealer,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: SetVehicleDealCommand,
    ctx: AuthenticatedContext,
  ): Promise<VehicleDealStateDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findLinkable(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }
    const terms = dealTermsFor(vehicle.saleModel, command);
    const now = this.clock.now();
    const current = await this.sellerPayments.loadDeal(vehicleId, cipher);

    const payment =
      command.sellerPayment == null
        ? null
        : FinanceEntry.create({
            id: toFinanceEntryId(this.ids.generate()),
            kind: 'expense',
            amount: Money.ofPaise(command.sellerPayment.amountPaise),
            entryDate: CalendarDate.create(command.sellerPayment.paidOn),
            purpose: 'purchase',
            tagIds: [],
            vehicleId: vehicle.id,
            showroomId: vehicle.showroomId,
            party: null,
            note: DEAL_PAYMENT_NOTE,
            recordedBy: ctx.userId,
            now,
          });

    // Checked against the stored deal before it is changed below.
    await this.sellerPayments.assertNotOverpaid({
      vehicle,
      cipher,
      terms: current?.terms ?? null,
      nextTerms: terms,
      finalisedPrice: current?.sale?.finalisedPrice ?? null,
      changed: payment === null ? [] : [payment],
      keepOverpayment: command.keepOverpayment ?? false,
    });

    const deal = current ?? VehicleDeal.empty(vehicleId, null, now);
    deal.setTerms(terms, now);
    if (command.listedPricePaise !== undefined) {
      deal.setListedPrice(
        command.listedPricePaise === null ? null : Money.ofPaise(command.listedPricePaise),
        now,
      );
    }

    if (payment !== null) {
      await this.entries.save(this.entrySealer.seal(payment, cipher));
    }
    try {
      await this.deals.save(this.sealer.seal(deal, cipher));
    } catch (err) {
      if (payment !== null) {
        payment.softDelete(this.clock.now());
        await this.entries.save(this.entrySealer.seal(payment, cipher));
      }
      throw err;
    }
    return toVehicleDealStateDto(deal);
  }
}
