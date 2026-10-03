export interface ConfirmVehicleMediaCommand {
  readonly vehicleId: string;
  readonly storagePath: string;
  readonly category: string;
  readonly sortOrder: number;
}
