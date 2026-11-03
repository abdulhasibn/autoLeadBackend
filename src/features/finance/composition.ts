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
import { FinanceTagNameTakenError } from './application/errors/finance-tag-name-taken.error';
import { FinanceVaultNotConfirmedError } from './application/errors/finance-vault-not-confirmed.error';
import { InvalidFinanceKeyError } from './application/errors/invalid-finance-key.error';
import { FinancePolicy } from './application/policies/finance.policy';
import { DefaultTagSeeder } from './application/services/default-tag-seeder';
import { EntrySealer } from './application/services/entry.sealer';
import { FinanceReportData } from './application/services/finance-report-data';
import { FinanceSessionService } from './application/services/finance-session.service';
import { QuoteSealer } from './application/services/quote.sealer';
import { TagSealer } from './application/services/tag.sealer';
import { VehicleDealSealer } from './application/services/vehicle-deal.sealer';
import { VaultKeyring } from './application/services/vault-keyring';
import { CreateFinanceEntryUseCase } from './application/use-cases/create-finance-entry.use-case';
import { CreateFinanceTagUseCase } from './application/use-cases/create-finance-tag.use-case';
import { DeleteFinanceEntryUseCase } from './application/use-cases/delete-finance-entry.use-case';
import { GetFinanceEntryUseCase } from './application/use-cases/get-finance-entry.use-case';
import { ListFinanceEntriesUseCase } from './application/use-cases/list-finance-entries.use-case';
import { ListFinanceTagsUseCase } from './application/use-cases/list-finance-tags.use-case';
import { UpdateFinanceEntryUseCase } from './application/use-cases/update-finance-entry.use-case';
import { UpdateFinanceTagUseCase } from './application/use-cases/update-finance-tag.use-case';
import { GetVehicleFinanceUseCase } from './application/use-cases/get-vehicle-finance.use-case';
import { SetVehicleDealUseCase } from './application/use-cases/set-vehicle-deal.use-case';
import { RecordVehicleSaleUseCase } from './application/use-cases/record-vehicle-sale.use-case';
import { ClearVehicleSaleUseCase } from './application/use-cases/clear-vehicle-sale.use-case';
import { ListVehicleQuotesUseCase } from './application/use-cases/list-vehicle-quotes.use-case';
import { AddVehicleQuoteUseCase } from './application/use-cases/add-vehicle-quote.use-case';
import { DeleteVehicleQuoteUseCase } from './application/use-cases/delete-vehicle-quote.use-case';
import { ListVehicleFinanceSummariesUseCase } from './application/use-cases/list-vehicle-finance-summaries.use-case';
import { ListVehiclesAwaitingSalePriceUseCase } from './application/use-cases/list-vehicles-awaiting-sale-price.use-case';
import { GetProfitAndLossUseCase } from './application/use-cases/get-profit-and-loss.use-case';
import { GetCashFlowUseCase } from './application/use-cases/get-cash-flow.use-case';
import { GetVehicleProfitReportUseCase } from './application/use-cases/get-vehicle-profit-report.use-case';
import { GetDuesReportUseCase } from './application/use-cases/get-dues-report.use-case';
import { GetStockReportUseCase } from './application/use-cases/get-stock-report.use-case';
import { GetFinanceSummaryUseCase } from './application/use-cases/get-finance-summary.use-case';
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
import { SupabaseFinanceEntryQueries } from './infrastructure/supabase-finance-entry.queries';
import { SupabaseFinanceEntryRepository } from './infrastructure/supabase-finance-entry.repository';
import { SupabaseFinanceTagQueries } from './infrastructure/supabase-finance-tag.queries';
import { SupabaseFinanceTagRepository } from './infrastructure/supabase-finance-tag.repository';
import { SupabaseFinanceVehicleLookup } from './infrastructure/supabase-finance-vehicle.lookup';
import { SupabaseVehicleDealQueries } from './infrastructure/supabase-vehicle-deal.queries';
import { SupabaseVehicleDealRepository } from './infrastructure/supabase-vehicle-deal.repository';
import { SupabaseVehicleQuoteQueries } from './infrastructure/supabase-vehicle-quote.queries';
import { SupabaseVehicleQuoteRepository } from './infrastructure/supabase-vehicle-quote.repository';
import { SupabaseFinanceAuditLog } from './infrastructure/supabase-finance-audit-log';
import { SupabaseFinanceVaultQueries } from './infrastructure/supabase-finance-vault.queries';
import { SupabaseFinanceSessionRepository } from './infrastructure/supabase-finance-session.repository';
import { SupabaseFinanceVaultRepository } from './infrastructure/supabase-finance-vault.repository';
import { CreateFinanceEntryController } from './presentation/controllers/create-finance-entry.controller';
import { CreateFinanceTagController } from './presentation/controllers/create-finance-tag.controller';
import { DeleteFinanceEntryController } from './presentation/controllers/delete-finance-entry.controller';
import { GetFinanceEntryController } from './presentation/controllers/get-finance-entry.controller';
import { ListFinanceEntriesController } from './presentation/controllers/list-finance-entries.controller';
import { ListFinanceTagsController } from './presentation/controllers/list-finance-tags.controller';
import { UpdateFinanceEntryController } from './presentation/controllers/update-finance-entry.controller';
import { UpdateFinanceTagController } from './presentation/controllers/update-finance-tag.controller';
import { GetVehicleFinanceController } from './presentation/controllers/get-vehicle-finance.controller';
import { SetVehicleDealController } from './presentation/controllers/set-vehicle-deal.controller';
import { RecordVehicleSaleController } from './presentation/controllers/record-vehicle-sale.controller';
import { ClearVehicleSaleController } from './presentation/controllers/clear-vehicle-sale.controller';
import { ListVehicleQuotesController } from './presentation/controllers/list-vehicle-quotes.controller';
import { AddVehicleQuoteController } from './presentation/controllers/add-vehicle-quote.controller';
import { DeleteVehicleQuoteController } from './presentation/controllers/delete-vehicle-quote.controller';
import { ListVehicleFinanceSummariesController } from './presentation/controllers/list-vehicle-finance-summaries.controller';
import { ListVehiclesAwaitingSalePriceController } from './presentation/controllers/list-vehicles-awaiting-sale-price.controller';
import { GetProfitAndLossController } from './presentation/controllers/get-profit-and-loss.controller';
import { GetCashFlowController } from './presentation/controllers/get-cash-flow.controller';
import { GetVehicleProfitReportController } from './presentation/controllers/get-vehicle-profit-report.controller';
import { GetDuesReportController } from './presentation/controllers/get-dues-report.controller';
import { GetStockReportController } from './presentation/controllers/get-stock-report.controller';
import { GetFinanceSummaryController } from './presentation/controllers/get-finance-summary.controller';
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
  /** IANA timezone "today" is taken in for the summary (BUSINESS_TIMEZONE). */
  readonly timeZone: string;
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

  const entries = new SupabaseFinanceEntryRepository(infraClient);
  const entryQueries = new SupabaseFinanceEntryQueries(infraClient);
  const tags = new SupabaseFinanceTagRepository(infraClient);
  const tagQueries = new SupabaseFinanceTagQueries(infraClient);
  const vehicles = new SupabaseFinanceVehicleLookup(infraClient);
  const entrySealer = new EntrySealer();
  const tagSealer = new TagSealer();
  const tagSeeder = new DefaultTagSeeder(tags, tagSealer, deps.clock, ids);

  const deals = new SupabaseVehicleDealRepository(infraClient);
  const dealQueries = new SupabaseVehicleDealQueries(infraClient);
  const quotes = new SupabaseVehicleQuoteRepository(infraClient);
  const quoteQueries = new SupabaseVehicleQuoteQueries(infraClient);
  const dealSealer = new VehicleDealSealer();
  const quoteSealer = new QuoteSealer();
  const reportData = new FinanceReportData(
    dealQueries,
    entryQueries,
    quoteQueries,
    vehicles,
    dealSealer,
    entrySealer,
    quoteSealer,
  );

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
      new UnlockVaultUseCase(policy, vaults, keyring, sessionService, audit, deps.clock, tagSeeder),
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
    listFinanceTagsController: new ListFinanceTagsController(
      new ListFinanceTagsUseCase(policy, sessionService, tagQueries, tagSealer),
    ),
    createFinanceTagController: new CreateFinanceTagController(
      new CreateFinanceTagUseCase(policy, sessionService, tags, tagSealer, deps.clock, ids),
    ),
    updateFinanceTagController: new UpdateFinanceTagController(
      new UpdateFinanceTagUseCase(policy, sessionService, tags, tagSealer, deps.clock),
    ),
    listFinanceEntriesController: new ListFinanceEntriesController(
      new ListFinanceEntriesUseCase(
        policy,
        sessionService,
        entryQueries,
        tagQueries,
        vehicles,
        entrySealer,
        tagSealer,
      ),
    ),
    createFinanceEntryController: new CreateFinanceEntryController(
      new CreateFinanceEntryUseCase(
        policy,
        sessionService,
        entries,
        tags,
        vehicles,
        entrySealer,
        tagSealer,
        deps.clock,
        ids,
      ),
    ),
    getFinanceEntryController: new GetFinanceEntryController(
      new GetFinanceEntryUseCase(
        policy,
        sessionService,
        entryQueries,
        tagQueries,
        vehicles,
        entrySealer,
        tagSealer,
      ),
    ),
    updateFinanceEntryController: new UpdateFinanceEntryController(
      new UpdateFinanceEntryUseCase(
        policy,
        sessionService,
        entries,
        tags,
        vehicles,
        entrySealer,
        tagSealer,
        deps.clock,
      ),
    ),
    deleteFinanceEntryController: new DeleteFinanceEntryController(
      new DeleteFinanceEntryUseCase(policy, sessionService, entries, entrySealer, deps.clock),
    ),
    getVehicleFinanceController: new GetVehicleFinanceController(
      new GetVehicleFinanceUseCase(
        policy,
        sessionService,
        vehicles,
        dealQueries,
        entryQueries,
        quoteQueries,
        tagQueries,
        dealSealer,
        entrySealer,
        quoteSealer,
        tagSealer,
        deps.clock,
      ),
    ),
    setVehicleDealController: new SetVehicleDealController(
      new SetVehicleDealUseCase(policy, sessionService, vehicles, deals, dealSealer, deps.clock),
    ),
    recordVehicleSaleController: new RecordVehicleSaleController(
      new RecordVehicleSaleUseCase(policy, sessionService, vehicles, deals, dealSealer, deps.clock),
    ),
    clearVehicleSaleController: new ClearVehicleSaleController(
      new ClearVehicleSaleUseCase(policy, sessionService, deals, dealSealer, deps.clock),
    ),
    listVehicleQuotesController: new ListVehicleQuotesController(
      new ListVehicleQuotesUseCase(policy, sessionService, quoteQueries, quoteSealer),
    ),
    addVehicleQuoteController: new AddVehicleQuoteController(
      new AddVehicleQuoteUseCase(
        policy,
        sessionService,
        vehicles,
        quotes,
        quoteSealer,
        deps.clock,
        ids,
      ),
    ),
    deleteVehicleQuoteController: new DeleteVehicleQuoteController(
      new DeleteVehicleQuoteUseCase(policy, sessionService, quotes, quoteSealer, deps.clock),
    ),
    listVehicleFinanceSummariesController: new ListVehicleFinanceSummariesController(
      new ListVehicleFinanceSummariesUseCase(
        policy,
        sessionService,
        dealQueries,
        entryQueries,
        quoteQueries,
        dealSealer,
        entrySealer,
        quoteSealer,
        deps.clock,
      ),
    ),
    listVehiclesAwaitingSalePriceController: new ListVehiclesAwaitingSalePriceController(
      new ListVehiclesAwaitingSalePriceUseCase(policy, sessionService, vehicles),
    ),
    getProfitAndLossController: new GetProfitAndLossController(
      new GetProfitAndLossUseCase(policy, sessionService, reportData),
    ),
    getCashFlowController: new GetCashFlowController(
      new GetCashFlowUseCase(policy, sessionService, reportData),
    ),
    getVehicleProfitReportController: new GetVehicleProfitReportController(
      new GetVehicleProfitReportUseCase(policy, sessionService, reportData),
    ),
    getDuesReportController: new GetDuesReportController(
      new GetDuesReportUseCase(policy, sessionService, reportData),
    ),
    getStockReportController: new GetStockReportController(
      new GetStockReportUseCase(policy, sessionService, reportData),
    ),
    getFinanceSummaryController: new GetFinanceSummaryController(
      new GetFinanceSummaryUseCase(
        policy,
        sessionService,
        reportData,
        vehicles,
        deps.clock,
        deps.timeZone,
      ),
    ),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof FinanceLockedError) {
      return { status: 423, code: err.code, message: err.message };
    }
    if (
      err instanceof FinanceTagNameTakenError ||
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
