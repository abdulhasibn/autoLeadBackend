import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { toDocumentId } from '../../domain/document-id';
import type { ObjectStoragePort } from '../../domain/object-storage.port';
import type { IVehicleDocumentRepository } from '../../domain/vehicle-document.repository';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class DeleteVehicleDocumentUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly documents: IVehicleDocumentRepository,
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(
    vehicleIdRaw: string,
    documentIdRaw: string,
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);

    const vehicle = await this.vehicles.findById(toVehicleId(vehicleIdRaw));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    const document = await this.documents.findById(toDocumentId(documentIdRaw));
    if (document === null || document.vehicleId !== vehicle.id) {
      throw new NotFoundError(`Vehicle document not found for id ${documentIdRaw}`);
    }

    await this.documents.delete(document.id);
    await this.storage.remove('documents', document.storagePath.value);
  }
}
