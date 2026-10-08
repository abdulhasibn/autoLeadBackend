/** Full replace of a lead's editable CRM fields. */
export interface UpdateLeadCommand {
  readonly leadId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly source: string;
  readonly budget: number | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
}
