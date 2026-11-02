export const ENTRY_KINDS = ['income', 'expense'] as const;

export type EntryKindValue = (typeof ENTRY_KINDS)[number];

/** Money received (income) or paid (expense). Fixed once an entry exists. */
export class EntryKind {
  private constructor(readonly value: EntryKindValue) {}

  static create(input: string): EntryKind {
    if (!(ENTRY_KINDS as readonly string[]).includes(input)) {
      throw new Error(`kind must be one of: ${ENTRY_KINDS.join(', ')}`);
    }
    return new EntryKind(input as EntryKindValue);
  }

  get isIncome(): boolean {
    return this.value === 'income';
  }
}
