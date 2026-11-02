export interface SetVehicleDealCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  /** Paise. */
  readonly purchaseRatePaise: number;
  readonly purchasedOn: string | null;
  readonly ownerExpectedPricePaise: number | null;
  readonly minimumSellingPricePaise: number | null;
  readonly note: string | null;
  /** Paise; omitted = keep, null = clear. */
  readonly listedPricePaise?: number | null;
}
