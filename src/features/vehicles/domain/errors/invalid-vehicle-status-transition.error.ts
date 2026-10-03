import type { VehicleId } from '../../../../domain/shared/vehicle-id';

export class InvalidVehicleStatusTransitionError extends Error {
  readonly code = 'INVALID_VEHICLE_STATUS_TRANSITION';

  constructor(
    readonly vehicleId: VehicleId,
    readonly fromStatus: string,
    readonly toStatus: string,
  ) {
    super(`Cannot change vehicle status from ${fromStatus} to ${toStatus}`);
    this.name = 'InvalidVehicleStatusTransitionError';
  }
}
