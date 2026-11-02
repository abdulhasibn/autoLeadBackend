import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { FinanceCrypto } from '../../domain/finance-crypto.port';
import type { IFinanceSessionRepository } from '../../domain/finance-session.repository';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import { FinanceKey, RecoveryKey } from '../../domain/vault-secret.value-object';
import type { RecoverVaultCommand } from '../dtos/recover-vault-command';
import type { VaultKeysDto } from '../dtos/vault-keys.dto';
import { FinanceNotInitializedError } from '../errors/finance-not-initialized.error';
import { FinanceVaultNotConfirmedError } from '../errors/finance-vault-not-confirmed.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { VaultKeyring } from '../services/vault-keyring';

/**
 * Recovers from a lost finance key with the recovery key. Issues a new
 * finance key and a new recovery key (the used one is spent) and ends every
 * session.
 */
export class RecoverVaultUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly keyring: VaultKeyring,
    private readonly sessions: IFinanceSessionRepository,
    private readonly crypto: FinanceCrypto,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecoverVaultCommand, ctx: AuthenticatedContext): Promise<VaultKeysDto> {
    this.policy.requireAdmin(ctx);

    const vault = await this.vaults.find();
    if (vault === null) {
      throw new FinanceNotInitializedError();
    }
    if (!vault.isActive) {
      throw new FinanceVaultNotConfirmedError('Finance setup was never confirmed; set it up again');
    }

    const dataKey = await this.keyring.openWithRecoveryKey(
      vault,
      RecoveryKey.create(command.recoveryKey),
      ctx,
    );
    const financeKey = FinanceKey.fromBytes(this.crypto.randomBytes(FinanceKey.BYTE_LENGTH));
    const recoveryKey = RecoveryKey.fromBytes(this.crypto.randomBytes(RecoveryKey.BYTE_LENGTH));
    const financeWrap = await this.keyring.wrapWithFinanceKey(dataKey, financeKey, vault.kdf);
    const recoveryWrap = await this.keyring.wrapWithRecoveryKey(dataKey, recoveryKey, vault.kdf);
    dataKey.fill(0);

    const now = this.clock.now();
    vault.replaceFinanceWrap(financeWrap, now);
    vault.replaceRecoveryWrap(recoveryWrap, now);
    await this.vaults.save(vault);
    await this.sessions.deleteAll();
    await this.audit.record({
      action: 'finance.recover',
      vaultId: vault.id,
      actorId: ctx.userId,
      at: now,
    });

    return { financeKey: financeKey.value, recoveryKey: recoveryKey.value };
  }
}
