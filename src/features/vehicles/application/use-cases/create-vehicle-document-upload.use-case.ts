import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { CreateVehicleDocumentUploadCommand } from '../dtos/create-vehicle-document-upload-command';
import type { SignedUploadDto } from '../dtos/signed-upload.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { DocumentContentType } from '../../domain/document-content-type.value-object';
import { DocumentType } from '../../domain/document-type.value-object';
import {
  SIGNED_UPLOAD_TTL_SECONDS,
  type ObjectStoragePort,
} from '../../domain/object-storage.port';
import { VehicleObjectPath } from '../../domain/vehicle-object-path.value-object';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class CreateVehicleDocumentUploadUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: CreateVehicleDocumentUploadCommand,
    ctx: AuthenticatedContext,
  ): Promise<SignedUploadDto> {
    this.policy.requireAdmin(ctx);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    DocumentType.create(command.docType);
    const contentType = DocumentContentType.create(command.contentType);
    const storagePath = VehicleObjectPath.compose(
      vehicleId,
      this.ids.generate(),
      contentType.extension,
    );
    const ticket = await this.storage.createSignedUpload({
      kind: 'documents',
      storagePath: storagePath.value,
      expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS,
    });

    return {
      storagePath: storagePath.value,
      uploadUrl: ticket.uploadUrl,
      token: ticket.token,
      expiresAt: new Date(
        this.clock.now().getTime() + SIGNED_UPLOAD_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }
}
