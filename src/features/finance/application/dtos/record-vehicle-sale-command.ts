export interface RecordVehicleSaleCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  readonly finalisedPricePaise: number;
  readonly soldOn: string;
}
