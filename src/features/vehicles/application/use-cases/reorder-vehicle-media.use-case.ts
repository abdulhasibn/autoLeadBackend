import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { MediaCategory } from '../../domain/media-category.value-object';
import { toMediaId } from '../../domain/media-id';
import type { VehicleMedia } from '../../domain/vehicle-media.entity';
import type { IVehicleMediaRepository } from '../../domain/vehicle-media.repository';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export interface MediaPlacement {
  readonly id: string;
  readonly category: string;
  readonly sortOrder: number;
}

/**
 * Moves photos between angle slots / positions (drag-and-swap in the CRM).
 * Every photo is checked before any is written, so a bad id changes nothing.
 */
export class ReorderVehicleMediaUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly media: IVehicleMediaRepository,
  ) {}

  async execute(
    vehicleIdRaw: string,
    items: readonly MediaPlacement[],
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireStaff(ctx);

    const vehicle = await this.vehicles.findById(toVehicleId(vehicleIdRaw));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    const moved: VehicleMedia[] = [];
    for (const item of items) {
      const current = await this.media.findById(toMediaId(item.id));
      if (current === null || current.vehicleId !== vehicle.id) {
        throw new NotFoundError(`Vehicle media not found for id ${item.id}`);
      }
      moved.push(current.withPlacement(MediaCategory.create(item.category), item.sortOrder));
    }

    for (const m of moved) {
      await this.media.updatePlacement(m);
    }
  }
}
