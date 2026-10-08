import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { SearchTerm } from '../../../../domain/shared/search-term.value-object';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import type { Page } from '../../../../shared/pagination/pagination';
import { toPage } from '../../../../shared/pagination/pagination';
import type { ListVehiclesQuery } from '../dtos/list-vehicles-query';
import type { VehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { VehicleFrontImages } from '../services/vehicle-front-images';
import { FuelType } from '../../domain/fuel-type.value-object';
import { toMakeId } from '../../domain/make-id';
import { toModelId } from '../../domain/model-id';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { Transmission } from '../../domain/transmission.value-object';
import { toVariantId } from '../../domain/variant-id';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { ILinkedLeadCounts } from '../../domain/linked-lead-counts.port';
import type { IVehicleQueries } from '../../domain/vehicle.queries';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';

export class ListVehiclesUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: IVehicleQueries,
    private readonly frontImages: VehicleFrontImages,
    private readonly leadCounts: ILinkedLeadCounts,
  ) {}

  async execute(query: ListVehiclesQuery, ctx: AuthenticatedContext): Promise<Page<VehicleDto>> {
    this.policy.requireStaff(ctx);

    const result = await this.queries.listVehicles(
      {
        status: query.status === undefined ? undefined : VehicleStatus.create(query.status).value,
        ownerId: query.ownerId === undefined ? undefined : toOwnerId(query.ownerId),
        showroomId: query.showroomId === undefined ? undefined : toShowroomId(query.showroomId),
        registration:
          query.registration === undefined
            ? undefined
            : RegistrationNumber.create(query.registration).value,
        search: query.search === undefined ? undefined : SearchTerm.create(query.search),
        makeId: query.makeId === undefined ? undefined : toMakeId(query.makeId),
        modelId: query.modelId === undefined ? undefined : toModelId(query.modelId),
        variantId: query.variantId === undefined ? undefined : toVariantId(query.variantId),
        yearMin: query.yearMin,
        yearMax: query.yearMax,
        kmMin: query.kmMin,
        kmMax: query.kmMax,
        fuelTypes: query.fuelTypes?.map((value) => FuelType.create(value).value),
        transmissions: query.transmissions?.map((value) => Transmission.create(value).value),
      },
      query.page,
    );

    const [withImages, leadCounts] = await Promise.all([
      this.frontImages.attach(result.items),
      this.leadCounts.countActiveByVehicles(result.items.map((item) => toVehicleId(item.id))),
    ]);
    const items = withImages.map((vehicle) => ({
      ...vehicle,
      linkedLeadCount: leadCounts.get(toVehicleId(vehicle.id)) ?? 0,
    }));
    return toPage(items, result.total, query.page);
  }
}
