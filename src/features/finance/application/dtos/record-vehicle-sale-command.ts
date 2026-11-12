export interface RecordVehicleSaleCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  readonly finalisedPricePaise: number;
  readonly soldOn: string;
  /** The buyer's booking-confirmed lead; needed while the car isn't sold yet. */
  readonly leadId: string | null;
}
