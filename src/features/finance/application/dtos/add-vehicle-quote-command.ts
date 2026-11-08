export interface AddVehicleQuoteCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  readonly amountPaise: number;
  readonly quotedOn: string;
  /** Required: the lead the price was offered to. */
  readonly leadId: string;
  readonly quotedTo: string | null;
  readonly note: string | null;
}
