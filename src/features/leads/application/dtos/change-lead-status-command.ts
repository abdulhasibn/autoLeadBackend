export interface ChangeLeadStatusCommand {
  readonly leadId: string;
  readonly status: string;
  readonly notes: string | null;
  /** Only with status `sold`: also mark the lead's linked vehicle sold. */
  readonly markVehicleSold: boolean;
}
