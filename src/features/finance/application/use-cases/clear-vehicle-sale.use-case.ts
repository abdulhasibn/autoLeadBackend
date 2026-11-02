import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/** Removes a sale recorded by mistake. Idempotent. */
export class ClearVehicleSaleUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: { readonly sessionToken: string | null; readonly vehicleId: string },
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const sealed = await this.deals.find(toVehicleId(command.vehicleId));
    if (sealed === null) {
      return;
    }
    const deal = this.sealer.open(sealed, cipher);
    if (deal.sale === null) {
      return;
    }
    deal.clearSale(this.clock.now());
    await this.deals.save(this.sealer.seal(deal, cipher));
  }
}
