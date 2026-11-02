import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Ends the caller's unlock session. Idempotent. */
export class LockVaultUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly sessions: FinanceSessionService,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(sessionToken: string | null, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireAdmin(ctx);

    const ended = await this.sessions.end(ctx, sessionToken);
    if (!ended) {
      return;
    }
    const vault = await this.vaults.find();
    if (vault !== null) {
      await this.audit.record({
        action: 'finance.lock',
        vaultId: vault.id,
        actorId: ctx.userId,
        at: this.clock.now(),
      });
    }
  }
}
