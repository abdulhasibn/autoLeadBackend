import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { resolveShowroomId } from '../../../../domain/shared/resolve-showroom';
import type { ShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { assertTagsUsable } from '../../domain/finance-tag-rules';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
} from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import { hasDealTerms, isSellerPayment } from '../../domain/vehicle-money';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { CreateFinanceEntryCommand } from '../dtos/create-finance-entry-command';
import { toFinanceEntryDto, type FinanceEntryDto } from '../dtos/finance-entry.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { SaleIncomeGuard } from '../services/sale-income-guard';
import { dealTermsFor } from '../services/deal-terms-input';
import type { SellerPaymentGuard } from '../services/seller-payment-guard';
import type { TagSealer } from '../services/tag.sealer';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Records money in or out. With a car it lands in the car's showroom with the
 * car's default purpose; without one it's a business entry. Money from a
 * buyer on a car with no buyer is refused (`SALE_NOT_RECORDED`).
 *
 * A payment to the seller needs the car's deal terms: sent as `deal` when
 * the car has none, they're saved with it (`DEAL_TERMS_REQUIRED` otherwise).
 * The entry is written first and soft-deleted if the deal save fails. Paying
 * the seller above the rate is refused (`SELLER_PAID_ABOVE_RATE`) unless
 * `keepOverpayment` is set.
 */
export class CreateFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryRepository,
    private readonly tags: IFinanceTagRepository,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly entrySealer: EntrySealer,
    private readonly tagSealer: TagSealer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly saleIncome: SaleIncomeGuard,
    private readonly sellerPayments: SellerPaymentGuard,
    private readonly deals: Pick<IVehicleDealRepository, 'save'>,
    private readonly dealSealer: VehicleDealSealer,
  ) {}

  async execute(
    command: CreateFinanceEntryCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const tagIds = command.tagIds.map(toFinanceTagId);
    const tags = this.tagSealer.openAll(await this.tags.findByIds(tagIds), cipher);
    const tagsById = new Map(tags.map((tag) => [tag.id as string, tag]));
    assertTagsUsable(tagIds, [], tagsById);

    let vehicle: FinanceVehicleFacts | null = null;
    let showroomId: ShowroomId;
    if (command.vehicleId === null) {
      showroomId = resolveShowroomId(ctx, command.showroomId);
    } else {
      vehicle = await this.vehicles.findLinkable(toVehicleId(command.vehicleId));
      if (vehicle === null) {
        throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
      }
      if (command.showroomId !== null && command.showroomId !== vehicle.showroomId) {
        throw new BusinessRuleViolationError(
          'ENTRY_SHOWROOM_FOLLOWS_VEHICLE',
          "A car-linked entry belongs to the car's showroom",
        );
      }
      showroomId = vehicle.showroomId;
    }

    const entry = FinanceEntry.create({
      id: toFinanceEntryId(this.ids.generate()),
      kind: command.kind,
      amount: Money.ofPaise(command.amountPaise),
      entryDate: CalendarDate.create(command.entryDate),
      purpose: command.purpose,
      tagIds,
      vehicleId: vehicle?.id ?? null,
      showroomId,
      party: command.party,
      note: command.note,
      recordedBy: ctx.userId,
      now: this.clock.now(),
    });
    await this.saleIncome.assertAllowed(entry, vehicle);
    const newDeal =
      vehicle !== null && isSellerPayment(entry)
        ? await this.checkSellerPayment(entry, vehicle, command, cipher)
        : null;

    await this.entries.save(this.entrySealer.seal(entry, cipher));
    if (newDeal !== null) {
      try {
        await this.deals.save(this.dealSealer.seal(newDeal, cipher));
      } catch (err) {
        entry.softDelete(this.clock.now());
        await this.entries.save(this.entrySealer.seal(entry, cipher));
        throw err;
      }
    }

    const vehiclesById = new Map(vehicle === null ? [] : [[vehicle.id as string, vehicle]]);
    return toFinanceEntryDto(entry, tagsById, vehiclesById);
  }

  /** Returns the deal to save with the entry when `deal` supplies missing terms. */
  private async checkSellerPayment(
    entry: FinanceEntry,
    vehicle: FinanceVehicleFacts,
    command: CreateFinanceEntryCommand,
    cipher: FinanceCipher,
  ): Promise<VehicleDeal | null> {
    const current = await this.sellerPayments.loadDeal(vehicle.id, cipher);
    const terms = current?.terms ?? null;
    const finalisedPrice = current?.sale?.finalisedPrice ?? null;
    let newDeal: VehicleDeal | null = null;
    if (!hasDealTerms(vehicle.saleModel, terms) && command.deal != null) {
      newDeal = current ?? VehicleDeal.empty(vehicle.id, null, this.clock.now());
      newDeal.setTerms(dealTermsFor(vehicle.saleModel, command.deal), this.clock.now());
    }
    const nextTerms = newDeal?.terms ?? terms;
    this.sellerPayments.assertTerms(vehicle, nextTerms);
    await this.sellerPayments.assertNotOverpaid({
      vehicle,
      cipher,
      terms,
      nextTerms,
      finalisedPrice,
      changed: [entry],
      keepOverpayment: command.keepOverpayment ?? false,
    });
    return newDeal;
  }
}
