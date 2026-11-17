export interface RecordVehicleSaleCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  readonly finalisedPricePaise: number;
  readonly soldOn: string;
  /** The buyer's booking-confirmed lead; needed while the car isn't sold yet. */
  readonly leadId: string | null;
  /**
   * The buyer really paid more than this price (say, before a discount): save
   * it anyway and leave the overpayment owed back to them.
   */
  readonly keepOverpayment?: boolean;
}
