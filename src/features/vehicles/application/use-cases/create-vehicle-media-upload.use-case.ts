import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { CreateVehicleMediaUploadCommand } from '../dtos/create-vehicle-media-upload-command';
import type { SignedUploadDto } from '../dtos/signed-upload.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { MediaCategory } from '../../domain/media-category.value-object';
import { MediaContentType } from '../../domain/media-content-type.value-object';
import {
  SIGNED_UPLOAD_TTL_SECONDS,
  type ObjectStoragePort,
} from '../../domain/object-storage.port';
import { VehicleObjectPath } from '../../domain/vehicle-object-path.value-object';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class CreateVehicleMediaUploadUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: CreateVehicleMediaUploadCommand,
    ctx: AuthenticatedContext,
  ): Promise<SignedUploadDto> {
    this.policy.requireAdmin(ctx);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    MediaCategory.create(command.category);
    const contentType = MediaContentType.create(command.contentType);
    const storagePath = VehicleObjectPath.compose(
      vehicleId,
      this.ids.generate(),
      contentType.extension,
    );
    const ticket = await this.storage.createSignedUpload({
      kind: 'media',
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
