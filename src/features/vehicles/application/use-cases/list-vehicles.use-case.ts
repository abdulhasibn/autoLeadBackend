import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import type { Page } from '../../../../shared/pagination/pagination';
import type { ListVehiclesQuery } from '../dtos/list-vehicles-query';
import type { VehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { IVehicleQueries } from '../../domain/vehicle.queries';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';

export class ListVehiclesUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: IVehicleQueries,
  ) {}

  async execute(query: ListVehiclesQuery, ctx: AuthenticatedContext): Promise<Page<VehicleDto>> {
    this.policy.requireStaff(ctx);

    return this.queries.listVehicles(
      {
        status: query.status === undefined ? undefined : VehicleStatus.create(query.status).value,
        ownerId: query.ownerId === undefined ? undefined : toOwnerId(query.ownerId),
        showroomId: query.showroomId === undefined ? undefined : toShowroomId(query.showroomId),
        registration:
          query.registration === undefined
            ? undefined
            : RegistrationNumber.create(query.registration).value,
      },
      query.page,
    );
  }
}
