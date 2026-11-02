import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import { FinanceKey } from '../../domain/vault-secret.value-object';
import type { FinanceSessionDto } from '../dtos/finance-session.dto';
import type { UnlockVaultCommand } from '../dtos/unlock-vault-command';
import { FinanceNotInitializedError } from '../errors/finance-not-initialized.error';
import { FinanceVaultNotConfirmedError } from '../errors/finance-vault-not-confirmed.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VaultKeyring } from '../services/vault-keyring';

/** Opens the data key with the finance key and starts an unlock session. */
export class UnlockVaultUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly keyring: VaultKeyring,
    private readonly sessions: FinanceSessionService,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: UnlockVaultCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceSessionDto> {
    this.policy.requireAdmin(ctx);

    const vault = await this.vaults.find();
    if (vault === null) {
      throw new FinanceNotInitializedError();
    }
    if (!vault.isActive) {
      throw new FinanceVaultNotConfirmedError();
    }

    const dataKey = await this.keyring.openWithFinanceKey(
      vault,
      FinanceKey.create(command.financeKey),
      ctx,
    );
    const started = await this.sessions.start(ctx, dataKey);
    dataKey.fill(0);

    await this.audit.record({
      action: 'finance.unlock',
      vaultId: vault.id,
      actorId: ctx.userId,
      at: this.clock.now(),
    });
    return { sessionToken: started.sessionToken, expiresAt: started.expiresAt.toISOString() };
  }
}
