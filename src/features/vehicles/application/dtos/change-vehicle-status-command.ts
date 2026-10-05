export interface ChangeVehicleStatusCommand {
  readonly vehicleId: string;
  readonly status: string;
  readonly reason: string | null;
  /** Required to drop a vehicle that still has active leads. */
  readonly confirmUnlinkLeads: boolean;
}
