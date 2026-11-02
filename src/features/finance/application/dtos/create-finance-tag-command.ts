export interface CreateFinanceTagCommand {
  readonly sessionToken: string | null;
  readonly name: string;
  readonly color: string | null;
}
