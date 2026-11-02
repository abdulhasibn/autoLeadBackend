import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { FinanceAlreadyInitializedError } from './application/errors/finance-already-initialized.error';
import { FinanceLockedError } from './application/errors/finance-locked.error';
import { FinanceNotInitializedError } from './application/errors/finance-not-initialized.error';
import { FinanceUnlockBlockedError } from './application/errors/finance-unlock-blocked.error';
import { FinanceVaultNotConfirmedError } from './application/errors/finance-vault-not-confirmed.error';
import { InvalidFinanceKeyError } from './application/errors/invalid-finance-key.error';
import { FinancePolicy } from './application/policies/finance.policy';
import { FinanceSessionService } from './application/services/finance-session.service';
import { VaultKeyring } from './application/services/vault-keyring';
import { ChangeFinanceKeyUseCase } from './application/use-cases/change-finance-key.use-case';
import { ConfirmVaultUseCase } from './application/use-cases/confirm-vault.use-case';
import { GetVaultStatusUseCase } from './application/use-cases/get-vault-status.use-case';
import { LockVaultUseCase } from './application/use-cases/lock-vault.use-case';
import { RecoverVaultUseCase } from './application/use-cases/recover-vault.use-case';
import { SetupVaultUseCase } from './application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from './application/use-cases/unlock-vault.use-case';
import type { KdfParams } from './domain/finance-crypto.port';
import { DEFAULT_KDF_PARAMS } from './domain/finance.constants';
import { NodeFinanceCrypto } from './infrastructure/node-finance-crypto';
import { SupabaseFinanceAuditLog } from './infrastructure/supabase-finance-audit-log';
import { SupabaseFinanceVaultQueries } from './infrastructure/supabase-finance-vault.queries';
import { SupabaseFinanceSessionRepository } from './infrastructure/supabase-finance-session.repository';
import { SupabaseFinanceVaultRepository } from './infrastructure/supabase-finance-vault.repository';
import { ChangeFinanceKeyController } from './presentation/controllers/change-finance-key.controller';
import { ConfirmVaultController } from './presentation/controllers/confirm-vault.controller';
import { GetVaultStatusController } from './presentation/controllers/get-vault-status.controller';
import { LockVaultController } from './presentation/controllers/lock-vault.controller';
import { RecoverVaultController } from './presentation/controllers/recover-vault.controller';
import { SetupVaultController } from './presentation/controllers/setup-vault.controller';
import { UnlockVaultController } from './presentation/controllers/unlock-vault.controller';
import { createFinanceRouter } from './presentation/finance.routes';

export interface FinanceComposition {
  readonly router: ReturnType<typeof createFinanceRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface FinanceCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  /** Overridable so tests can use a cheap key derivation. */
  readonly kdf?: KdfParams;
}

/**
 * Constructs and wires the finance feature.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeFinance(
  infraClient: SupabaseClient<Database>,
  deps: FinanceCompositionDeps,
): FinanceComposition {
  const policy = new FinancePolicy();
  const vaults = new SupabaseFinanceVaultRepository(infraClient);
  const vaultQueries = new SupabaseFinanceVaultQueries(infraClient);
  const sessions = new SupabaseFinanceSessionRepository(infraClient);
  const audit = new SupabaseFinanceAuditLog(infraClient);
  const crypto = new NodeFinanceCrypto();
  const ids = new UuidIdGenerator();

  const keyring = new VaultKeyring(vaults, crypto, deps.clock, audit);
  const sessionService = new FinanceSessionService(sessions, crypto, deps.clock, ids);

  const router = createFinanceRouter({
    bearerMiddleware: deps.bearerMiddleware,
    getVaultStatusController: new GetVaultStatusController(
      new GetVaultStatusUseCase(policy, vaultQueries, sessionService),
    ),
    setupVaultController: new SetupVaultController(
      new SetupVaultUseCase(
        policy,
        vaults,
        keyring,
        crypto,
        audit,
        deps.clock,
        ids,
        deps.kdf ?? DEFAULT_KDF_PARAMS,
      ),
    ),
    confirmVaultController: new ConfirmVaultController(
      new ConfirmVaultUseCase(policy, vaults, keyring, audit, deps.clock),
    ),
    unlockVaultController: new UnlockVaultController(
      new UnlockVaultUseCase(policy, vaults, keyring, sessionService, audit, deps.clock),
    ),
    lockVaultController: new LockVaultController(
      new LockVaultUseCase(policy, vaults, sessionService, audit, deps.clock),
    ),
    changeFinanceKeyController: new ChangeFinanceKeyController(
      new ChangeFinanceKeyUseCase(
        policy,
        vaults,
        keyring,
        sessionService,
        sessions,
        crypto,
        audit,
        deps.clock,
      ),
    ),
    recoverVaultController: new RecoverVaultController(
      new RecoverVaultUseCase(policy, vaults, keyring, sessions, crypto, audit, deps.clock),
    ),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof FinanceLockedError) {
      return { status: 423, code: err.code, message: err.message };
    }
    if (
      err instanceof FinanceNotInitializedError ||
      err instanceof FinanceAlreadyInitializedError ||
      err instanceof FinanceVaultNotConfirmedError
    ) {
      return { status: 409, code: err.code, message: err.message };
    }
    if (err instanceof InvalidFinanceKeyError) {
      return { status: 422, code: err.code, message: err.message };
    }
    if (err instanceof FinanceUnlockBlockedError) {
      return { status: 429, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper };
}
