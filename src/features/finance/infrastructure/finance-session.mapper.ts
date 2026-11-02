import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { toFinanceSessionId } from '../domain/finance-session-id';
import { FinanceSession } from '../domain/finance-session.entity';

export type FinanceSessionRow = Database['public']['Tables']['finance_sessions']['Row'];

export const FINANCE_SESSION_COLUMNS =
  'id, user_id, wrapped_dek, created_at, last_used_at, idle_expires_at, expires_at';

export function toFinanceSession(row: FinanceSessionRow): FinanceSession {
  return FinanceSession.reconstitute({
    id: toFinanceSessionId(row.id),
    userId: toUserId(row.user_id),
    wrappedKey: row.wrapped_dek,
    createdAt: new Date(row.created_at),
    lastUsedAt: new Date(row.last_used_at),
    idleExpiresAt: new Date(row.idle_expires_at),
    expiresAt: new Date(row.expires_at),
  });
}

export function toFinanceSessionRow(session: FinanceSession): FinanceSessionRow {
  return {
    id: session.id,
    user_id: session.userId,
    wrapped_dek: session.wrappedKey,
    created_at: session.createdAt.toISOString(),
    last_used_at: session.lastUsedAt.toISOString(),
    idle_expires_at: session.idleExpiresAt.toISOString(),
    expires_at: session.expiresAt.toISOString(),
  };
}
