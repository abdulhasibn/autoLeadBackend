import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceEntryId } from '../domain/finance-entry-id';
import type {
  FinanceEntryCriteria,
  FinanceEntryFilter,
  IFinanceEntryQueries,
  SealedEntryPage,
} from '../domain/finance-entry.queries';
import type { SealedFinanceEntry } from '../domain/sealed-finance-records';
import { FINANCE_ENTRY_COLUMNS, toSealedFinanceEntry } from './finance-entry.mapper';
import { MAX_IDS_PER_REQUEST, inBatches } from './in-batches';

/** PostgREST caps one response at 1,000 rows, so larger reads come in pages. */
const PAGE_SIZE = 1000;

export class SupabaseFinanceEntryQueries implements IFinanceEntryQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(criteria: FinanceEntryCriteria): Promise<SealedEntryPage> {
    const ids = criteria.vehicleId === undefined ? criteria.vehicleIds : undefined;
    if (ids !== undefined && ids.length > MAX_IDS_PER_REQUEST) {
      const rows: SealedFinanceEntry[] = [];
      for (const batch of inBatches(ids)) {
        const page = await this.list({ ...criteria, vehicleIds: batch });
        rows.push(...page.rows);
        if (page.truncated || rows.length > criteria.maxRows) {
          return { rows: rows.slice(0, criteria.maxRows), truncated: true };
        }
      }
      return { rows, truncated: false };
    }
    return this.listOnePass(criteria);
  }

  /**
   * Keyset pages by `id`: each page asks for ids after the last one seen, so a
   * row can't be skipped or repeated the way OFFSET paging can while the
   * ledger changes, and later pages cost the same as the first.
   */
  async *scan(filter: FinanceEntryFilter): AsyncIterable<readonly SealedFinanceEntry[]> {
    const ids = filter.vehicleId === undefined ? filter.vehicleIds : undefined;
    if (ids !== undefined && ids.length > MAX_IDS_PER_REQUEST) {
      for (const batch of inBatches(ids)) {
        yield* this.scan({ ...filter, vehicleIds: batch });
      }
      return;
    }
    let after: string | null = null;
    for (;;) {
      let query = this.filtered(filter);
      if (after !== null) query = query.gt('id', after);
      const { data, error } = await query.order('id', { ascending: true }).limit(PAGE_SIZE);
      if (error !== null) {
        throw new DatabaseUnavailableError(`Failed to scan finance entries: ${error.message}`);
      }
      const batch = data ?? [];
      if (batch.length > 0) yield batch.map(toSealedFinanceEntry);
      const last = batch.at(-1);
      if (last === undefined || batch.length < PAGE_SIZE) return;
      after = last.id;
    }
  }

  private async listOnePass(criteria: FinanceEntryCriteria): Promise<SealedEntryPage> {
    const rows: SealedFinanceEntry[] = [];
    // Read one row past the cap to know whether more matched.
    const wanted = criteria.maxRows + 1;
    for (let offset = 0; offset < wanted; offset += PAGE_SIZE) {
      const end = Math.min(offset + PAGE_SIZE, wanted) - 1;
      const { data, error } = await this.filtered(criteria)
        .order('entry_date', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, end);
      if (error !== null) {
        throw new DatabaseUnavailableError(`Failed to list finance entries: ${error.message}`);
      }
      const batch = data ?? [];
      rows.push(...batch.map(toSealedFinanceEntry));
      if (batch.length < end - offset + 1) {
        break;
      }
    }
    const truncated = rows.length > criteria.maxRows;
    return { rows: truncated ? rows.slice(0, criteria.maxRows) : rows, truncated };
  }

  /** Live entries matching the filter; callers add ordering and paging. */
  private filtered(filter: FinanceEntryFilter) {
    let query = this.db
      .from('finance_entries')
      .select(FINANCE_ENTRY_COLUMNS)
      .is('deleted_at', null);
    if (filter.from !== undefined) query = query.gte('entry_date', filter.from);
    if (filter.to !== undefined) query = query.lte('entry_date', filter.to);
    if (filter.kind !== undefined) query = query.eq('kind', filter.kind);
    if (filter.showroomId !== undefined) query = query.eq('showroom_id', filter.showroomId);
    if (filter.vehicleId !== undefined) {
      query = query.eq('vehicle_id', filter.vehicleId);
    } else if (filter.vehicleIds !== undefined) {
      query = query.in('vehicle_id', [...filter.vehicleIds]);
    } else if (filter.unlinked === true) {
      query = query.is('vehicle_id', null);
    }
    return query;
  }

  async findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null> {
    const { data, error } = await this.db
      .from('finance_entries')
      .select(FINANCE_ENTRY_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance entry: ${error.message}`);
    }
    return data === null ? null : toSealedFinanceEntry(data);
  }
}
