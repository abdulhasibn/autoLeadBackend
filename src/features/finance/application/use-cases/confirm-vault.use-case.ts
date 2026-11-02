import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import { RecoveryKey } from '../../domain/vault-secret.value-object';
import type { ConfirmVaultCommand } from '../dtos/confirm-vault-command';
import type { VaultStatusDto } from '../dtos/vault-status.dto';
import { FinanceAlreadyInitializedError } from '../errors/finance-already-initialized.error';
import { FinanceNotInitializedError } from '../errors/finance-not-initialized.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { VaultKeyring } from '../services/vault-keyring';

/**
 * Activates a pending vault once the admin types the recovery key back in,
 * proving it was saved before any finance data depends on it.
 */
export class ConfirmVaultUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly keyring: VaultKeyring,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmVaultCommand, ctx: AuthenticatedContext): Promise<VaultStatusDto> {
    this.policy.requireAdmin(ctx);

    const vault = await this.vaults.find();
    if (vault === null) {
      throw new FinanceNotInitializedError();
    }
    if (vault.isActive) {
      throw new FinanceAlreadyInitializedError('Finance is already set up and confirmed');
    }

    const dataKey = await this.keyring.openWithRecoveryKey(
      vault,
      RecoveryKey.create(command.recoveryKey),
      ctx,
    );
    dataKey.fill(0);

    const now = this.clock.now();
    vault.confirm(now);
    await this.vaults.save(vault);
    await this.audit.record({
      action: 'finance.confirm',
      vaultId: vault.id,
      actorId: ctx.userId,
      at: now,
    });

    return { initialized: true, confirmed: true, unlocked: false, expiresAt: null };
  }
}
