import type { EntryKindValue } from '../../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';

export interface CreateFinanceEntryCommand {
  readonly sessionToken: string | null;
  readonly kind: EntryKindValue;
  /** Paise. */
  readonly amountPaise: number;
  /** YYYY-MM-DD */
  readonly entryDate: string;
  readonly tagIds: readonly string[];
  readonly vehicleId: string | null;
  readonly purpose: EntryPurposeValue | null;
  readonly party: string | null;
  readonly note: string | null;
  readonly showroomId: string | null;
}
