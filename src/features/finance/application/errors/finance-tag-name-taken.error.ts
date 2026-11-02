/** Another tag (archived or not) already has this name. Mapped to HTTP 409. */
export class FinanceTagNameTakenError extends Error {
  readonly code = 'FINANCE_TAG_NAME_TAKEN';

  constructor(name: string) {
    super(`A tag named "${name}" already exists`);
    this.name = 'FinanceTagNameTakenError';
  }
}
