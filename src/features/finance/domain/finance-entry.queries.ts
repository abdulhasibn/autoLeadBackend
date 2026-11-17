import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { EntryKindValue } from './entry-kind.value-object';
import type { FinanceEntryId } from './finance-entry-id';
import type { SealedFinanceEntry } from './sealed-finance-records';

/** Filters SQL can apply on plaintext columns. Live entries only. */
export interface FinanceEntryFilter {
  /** Inclusive YYYY-MM-DD bounds. */
  readonly from?: string;
  readonly to?: string;
  readonly kind?: EntryKindValue;
  readonly vehicleId?: VehicleId;
  /** Entries of any of these cars. Ignored when `vehicleId` is set. */
  readonly vehicleIds?: readonly VehicleId[];
  /** Only entries with no car. Ignored when `vehicleId` or `vehicleIds` is set. */
  readonly unlinked?: boolean;
  readonly showroomId?: ShowroomId;
}

/** A capped read for screens that list entries. */
export interface FinanceEntryCriteria extends FinanceEntryFilter {
  /** Most rows to return; `truncated` says more matched. */
  readonly maxRows: number;
}

export interface SealedEntryPage {
  readonly rows: readonly SealedFinanceEntry[];
  readonly truncated: boolean;
}

/** Read side of the ledger. Rows stay sealed; the application decrypts them. */
export interface IFinanceEntryQueries {
  /** Newest entry date first, at most `maxRows` rows. For lists, never for totals. */
  list(criteria: FinanceEntryCriteria): Promise<SealedEntryPage>;
  /**
   * Every matching entry, uncapped, as a stream of pages (each at most a few
   * thousand rows, in no promised order). Reports fold each page into running
   * totals, so a total never misses rows and memory stays bounded.
   */
  scan(filter: FinanceEntryFilter): AsyncIterable<readonly SealedFinanceEntry[]>;
  findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null>;
}
