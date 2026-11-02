import { Router, type RequestHandler } from 'express';

import type { ListFinanceTagsController } from './controllers/list-finance-tags.controller';
import type { CreateFinanceTagController } from './controllers/create-finance-tag.controller';
import type { UpdateFinanceTagController } from './controllers/update-finance-tag.controller';
import type { ListFinanceEntriesController } from './controllers/list-finance-entries.controller';
import type { CreateFinanceEntryController } from './controllers/create-finance-entry.controller';
import type { GetFinanceEntryController } from './controllers/get-finance-entry.controller';
import type { UpdateFinanceEntryController } from './controllers/update-finance-entry.controller';
import type { DeleteFinanceEntryController } from './controllers/delete-finance-entry.controller';
import type { ChangeFinanceKeyController } from './controllers/change-finance-key.controller';
import type { ConfirmVaultController } from './controllers/confirm-vault.controller';
import type { GetVaultStatusController } from './controllers/get-vault-status.controller';
import type { LockVaultController } from './controllers/lock-vault.controller';
import type { RecoverVaultController } from './controllers/recover-vault.controller';
import type { SetupVaultController } from './controllers/setup-vault.controller';
import type { UnlockVaultController } from './controllers/unlock-vault.controller';

export interface FinanceRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly getVaultStatusController: GetVaultStatusController;
  readonly setupVaultController: SetupVaultController;
  readonly confirmVaultController: ConfirmVaultController;
  readonly unlockVaultController: UnlockVaultController;
  readonly lockVaultController: LockVaultController;
  readonly changeFinanceKeyController: ChangeFinanceKeyController;
  readonly recoverVaultController: RecoverVaultController;
  readonly listFinanceTagsController: ListFinanceTagsController;
  readonly createFinanceTagController: CreateFinanceTagController;
  readonly updateFinanceTagController: UpdateFinanceTagController;
  readonly listFinanceEntriesController: ListFinanceEntriesController;
  readonly createFinanceEntryController: CreateFinanceEntryController;
  readonly getFinanceEntryController: GetFinanceEntryController;
  readonly updateFinanceEntryController: UpdateFinanceEntryController;
  readonly deleteFinanceEntryController: DeleteFinanceEntryController;
}

/** Finance responses carry keys or decrypted amounts; never let them be cached. */
const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Mounts finance routes under the prefix chosen by the composition root (/finance).
 * Admin only (ADR-0014). Data routes need `X-Finance-Session` from /unlock.
 */
export function createFinanceRouter(deps: FinanceRouterDeps): Router {
  const router = Router();

  router.use(noStore);
  router.use(deps.bearerMiddleware);

  router.get('/vault', deps.getVaultStatusController.handle());
  router.post('/vault/setup', deps.setupVaultController.handle());
  router.post('/vault/confirm', deps.confirmVaultController.handle());
  router.post('/vault/change-key', deps.changeFinanceKeyController.handle());
  router.post('/vault/recover', deps.recoverVaultController.handle());
  router.post('/unlock', deps.unlockVaultController.handle());
  router.post('/lock', deps.lockVaultController.handle());

  router.get('/tags', deps.listFinanceTagsController.handle());
  router.post('/tags', deps.createFinanceTagController.handle());
  router.patch('/tags/:id', deps.updateFinanceTagController.handle());

  router.get('/entries', deps.listFinanceEntriesController.handle());
  router.post('/entries', deps.createFinanceEntryController.handle());
  router.get('/entries/:id', deps.getFinanceEntryController.handle());
  router.patch('/entries/:id', deps.updateFinanceEntryController.handle());
  router.delete('/entries/:id', deps.deleteFinanceEntryController.handle());

  return router;
}
