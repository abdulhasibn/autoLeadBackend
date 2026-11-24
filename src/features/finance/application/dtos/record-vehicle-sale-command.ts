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
  /**
   * Money the buyer paid at the sale. Saved in the same request as a `sale`
   * income entry, so the sale and its payment land together or not at all.
   */
  /**
   * `adjust`: the sale lead's earlier payments were entered wrong, so cut them
   * down (newest first) until they and `buyerPayment` fit the price. Touches
   * only that lead's `sale` entries (plus unassigned ones on a sold car).
   */
  readonly buyerPayments?: 'adjust' | null;
  readonly buyerPayment?: { readonly amountPaise: number; readonly paidOn: string } | null;
}
