export interface ChangeVehicleStatusCommand {
  readonly vehicleId: string;
  readonly status: string;
  readonly reason: string | null;
}
