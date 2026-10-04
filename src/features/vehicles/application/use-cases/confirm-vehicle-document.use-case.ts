import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { ConfirmVehicleDocumentCommand } from '../dtos/confirm-vehicle-document-command';
import type { VehicleDocumentDto } from '../dtos/vehicle-document.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { toDocumentId } from '../../domain/document-id';
import { DocumentType } from '../../domain/document-type.value-object';
import { SIGNED_READ_TTL_SECONDS, type ObjectStoragePort } from '../../domain/object-storage.port';
import { VehicleDocument } from '../../domain/vehicle-document.entity';
import type { IVehicleDocumentRepository } from '../../domain/vehicle-document.repository';
import { VehicleObjectPath } from '../../domain/vehicle-object-path.value-object';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class ConfirmVehicleDocumentUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly documents: IVehicleDocumentRepository,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: ConfirmVehicleDocumentCommand,
    ctx: AuthenticatedContext,
  ): Promise<VehicleDocumentDto> {
    this.policy.requireStaff(ctx);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    const storagePath = VehicleObjectPath.create(vehicleId, command.storagePath);
    if (!(await this.storage.exists('documents', storagePath.value))) {
      throw new NotFoundError(`Stored object not found for path ${storagePath.value}`);
    }

    const now = this.clock.now();
    const document = VehicleDocument.create({
      id: toDocumentId(this.ids.generate()),
      vehicleId,
      storagePath,
      docType: DocumentType.create(command.docType),
      uploadedBy: ctx.userId,
      uploadedAt: now,
    });
    await this.documents.save(document);

    const signed = await this.storage.createSignedReadUrl({
      kind: 'documents',
      storagePath: storagePath.value,
      expiresInSeconds: SIGNED_READ_TTL_SECONDS,
    });

    return {
      id: document.id,
      vehicleId: document.vehicleId,
      storagePath: document.storagePath.value,
      docType: document.docType.value,
      isSensitive: document.isSensitive,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.uploadedAt.toISOString(),
      url: signed.url,
      urlExpiresAt: new Date(now.getTime() + SIGNED_READ_TTL_SECONDS * 1000).toISOString(),
    };
  }
}
