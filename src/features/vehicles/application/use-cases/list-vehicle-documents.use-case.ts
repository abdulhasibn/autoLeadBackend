import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import { toPage } from '../../../../shared/pagination/pagination';
import type { VehicleDocumentDto } from '../dtos/vehicle-document.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { SIGNED_READ_TTL_SECONDS, type ObjectStoragePort } from '../../domain/object-storage.port';
import type { IVehicleDocumentQueries } from '../../domain/vehicle-document.queries';
import type { IVehicleQueries } from '../../domain/vehicle.queries';

export class ListVehicleDocumentsUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicleQueries: IVehicleQueries,
    private readonly documentQueries: IVehicleDocumentQueries,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
  ) {}

  async execute(
    vehicleIdRaw: string,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<VehicleDocumentDto>> {
    this.policy.requireStaff(ctx);

    const vehicleId = toVehicleId(vehicleIdRaw);
    const vehicle = await this.vehicleQueries.getVehicle(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    const result = await this.documentQueries.listByVehicle(vehicleId, page);
    const expiresAt = new Date(
      this.clock.now().getTime() + SIGNED_READ_TTL_SECONDS * 1000,
    ).toISOString();
    const items = await Promise.all(
      result.items.map(async (item) => {
        const signed = await this.storage.createSignedReadUrl({
          kind: 'documents',
          storagePath: item.storagePath,
          expiresInSeconds: SIGNED_READ_TTL_SECONDS,
        });
        return { ...item, url: signed.url, urlExpiresAt: expiresAt };
      }),
    );

    return toPage(items, result.total, page);
  }
}
