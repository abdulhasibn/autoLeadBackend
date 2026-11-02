import type { Database } from '../../../infrastructure/supabase/database.types';
import { toFinanceTagId } from '../domain/finance-tag-id';
import type { SealedFinanceTag } from '../domain/sealed-finance-records';

export type FinanceTagRow = Database['public']['Tables']['finance_tags']['Row'];

export const FINANCE_TAG_COLUMNS = 'id, payload, key_version, created_at, updated_at, archived_at';

export function toSealedFinanceTag(row: FinanceTagRow): SealedFinanceTag {
  return {
    id: toFinanceTagId(row.id),
    payload: row.payload,
    keyVersion: row.key_version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    archivedAt: row.archived_at === null ? null : new Date(row.archived_at),
  };
}

export function toFinanceTagRow(tag: SealedFinanceTag): FinanceTagRow {
  return {
    id: tag.id,
    payload: tag.payload,
    key_version: tag.keyVersion,
    created_at: tag.createdAt.toISOString(),
    updated_at: tag.updatedAt.toISOString(),
    archived_at: tag.archivedAt === null ? null : tag.archivedAt.toISOString(),
  };
}
