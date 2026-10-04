import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { IVehicleQueries } from '../../domain/vehicle.queries';
import type {
  IVehicleStatusHistoryQueries,
  VehicleStatusHistoryReadModel,
} from '../../domain/vehicle-status-history.queries';

export class ListVehicleStatusHistoryUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicleQueries: IVehicleQueries,
    private readonly historyQueries: IVehicleStatusHistoryQueries,
  ) {}

  async execute(
    vehicleIdRaw: string,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<VehicleStatusHistoryReadModel>> {
    this.policy.requireStaff(ctx);

    const vehicleId = toVehicleId(vehicleIdRaw);
    const vehicle = await this.vehicleQueries.getVehicle(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    return this.historyQueries.listByVehicle(vehicleId, page);
  }
}
