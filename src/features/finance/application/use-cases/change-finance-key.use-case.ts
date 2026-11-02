import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceAuditLog } from '../../domain/finance-audit-log.port';
import type { FinanceCrypto } from '../../domain/finance-crypto.port';
import type { IFinanceSessionRepository } from '../../domain/finance-session.repository';
import type { IFinanceVaultRepository } from '../../domain/finance-vault.repository';
import { FinanceKey } from '../../domain/vault-secret.value-object';
import type { ChangeFinanceKeyCommand } from '../dtos/change-finance-key-command';
import type { FinanceKeyDto } from '../dtos/vault-keys.dto';
import { FinanceNotInitializedError } from '../errors/finance-not-initialized.error';
import { FinanceVaultNotConfirmedError } from '../errors/finance-vault-not-confirmed.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VaultKeyring } from '../services/vault-keyring';

/**
 * Replaces the finance key. Needs an unlocked session and the current key.
 * Only the data key is re-wrapped; no finance row changes. Every other
 * session ends, so the old key can't keep a session alive elsewhere.
 */
export class ChangeFinanceKeyUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly vaults: IFinanceVaultRepository,
    private readonly keyring: VaultKeyring,
    private readonly sessionService: FinanceSessionService,
    private readonly sessions: IFinanceSessionRepository,
    private readonly crypto: FinanceCrypto,
    private readonly audit: IFinanceAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeFinanceKeyCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceKeyDto> {
    this.policy.requireAdmin(ctx);
    const opened = await this.sessionService.open(ctx, command.sessionToken);

    const vault = await this.vaults.find();
    if (vault === null) {
      throw new FinanceNotInitializedError();
    }
    if (!vault.isActive) {
      throw new FinanceVaultNotConfirmedError();
    }

    const dataKey = await this.keyring.openWithFinanceKey(
      vault,
      FinanceKey.create(command.currentKey),
      ctx,
    );
    const newKey = FinanceKey.fromBytes(this.crypto.randomBytes(FinanceKey.BYTE_LENGTH));
    const financeWrap = await this.keyring.wrapWithFinanceKey(dataKey, newKey, vault.kdf);
    dataKey.fill(0);

    const now = this.clock.now();
    vault.replaceFinanceWrap(financeWrap, now);
    await this.vaults.save(vault);
    await this.sessions.deleteAllExcept(opened.sessionId);
    await this.audit.record({
      action: 'finance.change_key',
      vaultId: vault.id,
      actorId: ctx.userId,
      at: now,
    });

    return { financeKey: newKey.value };
  }
}
