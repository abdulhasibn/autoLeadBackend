export class InvalidVehicleObjectPathError extends Error {
  readonly code = 'INVALID_VEHICLE_OBJECT_PATH';

  constructor(message = 'Storage path does not belong to this vehicle') {
    super(message);
    this.name = 'InvalidVehicleObjectPathError';
  }
}
