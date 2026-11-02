export interface UpdateFinanceTagCommand {
  readonly sessionToken: string | null;
  readonly tagId: string;
  readonly name?: string;
  /** null clears the colour. */
  readonly color?: string | null;
  readonly archived?: boolean;
}
