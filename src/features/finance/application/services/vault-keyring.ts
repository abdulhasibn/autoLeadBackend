import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { FinanceCrypto, KdfParams } from '../../domain/finance-crypto.port';
import type { FinanceVault, KeyWrap } from '../../domain/finance-vault.entity';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import type { FinanceKey, RecoveryKey } from '../../domain/vault-secret.value-object';
import { FinanceUnlockBlockedError } from '../errors/finance-unlock-blocked.error';
import { InvalidFinanceKeyError } from '../errors/invalid-finance-key.error';

export const FINANCE_WRAP_AAD = 'finance_vault:finance';
export const RECOVERY_WRAP_AAD = 'finance_vault:recovery';

/**
 * Wraps the vault's data key under typed secrets, and opens it again with the
 * unlock lockout applied: blocked vaults refuse, wrong keys are counted and
 * audited, a right key clears the count. Shared by setup, unlock, confirm,
 * change-key and recover so every key attempt is rate limited the same way.
 */
export class VaultKeyring {
  constructor(
    private readonly vaults: IFinanceVaultRepository,
    private readonly crypto: FinanceCrypto,
    private readonly clock: Clock,
    private readonly audit: IFinanceAuditLog,
  ) {}

  async wrapWithFinanceKey(dataKey: Uint8Array, key: FinanceKey, kdf: KdfParams): Promise<KeyWrap> {
    return this.wrap(dataKey, key.value, kdf, FINANCE_WRAP_AAD);
  }

  async wrapWithRecoveryKey(
    dataKey: Uint8Array,
    key: RecoveryKey,
    kdf: KdfParams,
  ): Promise<KeyWrap> {
    return this.wrap(dataKey, key.value, kdf, RECOVERY_WRAP_AAD);
  }

  async openWithFinanceKey(
    vault: FinanceVault,
    key: FinanceKey,
    ctx: AuthenticatedContext,
  ): Promise<Uint8Array> {
    return this.open(vault, key.value, vault.financeWrap, FINANCE_WRAP_AAD, ctx);
  }

  async openWithRecoveryKey(
    vault: FinanceVault,
    key: RecoveryKey,
    ctx: AuthenticatedContext,
  ): Promise<Uint8Array> {
    return this.open(vault, key.value, vault.recoveryWrap, RECOVERY_WRAP_AAD, ctx);
  }

  private async wrap(
    dataKey: Uint8Array,
    secret: string,
    kdf: KdfParams,
    aad: string,
  ): Promise<KeyWrap> {
    const salt = this.crypto.newSalt();
    const kek = await this.crypto.deriveKek(secret, salt, kdf);
    const wrappedKey = this.crypto.wrapKey(kek, dataKey, aad);
    kek.fill(0);
    return { salt, wrappedKey };
  }

  private async open(
    vault: FinanceVault,
    secret: string,
    wrap: KeyWrap,
    aad: string,
    ctx: AuthenticatedContext,
  ): Promise<Uint8Array> {
    const now = this.clock.now();
    if (vault.isUnlockBlocked(now)) {
      throw new FinanceUnlockBlockedError(vault.minutesUntilUnblocked(now));
    }

    const kek = await this.crypto.deriveKek(secret, wrap.salt, vault.kdf);
    const dataKey = this.crypto.unwrapKey(kek, wrap.wrappedKey, aad);
    kek.fill(0);

    if (dataKey === null) {
      vault.recordFailedUnlock(now);
      await this.vaults.save(vault);
      await this.audit.record({
        action: 'finance.unlock_failed',
        vaultId: vault.id,
        actorId: ctx.userId,
        at: now,
      });
      throw new InvalidFinanceKeyError();
    }

    if (vault.recordSuccessfulUnlock(now)) {
      await this.vaults.save(vault);
    }
    return dataKey;
  }
}
