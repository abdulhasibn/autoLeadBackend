export interface AssignLeadCommand {
  readonly leadId: string;
  /** null removes the current assignee. */
  readonly assignedTo: string | null;
}
