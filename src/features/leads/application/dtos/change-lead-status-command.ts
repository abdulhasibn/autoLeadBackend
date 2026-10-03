export interface ChangeLeadStatusCommand {
  readonly leadId: string;
  readonly status: string;
  readonly notes: string | null;
}
