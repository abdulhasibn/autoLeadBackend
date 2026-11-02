import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';

/** Omitted fields stay as they are. */
export interface UpdateFinanceEntryCommand {
  readonly sessionToken: string | null;
  readonly entryId: string;
  readonly amountPaise?: number;
  readonly entryDate?: string;
  readonly tagIds?: readonly string[];
  /** A car id links or moves the entry; null unlinks it. */
  readonly vehicleId?: string | null;
  readonly purpose?: EntryPurposeValue;
  readonly party?: string | null;
  readonly note?: string | null;
  readonly showroomId?: string;
}
