import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { SetVehicleDealCommand } from '../dtos/set-vehicle-deal-command';
import { toVehicleDealStateDto, type VehicleDealStateDto } from '../dtos/vehicle-deal.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Sets the terms agreed with the owner (and optionally the listed price): a
 * purchase rate for a purchase car, a commission % for a commission car
 * (ADR-0017). The sale is untouched.
 */
export class SetVehicleDealUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly clock: Clock,
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
    const commission = vehicle.saleModel === 'commission';
    if (commission ? command.commissionBasisPoints === null : command.purchaseRatePaise === null) {
      throw new BusinessRuleViolationError(
        'INVALID_DEAL_TERMS',
        commission
          ? 'This car is sold for a commission: set commissionPercent'
          : 'This car is bought outright: set purchaseRate',
      );
    }
    const now = this.clock.now();
    const sealed = await this.deals.find(vehicleId);
    const deal =
      sealed === null ? VehicleDeal.empty(vehicleId, null, now) : this.sealer.open(sealed, cipher);

    deal.setTerms(
      {
        purchaseRate:
          commission || command.purchaseRatePaise === null
            ? null
            : Money.ofPaise(command.purchaseRatePaise),
        commissionBasisPoints: commission ? command.commissionBasisPoints : null,
        purchasedOn: command.purchasedOn === null ? null : CalendarDate.create(command.purchasedOn),
        ownerExpectedPrice:
          command.ownerExpectedPricePaise === null
            ? null
            : Money.ofPaise(command.ownerExpectedPricePaise),
        minimumSellingPrice:
          command.minimumSellingPricePaise === null
            ? null
            : Money.ofPaise(command.minimumSellingPricePaise),
        note: command.note,
      },
      now,
    );
    if (command.listedPricePaise !== undefined) {
      deal.setListedPrice(
        command.listedPricePaise === null ? null : Money.ofPaise(command.listedPricePaise),
        now,
      );
    }

    await this.deals.save(this.sealer.seal(deal, cipher));
    return toVehicleDealStateDto(deal);
  }
}
