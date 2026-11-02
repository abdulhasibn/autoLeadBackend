import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { KdfParams } from '../domain/finance-crypto.port';
import { toFinanceVaultId } from '../domain/finance-vault-id';
import { FinanceVault, type FinanceVaultStatus } from '../domain/finance-vault.entity';

export type FinanceVaultRow = Database['public']['Tables']['finance_vault']['Row'];
export type FinanceVaultInsert = Database['public']['Tables']['finance_vault']['Insert'];

export const FINANCE_VAULT_COLUMNS =
  'id, status, kdf, finance_salt, finance_wrapped_dek, recovery_salt, recovery_wrapped_dek, key_version, failed_unlocks, last_failed_unlock_at, unlock_blocked_until, created_by, confirmed_at, created_at, updated_at';

export function toFinanceVault(row: Omit<FinanceVaultRow, 'singleton'>): FinanceVault {
  return FinanceVault.reconstitute({
    id: toFinanceVaultId(row.id),
    status: parseStatus(row.status),
    kdf: parseKdf(row.kdf),
    financeWrap: { salt: row.finance_salt, wrappedKey: row.finance_wrapped_dek },
    recoveryWrap: { salt: row.recovery_salt, wrappedKey: row.recovery_wrapped_dek },
    keyVersion: row.key_version,
    failedUnlocks: row.failed_unlocks,
    lastFailedUnlockAt: toDate(row.last_failed_unlock_at),
    unlockBlockedUntil: toDate(row.unlock_blocked_until),
    createdBy: toUserId(row.created_by),
    confirmedAt: toDate(row.confirmed_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export function toFinanceVaultRow(vault: FinanceVault): FinanceVaultInsert {
  return {
    id: vault.id,
    status: vault.status,
    kdf: { ...vault.kdf },
    finance_salt: vault.financeWrap.salt,
    finance_wrapped_dek: vault.financeWrap.wrappedKey,
    recovery_salt: vault.recoveryWrap.salt,
    recovery_wrapped_dek: vault.recoveryWrap.wrappedKey,
    key_version: vault.keyVersion,
    failed_unlocks: vault.failedUnlocks,
    last_failed_unlock_at: toIso(vault.lastFailedUnlockAt),
    unlock_blocked_until: toIso(vault.unlockBlockedUntil),
    created_by: vault.createdBy,
    confirmed_at: toIso(vault.confirmedAt),
    created_at: vault.createdAt.toISOString(),
    updated_at: vault.updatedAt.toISOString(),
  };
}

function parseStatus(value: string): FinanceVaultStatus {
  if (value === 'pending' || value === 'active') {
    return value;
  }
  throw new DataIntegrityError(`Unknown finance vault status: ${value}`);
}

function parseKdf(value: unknown): KdfParams {
  if (typeof value === 'object' && value !== null) {
    const kdf = value as Record<string, unknown>;
    if (
      kdf.algorithm === 'scrypt' &&
      typeof kdf.n === 'number' &&
      typeof kdf.r === 'number' &&
      typeof kdf.p === 'number' &&
      typeof kdf.keyLength === 'number'
    ) {
      return { algorithm: 'scrypt', n: kdf.n, r: kdf.r, p: kdf.p, keyLength: kdf.keyLength };
    }
  }
  throw new DataIntegrityError('Finance vault has invalid key derivation parameters');
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
