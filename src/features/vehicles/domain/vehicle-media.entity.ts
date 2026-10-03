import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { MediaCategory } from './media-category.value-object';
import type { MediaId } from './media-id';
import type { VehicleObjectPath } from './vehicle-object-path.value-object';

export interface VehicleMediaProps {
  readonly id: MediaId;
  readonly vehicleId: VehicleId;
  readonly storagePath: VehicleObjectPath;
  readonly category: MediaCategory;
  readonly sortOrder: number;
  readonly uploadedBy: UserId;
  readonly uploadedAt: Date;
}

export class VehicleMedia {
  private constructor(
    readonly id: MediaId,
    readonly vehicleId: VehicleId,
    readonly storagePath: VehicleObjectPath,
    readonly category: MediaCategory,
    readonly sortOrder: number,
    readonly uploadedBy: UserId,
    readonly uploadedAt: Date,
  ) {}

  static create(props: VehicleMediaProps): VehicleMedia {
    assertSortOrder(props.sortOrder);
    return new VehicleMedia(
      props.id,
      props.vehicleId,
      props.storagePath,
      props.category,
      props.sortOrder,
      props.uploadedBy,
      props.uploadedAt,
    );
  }

  static reconstitute(props: VehicleMediaProps): VehicleMedia {
    return new VehicleMedia(
      props.id,
      props.vehicleId,
      props.storagePath,
      props.category,
      props.sortOrder,
      props.uploadedBy,
      props.uploadedAt,
    );
  }
}

function assertSortOrder(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 32767) {
    throw new Error('sortOrder must be an integer between 0 and 32767');
  }
}
