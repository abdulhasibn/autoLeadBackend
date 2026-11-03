import { Router, type RequestHandler } from 'express';

import type { ListFinanceTagsController } from './controllers/list-finance-tags.controller';
import type { CreateFinanceTagController } from './controllers/create-finance-tag.controller';
import type { UpdateFinanceTagController } from './controllers/update-finance-tag.controller';
import type { ListFinanceEntriesController } from './controllers/list-finance-entries.controller';
import type { CreateFinanceEntryController } from './controllers/create-finance-entry.controller';
import type { GetFinanceEntryController } from './controllers/get-finance-entry.controller';
import type { UpdateFinanceEntryController } from './controllers/update-finance-entry.controller';
import type { DeleteFinanceEntryController } from './controllers/delete-finance-entry.controller';
import type { GetVehicleFinanceController } from './controllers/get-vehicle-finance.controller';
import type { SetVehicleDealController } from './controllers/set-vehicle-deal.controller';
import type { RecordVehicleSaleController } from './controllers/record-vehicle-sale.controller';
import type { ClearVehicleSaleController } from './controllers/clear-vehicle-sale.controller';
import type { ListVehicleQuotesController } from './controllers/list-vehicle-quotes.controller';
import type { AddVehicleQuoteController } from './controllers/add-vehicle-quote.controller';
import type { DeleteVehicleQuoteController } from './controllers/delete-vehicle-quote.controller';
import type { ListVehicleFinanceSummariesController } from './controllers/list-vehicle-finance-summaries.controller';
import type { ListVehiclesAwaitingSalePriceController } from './controllers/list-vehicles-awaiting-sale-price.controller';
import type { GetProfitAndLossController } from './controllers/get-profit-and-loss.controller';
import type { GetCashFlowController } from './controllers/get-cash-flow.controller';
import type { GetVehicleProfitReportController } from './controllers/get-vehicle-profit-report.controller';
import type { GetDuesReportController } from './controllers/get-dues-report.controller';
import type { GetStockReportController } from './controllers/get-stock-report.controller';
import type { GetFinanceSummaryController } from './controllers/get-finance-summary.controller';
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
  readonly getVehicleFinanceController: GetVehicleFinanceController;
  readonly setVehicleDealController: SetVehicleDealController;
  readonly recordVehicleSaleController: RecordVehicleSaleController;
  readonly clearVehicleSaleController: ClearVehicleSaleController;
  readonly listVehicleQuotesController: ListVehicleQuotesController;
  readonly addVehicleQuoteController: AddVehicleQuoteController;
  readonly deleteVehicleQuoteController: DeleteVehicleQuoteController;
  readonly listVehicleFinanceSummariesController: ListVehicleFinanceSummariesController;
  readonly listVehiclesAwaitingSalePriceController: ListVehiclesAwaitingSalePriceController;
  readonly getProfitAndLossController: GetProfitAndLossController;
  readonly getCashFlowController: GetCashFlowController;
  readonly getVehicleProfitReportController: GetVehicleProfitReportController;
  readonly getDuesReportController: GetDuesReportController;
  readonly getStockReportController: GetStockReportController;
  readonly getFinanceSummaryController: GetFinanceSummaryController;
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

  // Literal paths before `/vehicles/:vehicleId`.
  router.get('/vehicles', deps.listVehicleFinanceSummariesController.handle());
  router.get(
    '/vehicles/awaiting-sale-price',
    deps.listVehiclesAwaitingSalePriceController.handle(),
  );
  router.get('/vehicles/:vehicleId', deps.getVehicleFinanceController.handle());
  router.put('/vehicles/:vehicleId', deps.setVehicleDealController.handle());
  router.post('/vehicles/:vehicleId/sale', deps.recordVehicleSaleController.handle());
  router.delete('/vehicles/:vehicleId/sale', deps.clearVehicleSaleController.handle());
  router.get('/vehicles/:vehicleId/quotes', deps.listVehicleQuotesController.handle());
  router.post('/vehicles/:vehicleId/quotes', deps.addVehicleQuoteController.handle());
  router.delete('/vehicles/:vehicleId/quotes/:quoteId', deps.deleteVehicleQuoteController.handle());

  router.get('/reports/pnl', deps.getProfitAndLossController.handle());
  router.get('/reports/cash-flow', deps.getCashFlowController.handle());
  router.get('/reports/vehicle-profit', deps.getVehicleProfitReportController.handle());
  router.get('/reports/dues', deps.getDuesReportController.handle());
  router.get('/reports/stock', deps.getStockReportController.handle());
  router.get('/summary', deps.getFinanceSummaryController.handle());

  return router;
}
