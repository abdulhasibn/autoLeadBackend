import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IFinanceVaultQueries } from '../../domain/finance-vault.queries';
import type { VaultStatusDto } from '../dtos/vault-status.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Tells the client which finance screen to show: set up, confirm, unlock or open. */
export class GetVaultStatusUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultQueries,
    private readonly sessions: FinanceSessionService,
  ) {}

  async execute(sessionToken: string | null, ctx: AuthenticatedContext): Promise<VaultStatusDto> {
    this.policy.requireAdmin(ctx);

    const vault = await this.vaults.getVaultState();
    if (vault === null) {
      return { initialized: false, confirmed: false, unlocked: false, expiresAt: null };
    }
    const confirmed = vault.status === 'active';
    const expiresAt = confirmed ? await this.sessions.peek(ctx, sessionToken) : null;
    return {
      initialized: true,
      confirmed,
      unlocked: expiresAt !== null,
      expiresAt: expiresAt === null ? null : expiresAt.toISOString(),
    };
  }
}
