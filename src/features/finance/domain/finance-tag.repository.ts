import type { FinanceTagId } from './finance-tag-id';
import type { SealedFinanceTag } from './sealed-finance-records';

/** Command-side persistence for tags (sealed). */
export interface IFinanceTagRepository {
  /** Every tag including archived ones (needed for name uniqueness). */
  findAll(): Promise<readonly SealedFinanceTag[]>;
  findById(id: FinanceTagId): Promise<SealedFinanceTag | null>;
  findByIds(ids: readonly FinanceTagId[]): Promise<readonly SealedFinanceTag[]>;
  save(tag: SealedFinanceTag): Promise<void>;
  saveMany(tags: readonly SealedFinanceTag[]): Promise<void>;
  count(): Promise<number>;
}
