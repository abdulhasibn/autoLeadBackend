import type { FinanceEntryId } from './finance-entry-id';
import type { SealedFinanceEntry } from './sealed-finance-records';

/** Command-side persistence for ledger entries (sealed). */
export interface IFinanceEntryRepository {
  /** Live (not deleted) entry, or null. */
  findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null>;
  /** Inserts or updates by id. */
  save(entry: SealedFinanceEntry): Promise<void>;
}
