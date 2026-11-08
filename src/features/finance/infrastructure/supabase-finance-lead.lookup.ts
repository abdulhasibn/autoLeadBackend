import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toLeadId, type LeadId } from '../../../domain/shared/lead-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceLeadFacts, IFinanceLeadLookup } from '../domain/finance-lead-lookup.port';
import { inBatches } from './in-batches';

// A lead has either a walk-in contact or a registered buyer (leads.user_id).
// The users hint is needed: leads also reference users as assignee and creator.
const COLUMNS =
  'id, deleted_at, contacts ( full_name, phone ), buyer:users!user_id ( full_name, phone )';

interface Person {
  readonly full_name: string | null;
  readonly phone: string | null;
}

interface LeadRow {
  readonly id: string;
  readonly deleted_at: string | null;
  readonly contacts: Person | Person[] | null;
  readonly buyer: Person | Person[] | null;
}

/** Reads lead names for finance quotes (precedent: supabase-finance-vehicle.lookup). */
export class SupabaseFinanceLeadLookup implements IFinanceLeadLookup {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findMany(ids: readonly LeadId[]): Promise<readonly FinanceLeadFacts[]> {
    const facts: FinanceLeadFacts[] = [];
    for (const batch of inBatches([...new Set(ids)])) {
      const { data, error } = await this.db.from('leads').select(COLUMNS).in('id', batch);
      if (error !== null) {
        throw new DatabaseUnavailableError(`Failed to look up leads: ${error.message}`);
      }
      for (const row of (data ?? []) as unknown as LeadRow[]) {
        const person = one(row.contacts) ?? one(row.buyer);
        facts.push({
          id: toLeadId(row.id),
          name: person?.full_name ?? null,
          phone: person?.phone ?? null,
          deleted: row.deleted_at !== null,
        });
      }
    }
    return facts;
  }
}

function one(value: Person | Person[] | null): Person | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
