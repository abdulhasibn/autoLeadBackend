import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { FinanceCrypto, KdfParams } from '../../domain/finance-crypto.port';
import { toFinanceVaultId } from '../../domain/finance-vault-id';
import { FinanceVault } from '../../domain/finance-vault.entity';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import { CURRENT_KEY_VERSION } from '../../domain/finance.constants';
import { FinanceKey, RecoveryKey } from '../../domain/vault-secret.value-object';
import type { VaultKeysDto } from '../dtos/vault-keys.dto';
import { FinanceAlreadyInitializedError } from '../errors/finance-already-initialized.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { VaultKeyring } from '../services/vault-keyring';

/**
 * Creates the vault: a random data key wrapped by a new finance key and a new
 * recovery key, both returned once. The vault stays pending until the
 * recovery key is confirmed; a pending vault can be set up again.
 */
export class SetupVaultUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly keyring: VaultKeyring,
    private readonly crypto: FinanceCrypto,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly kdf: KdfParams,
  ) {}

  async execute(ctx: AuthenticatedContext): Promise<VaultKeysDto> {
    this.policy.requireAdmin(ctx);

    const existing = await this.vaults.find();
    if (existing !== null) {
      if (existing.isActive) {
        throw new FinanceAlreadyInitializedError();
      }
      await this.vaults.delete(existing.id);
    }

    const dataKey = this.crypto.newDataKey();
    const financeKey = FinanceKey.fromBytes(this.crypto.randomBytes(FinanceKey.BYTE_LENGTH));
    const recoveryKey = RecoveryKey.fromBytes(this.crypto.randomBytes(RecoveryKey.BYTE_LENGTH));
    const financeWrap = await this.keyring.wrapWithFinanceKey(dataKey, financeKey, this.kdf);
    const recoveryWrap = await this.keyring.wrapWithRecoveryKey(dataKey, recoveryKey, this.kdf);
    dataKey.fill(0);

    const now = this.clock.now();
    const vault = FinanceVault.createPending({
      id: toFinanceVaultId(this.ids.generate()),
      kdf: this.kdf,
      financeWrap,
      recoveryWrap,
      keyVersion: CURRENT_KEY_VERSION,
      createdBy: ctx.userId,
      now,
    });
    await this.vaults.save(vault);
    await this.audit.record({
      action: 'finance.setup',
      vaultId: vault.id,
      actorId: ctx.userId,
      at: now,
    });

    return { financeKey: financeKey.value, recoveryKey: recoveryKey.value };
  }
}
