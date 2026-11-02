import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import { FinanceLockedError } from '../application/errors/finance-locked.error';
import { AddVehicleQuoteUseCase } from '../application/use-cases/add-vehicle-quote.use-case';
import { ClearVehicleSaleUseCase } from '../application/use-cases/clear-vehicle-sale.use-case';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { CreateFinanceEntryUseCase } from '../application/use-cases/create-finance-entry.use-case';
import { DeleteVehicleQuoteUseCase } from '../application/use-cases/delete-vehicle-quote.use-case';
import { GetVehicleFinanceUseCase } from '../application/use-cases/get-vehicle-finance.use-case';
import { ListFinanceTagsUseCase } from '../application/use-cases/list-finance-tags.use-case';
import { ListVehicleFinanceSummariesUseCase } from '../application/use-cases/list-vehicle-finance-summaries.use-case';
import { ListVehicleQuotesUseCase } from '../application/use-cases/list-vehicle-quotes.use-case';
import { ListVehiclesAwaitingSalePriceUseCase } from '../application/use-cases/list-vehicles-awaiting-sale-price.use-case';
import { RecordVehicleSaleUseCase } from '../application/use-cases/record-vehicle-sale.use-case';
import { SetVehicleDealUseCase } from '../application/use-cases/set-vehicle-deal.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import {
  ADMIN,
  CRETA,
  DELETED_CAR,
  SALESPERSON,
  SWIFT,
  TEST_KDF,
  createFinanceTestKit,
  type FinanceTestKit,
} from './fakes';

describe('car money', () => {
  let kit: FinanceTestKit;
  let token: string;
  let tagIds: Record<string, string>;
  let createEntry: CreateFinanceEntryUseCase;
  let getFinance: GetVehicleFinanceUseCase;
  let setDeal: SetVehicleDealUseCase;
  let recordSale: RecordVehicleSaleUseCase;
  let clearSale: ClearVehicleSaleUseCase;
  let addQuote: AddVehicleQuoteUseCase;
  let listQuotes: ListVehicleQuotesUseCase;
  let deleteQuote: DeleteVehicleQuoteUseCase;
  let summaries: ListVehicleFinanceSummariesUseCase;
  let awaiting: ListVehiclesAwaitingSalePriceUseCase;

  beforeEach(async () => {
    kit = createFinanceTestKit();
    const k = kit;
    const keys = await new SetupVaultUseCase(
      k.policy,
      k.vaults,
      k.keyring,
      k.crypto,
      k.audit,
      k.clock,
      k.ids,
      TEST_KDF,
    ).execute(ADMIN);
    await new ConfirmVaultUseCase(k.policy, k.vaults, k.keyring, k.audit, k.clock).execute(
      { recoveryKey: keys.recoveryKey },
      ADMIN,
    );
    token = (
      await new UnlockVaultUseCase(
        k.policy,
        k.vaults,
        k.keyring,
        k.sessionService,
        k.audit,
        k.clock,
        k.tagSeeder,
      ).execute({ financeKey: keys.financeKey }, ADMIN)
    ).sessionToken;
    const tags = await new ListFinanceTagsUseCase(
      k.policy,
      k.sessionService,
      k.tags,
      k.tagSealer,
    ).execute({ sessionToken: token, includeArchived: false }, ADMIN);
    tagIds = Object.fromEntries(tags.map((t) => [t.name, t.id]));

    createEntry = new CreateFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.clock,
      k.ids,
    );
    getFinance = new GetVehicleFinanceUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.entries,
      k.quotes,
      k.tags,
      k.dealSealer,
      k.entrySealer,
      k.quoteSealer,
      k.tagSealer,
      k.clock,
    );
    setDeal = new SetVehicleDealUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.dealSealer,
      k.clock,
    );
    recordSale = new RecordVehicleSaleUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.dealSealer,
      k.clock,
    );
    clearSale = new ClearVehicleSaleUseCase(
      k.policy,
      k.sessionService,
      k.deals,
      k.dealSealer,
      k.clock,
    );
    addQuote = new AddVehicleQuoteUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.quotes,
      k.quoteSealer,
      k.clock,
      k.ids,
    );
    listQuotes = new ListVehicleQuotesUseCase(k.policy, k.sessionService, k.quotes, k.quoteSealer);
    deleteQuote = new DeleteVehicleQuoteUseCase(
      k.policy,
      k.sessionService,
      k.quotes,
      k.quoteSealer,
      k.clock,
    );
    summaries = new ListVehicleFinanceSummariesUseCase(
      k.policy,
      k.sessionService,
      k.deals,
      k.entries,
      k.quotes,
      k.dealSealer,
      k.entrySealer,
      k.quoteSealer,
      k.clock,
    );
    awaiting = new ListVehiclesAwaitingSalePriceUseCase(k.policy, k.sessionService, k.vehicles);
  });

  function entry(overrides: Partial<CreateFinanceEntryCommand>) {
    return createEntry.execute(
      {
        sessionToken: token,
        kind: 'expense',
        amountPaise: 100,
        entryDate: '2026-10-10',
        tagIds: [],
        vehicleId: SWIFT,
        purpose: null,
        party: null,
        note: null,
        showroomId: null,
        ...overrides,
      },
      ADMIN,
    );
  }

  const deal = (vehicleId: string, purchaseRatePaise: number, listedPricePaise?: number | null) =>
    setDeal.execute(
      {
        sessionToken: token,
        vehicleId,
        purchaseRatePaise,
        purchasedOn: '2026-10-01',
        ownerExpectedPricePaise: null,
        minimumSellingPricePaise: null,
        note: null,
        ...(listedPricePaise === undefined ? {} : { listedPricePaise }),
      },
      ADMIN,
    );

  async function clientExample(): Promise<void> {
    const tag = (name: string) => [tagIds[name] ?? ''];
    await deal(SWIFT, 50_000_000, 58_500_000);
    await entry({ amountPaise: 20_000_000, purpose: 'purchase', tagIds: tag('Purchase') });
    await entry({ amountPaise: 30_000_000, purpose: 'purchase', tagIds: tag('Purchase') });
    await entry({ amountPaise: 1_000_000, tagIds: tag('Mediator commission') });
    await entry({ amountPaise: 500_000, tagIds: tag('Painting') });
    await entry({ amountPaise: 500_000, tagIds: tag('Service') });
    await entry({ amountPaise: 500_000, tagIds: tag('Rubbing polish') });
    await entry({ amountPaise: 1_500_000, tagIds: [...tag('Insurance'), ...tag('Tyres')] });
    await entry({ amountPaise: 500_000, tagIds: [...tag('Travel'), ...tag('Fuel')] });
    await addQuote.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        amountPaise: 58_500_000,
        quotedOn: '2026-10-18',
        leadId: null,
        quotedTo: 'Anil',
        note: null,
      },
      ADMIN,
    );
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
      },
      ADMIN,
    );
    await entry({ kind: 'income', amountPaise: 5_000_000, note: 'Token' });
    await entry({ kind: 'income', amountPaise: 51_000_000, note: 'Balance' });
  }

  it("shows the client's worked example on the car's money tab", async () => {
    await clientExample();

    const money = await getFinance.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN);

    expect(money).toMatchObject({
      vehicle: { id: SWIFT, label: 'Maruti Swift · KA01AB1234' },
      deal: { purchaseRate: 500000, purchasedOn: '2026-10-01' },
      sale: { finalisedPrice: 560000, soldOn: '2026-10-25', soldBy: ADMIN.userId },
      listedPrice: 585000,
      currentQuote: { amount: 585000, quotedTo: 'Anil' },
      landingCost: 545000,
      costs: 45000,
      paidToSeller: 500000,
      receivedFromBuyer: 560000,
      profit: 15000,
      owedToSeller: 0,
      owedByBuyer: 0,
      flags: { purchaseRateMissing: false, saleRecorded: true },
    });
    expect(money.costBreakdown[0]).toEqual({
      tag: { id: tagIds['Insurance'], name: 'Insurance' },
      amount: 15000,
      count: 1,
    });
  });

  it('a car with no finance data yet shows zeros and flags', async () => {
    const money = await getFinance.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN);

    expect(money).toMatchObject({
      deal: null,
      sale: null,
      listedPrice: null,
      quotes: [],
      currentQuote: null,
      landingCost: 0,
      profit: null,
      owedToSeller: null,
      owedByBuyer: null,
      flags: { purchaseRateMissing: true, saleRecorded: false },
    });
  });

  it('replaces terms, keeps the listed price unless sent, and keeps the sale', async () => {
    await deal(SWIFT, 50_000_000, 58_500_000);
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
      },
      ADMIN,
    );

    const updated = await deal(SWIFT, 49_000_000);
    expect(updated).toMatchObject({
      deal: { purchaseRate: 490000 },
      listedPrice: 585000,
      sale: { finalisedPrice: 560000 },
    });
    expect((await deal(SWIFT, 49_000_000, null)).listedPrice).toBeNull();
  });

  it('records the sale price before terms exist, and clears it', async () => {
    const recorded = await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: CRETA,
        finalisedPricePaise: 70_000_000,
        soldOn: '2026-10-30',
      },
      ADMIN,
    );
    expect(recorded).toMatchObject({ deal: null, sale: { finalisedPrice: 700000 } });

    await clearSale.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN);
    await clearSale.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN);

    expect(
      (await getFinance.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN)).sale,
    ).toBeNull();
    expect(kit.deals.rows.get(CRETA)?.payload).toBeNull();
  });

  it('lists sold cars without a recorded sale', async () => {
    const creta = kit.vehicles.cars.get(CRETA);
    if (creta !== undefined) creta.sold = true;

    expect(await awaiting.execute({ sessionToken: token }, ADMIN)).toEqual([
      { vehicleId: CRETA, label: 'Hyundai Creta · KA05CD5678', soldLeadId: null },
    ]);

    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: CRETA,
        finalisedPricePaise: 70_000_000,
        soldOn: '2026-10-30',
      },
      ADMIN,
    );
    expect(await awaiting.execute({ sessionToken: token }, ADMIN)).toEqual([]);
  });

  it('keeps quotes newest first and soft deletes them', async () => {
    const add = (amountPaise: number, quotedOn: string) =>
      addQuote.execute(
        {
          sessionToken: token,
          vehicleId: SWIFT,
          amountPaise,
          quotedOn,
          leadId: null,
          quotedTo: null,
          note: null,
        },
        ADMIN,
      );
    const first = await add(60_000_000, '2026-10-10');
    await add(58_500_000, '2026-10-18');

    expect(
      (await listQuotes.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN)).map(
        (q) => q.amount,
      ),
    ).toEqual([585000, 600000]);

    await deleteQuote.execute({ sessionToken: token, vehicleId: SWIFT, quoteId: first.id }, ADMIN);
    await expect(
      deleteQuote.execute({ sessionToken: token, vehicleId: CRETA, quoteId: first.id }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await listQuotes.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN)).toHaveLength(
      1,
    );
  });

  it('summarises several cars in the order asked, including empty ones', async () => {
    await clientExample();
    await deal(CRETA, 70_000_000);
    await entry({ vehicleId: CRETA, amountPaise: 2_000_000 });

    const rows = await summaries.execute(
      { sessionToken: token, vehicleIds: [CRETA, SWIFT, DELETED_CAR] },
      ADMIN,
    );

    expect(rows).toEqual([
      {
        vehicleId: CRETA,
        purchaseRate: 700000,
        landingCost: 720000,
        currentQuote: null,
        finalisedPrice: null,
        profit: null,
        owedToSeller: 700000,
        owedByBuyer: null,
      },
      {
        vehicleId: SWIFT,
        purchaseRate: 500000,
        landingCost: 545000,
        currentQuote: 585000,
        finalisedPrice: 560000,
        profit: 15000,
        owedToSeller: 0,
        owedByBuyer: 0,
      },
      {
        vehicleId: DELETED_CAR,
        purchaseRate: null,
        landingCost: 0,
        currentQuote: null,
        finalisedPrice: null,
        profit: null,
        owedToSeller: null,
        owedByBuyer: null,
      },
    ]);
  });

  it('rejects writes to unknown or deleted cars, is locked without a session and admin-only', async () => {
    await expect(deal(DELETED_CAR, 100)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getFinance.execute(
        { sessionToken: token, vehicleId: '99999999-9999-4999-8999-999999999999' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getFinance.execute({ sessionToken: null, vehicleId: SWIFT }, ADMIN),
    ).rejects.toBeInstanceOf(FinanceLockedError);
    await expect(
      getFinance.execute({ sessionToken: token, vehicleId: SWIFT }, SALESPERSON),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    await expect(awaiting.execute({ sessionToken: token }, SALESPERSON)).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });
});
