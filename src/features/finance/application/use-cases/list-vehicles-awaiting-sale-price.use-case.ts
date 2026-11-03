import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import type { AwaitingSalePriceDto } from '../dtos/vehicle-finance.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Cars marked sold whose finalised price hasn't been recorded yet. */
export class ListVehiclesAwaitingSalePriceUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null },
    ctx: AuthenticatedContext,
  ): Promise<AwaitingSalePriceDto[]> {
    this.policy.requireAdmin(ctx);
    await this.sessions.open(ctx, query.sessionToken);

    return (await this.vehicles.listSoldWithoutSale()).map((car) => ({
      vehicleId: car.id,
      label: car.label,
      soldLeadId: car.soldLeadId,
    }));
  }
}
