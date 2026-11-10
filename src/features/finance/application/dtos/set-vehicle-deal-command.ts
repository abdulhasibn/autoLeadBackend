export interface SetVehicleDealCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  /** Paise; required for purchase cars, null for commission cars. */
  readonly purchaseRatePaise: number | null;
  /** Basis points (350 = 3.5%); required for commission cars, null for purchase cars. */
  readonly commissionBasisPoints: number | null;
  readonly purchasedOn: string | null;
  readonly ownerExpectedPricePaise: number | null;
  readonly minimumSellingPricePaise: number | null;
  readonly note: string | null;
  /** Paise; omitted = keep, null = clear. */
  readonly listedPricePaise?: number | null;
}
