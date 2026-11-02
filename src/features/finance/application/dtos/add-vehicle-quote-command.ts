export interface AddVehicleQuoteCommand {
  readonly sessionToken: string | null;
  readonly vehicleId: string;
  readonly amountPaise: number;
  readonly quotedOn: string;
  readonly leadId: string | null;
  readonly quotedTo: string | null;
  readonly note: string | null;
}
