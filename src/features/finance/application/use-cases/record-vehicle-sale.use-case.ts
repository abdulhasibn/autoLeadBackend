import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceLeadConversion } from '../../domain/finance-lead-conversion.port';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { RecordVehicleSaleCommand } from '../dtos/record-vehicle-sale-command';
import { toVehicleDealStateDto, type VehicleDealStateDto } from '../dtos/vehicle-deal.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Records the finalised price. A sale always closes against a lead:
 * - car already sold (its lead was converted from the CRM): just the price;
 * - otherwise the buyer's booking-confirmed lead is converted first, which
 *   marks the car sold (ADR-0011), then the price is saved.
 * The conversion runs first so a failed save is finished by repeating the
 * request: the car is sold by then and the price alone is saved.
 */
export class RecordVehicleSaleUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly leadConversion: IFinanceLeadConversion,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly clock: Clock,
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

    if (vehicle.status !== 'sold') {
      if (command.leadId === null) {
        throw new BusinessRuleViolationError(
          'SALE_NEEDS_BOOKED_LEAD',
          'Pick the buyer’s lead: a sale is recorded against a lead whose booking is confirmed',
        );
      }
      await this.leadConversion.convertBookedLead(vehicleId, toLeadId(command.leadId), ctx);
    }

    const now = this.clock.now();
    const sealed = await this.deals.find(vehicleId);
    const deal =
      sealed === null ? VehicleDeal.empty(vehicleId, null, now) : this.sealer.open(sealed, cipher);

    deal.recordSale(finalisedPrice, soldOn, ctx.userId, now);
    await this.deals.save(this.sealer.seal(deal, cipher));
    return toVehicleDealStateDto(deal);
  }
}
