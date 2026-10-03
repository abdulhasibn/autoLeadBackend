import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { ConfirmVehicleMediaCommand } from '../dtos/confirm-vehicle-media-command';
import type { VehicleMediaDto } from '../dtos/vehicle-media.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { MediaCategory } from '../../domain/media-category.value-object';
import { toMediaId } from '../../domain/media-id';
import { SIGNED_READ_TTL_SECONDS, type ObjectStoragePort } from '../../domain/object-storage.port';
import { VehicleMedia } from '../../domain/vehicle-media.entity';
import type { IVehicleMediaRepository } from '../../domain/vehicle-media.repository';
import { VehicleObjectPath } from '../../domain/vehicle-object-path.value-object';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class ConfirmVehicleMediaUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly media: IVehicleMediaRepository,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: ConfirmVehicleMediaCommand,
    ctx: AuthenticatedContext,
  ): Promise<VehicleMediaDto> {
    this.policy.requireAdmin(ctx);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.vehicles.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    const storagePath = VehicleObjectPath.create(vehicleId, command.storagePath);
    if (!(await this.storage.exists('media', storagePath.value))) {
      throw new NotFoundError(`Stored object not found for path ${storagePath.value}`);
    }

    const now = this.clock.now();
    const media = VehicleMedia.create({
      id: toMediaId(this.ids.generate()),
      vehicleId,
      storagePath,
      category: MediaCategory.create(command.category),
      sortOrder: command.sortOrder,
      uploadedBy: ctx.userId,
      uploadedAt: now,
    });
    await this.media.save(media);

    const signed = await this.storage.createSignedReadUrl({
      kind: 'media',
      storagePath: storagePath.value,
      expiresInSeconds: SIGNED_READ_TTL_SECONDS,
    });

    return {
      id: media.id,
      vehicleId: media.vehicleId,
      storagePath: media.storagePath.value,
      category: media.category.value,
      sortOrder: media.sortOrder,
      uploadedBy: media.uploadedBy,
      uploadedAt: media.uploadedAt.toISOString(),
      url: signed.url,
      urlExpiresAt: new Date(now.getTime() + SIGNED_READ_TTL_SECONDS * 1000).toISOString(),
    };
  }
}
