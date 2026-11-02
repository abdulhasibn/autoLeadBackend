import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceSessionId } from '../domain/finance-session-id';
import type { FinanceSession } from '../domain/finance-session.entity';
import type { IFinanceSessionRepository } from '../domain/finance-session.repository';
import {
  FINANCE_SESSION_COLUMNS,
  toFinanceSession,
  toFinanceSessionRow,
} from './finance-session.mapper';

export class SupabaseFinanceSessionRepository implements IFinanceSessionRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: FinanceSessionId): Promise<FinanceSession | null> {
    const { data, error } = await this.db
      .from('finance_sessions')
      .select(FINANCE_SESSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance session: ${error.message}`);
    }
    return data === null ? null : toFinanceSession(data);
  }

  async save(session: FinanceSession): Promise<void> {
    const { error } = await this.db
      .from('finance_sessions')
      .upsert(toFinanceSessionRow(session), { onConflict: 'id' });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to save finance session: ${error.message}`);
    }
  }

  async delete(id: FinanceSessionId): Promise<void> {
    const { error } = await this.db.from('finance_sessions').delete().eq('id', id);
    this.check(error, 'Failed to end finance session');
  }

  async deleteAll(): Promise<void> {
    // PostgREST refuses an unfiltered delete; every row has a non-null id.
    const { error } = await this.db.from('finance_sessions').delete().not('id', 'is', null);
    this.check(error, 'Failed to end finance sessions');
  }

  async deleteAllExcept(id: FinanceSessionId): Promise<void> {
    const { error } = await this.db.from('finance_sessions').delete().neq('id', id);
    this.check(error, 'Failed to end other finance sessions');
  }

  async deleteExpired(now: Date): Promise<void> {
    const at = now.toISOString();
    const { error } = await this.db
      .from('finance_sessions')
      .delete()
      .or(`expires_at.lte.${at},idle_expires_at.lte.${at}`);
    this.check(error, 'Failed to purge expired finance sessions');
  }

  private check(error: { message: string } | null, message: string): void {
    if (error !== null) {
      throw new DatabaseUnavailableError(`${message}: ${error.message}`);
    }
  }
}
