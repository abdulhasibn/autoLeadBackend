import type { EntryKindValue } from '../../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';

export const ENTRY_SORTS = ['date', '-date', 'amount', '-amount'] as const;

export type EntrySort = (typeof ENTRY_SORTS)[number];

export interface ListFinanceEntriesQuery {
  readonly sessionToken: string | null;
  /** YYYY-MM-DD; required with `to` unless `vehicleId` is given. */
  readonly from?: string;
  readonly to?: string;
  readonly kind?: EntryKindValue;
  readonly vehicleId?: string;
  readonly unlinked?: boolean;
  readonly showroomId?: string;
  readonly tagIds?: readonly string[];
  readonly purposes?: readonly EntryPurposeValue[];
  readonly minAmountPaise?: number;
  readonly maxAmountPaise?: number;
  readonly search?: string;
  /** `date` = newest first (default), `-date` = oldest first; `amount` = largest first. */
  readonly sort: EntrySort;
  readonly limit: number;
  readonly offset: number;
}
