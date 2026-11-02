import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
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
 * Records the finalised price. Doesn't change the car's status: the vehicles
 * feature owns that (ADR-0006, ADR-0009); the price may be entered first.
 */
export class RecordVehicleSaleUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
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
    if ((await this.vehicles.findLinkable(vehicleId)) === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }
    const now = this.clock.now();
    const sealed = await this.deals.find(vehicleId);
    const deal =
      sealed === null ? VehicleDeal.empty(vehicleId, null, now) : this.sealer.open(sealed, cipher);

    deal.recordSale(
      Money.ofPaise(command.finalisedPricePaise),
      CalendarDate.create(command.soldOn),
      ctx.userId,
      now,
    );
    await this.deals.save(this.sealer.seal(deal, cipher));
    return toVehicleDealStateDto(deal);
  }
}
