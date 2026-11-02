import type { SealedFinanceTag } from './sealed-finance-records';

/** Read side of tags. Rows stay sealed; the application decrypts them. */
export interface IFinanceTagQueries {
  /** Every tag including archived ones; there are only ever a few dozen. */
  listAll(): Promise<readonly SealedFinanceTag[]>;
}
