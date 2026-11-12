import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
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
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { Money } from '../domain/money.value-object';
import { toVehicleQuoteId } from '../domain/vehicle-quote-id';
import { VehicleQuote } from '../domain/vehicle-quote.entity';
import {
  ADMIN,
  BALENO,
  LEAD_ANIL,
  LEAD_DELETED,
  CRETA,
  DELETED_CAR,
  SALESPERSON,
  SWIFT,
  TEST_KDF,
  createFinanceTestKit,
  markCarSold,
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
      k.leads,
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
      k.leadConversion,
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
      k.leads,
      k.quotes,
      k.quoteSealer,
      k.clock,
      k.ids,
    );
    listQuotes = new ListVehicleQuotesUseCase(
      k.policy,
      k.sessionService,
      k.quotes,
      k.leads,
      k.quoteSealer,
    );
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
      k.vehicles,
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
        commissionBasisPoints: null,
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
        leadId: LEAD_ANIL,
        quotedTo: 'Anil',
        note: null,
      },
      ADMIN,
    );
    markCarSold(kit, SWIFT);
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
        leadId: null,
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
      currentQuote: {
        amount: 585000,
        quotedTo: 'Anil',
        leadId: LEAD_ANIL,
        lead: { id: LEAD_ANIL, name: 'Anil Kumar', phone: '+919876500001' },
      },
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
    markCarSold(kit, SWIFT);
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
        leadId: null,
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
    markCarSold(kit, CRETA);
    const recorded = await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: CRETA,
        finalisedPricePaise: 70_000_000,
        soldOn: '2026-10-30',
        leadId: null,
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

  describe('closing the sale against a lead', () => {
    const sale = (leadId: string | null, finalisedPricePaise = 70_000_000) =>
      recordSale.execute(
        {
          sessionToken: token,
          vehicleId: CRETA,
          finalisedPricePaise,
          soldOn: '2026-11-01',
          leadId,
        },
        ADMIN,
      );

    it('needs a booked lead while the car is not sold, and saves nothing without one', async () => {
      await expect(sale(null)).rejects.toMatchObject({ code: 'SALE_NEEDS_BOOKED_LEAD' });
      await expect(sale(LEAD_ANIL)).rejects.toMatchObject({ code: 'SALE_LEAD_NOT_BOOKED' });
      expect(kit.deals.rows.get(CRETA)).toBeUndefined();
      expect(kit.vehicles.cars.get(CRETA)?.status).toBe('open');
    });

    it('shows the booked leads, converts the chosen one and records the price', async () => {
      kit.leads.booked.set(CRETA, [LEAD_ANIL]);
      const before = await getFinance.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN);
      expect(before.vehicle.status).toBe('open');
      expect(before.bookedLeads).toEqual([
        { id: LEAD_ANIL, name: 'Anil Kumar', phone: '+919876500001' },
      ]);

      const recorded = await sale(LEAD_ANIL);

      expect(recorded.sale).toMatchObject({ finalisedPrice: 700000, soldOn: '2026-11-01' });
      expect(kit.leadConversion.converted).toEqual([{ vehicleId: CRETA, leadId: LEAD_ANIL }]);
      const after = await getFinance.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN);
      expect(after.vehicle.status).toBe('sold');
      expect(after.bookedLeads).toEqual([]);
    });

    it('checks the price before converting the lead', async () => {
      kit.leads.booked.set(CRETA, [LEAD_ANIL]);
      await expect(sale(LEAD_ANIL, 0)).rejects.toBeInstanceOf(BusinessRuleViolationError);
      expect(kit.leadConversion.converted).toEqual([]);
      expect(kit.vehicles.cars.get(CRETA)?.status).toBe('open');
    });

    it('a car already sold through the CRM takes the price alone', async () => {
      markCarSold(kit, CRETA);
      await sale(null);
      expect(kit.leadConversion.converted).toEqual([]);
      expect(
        (await getFinance.execute({ sessionToken: token, vehicleId: CRETA }, ADMIN)).sale,
      ).toMatchObject({ finalisedPrice: 700000 });
    });
  });

  it('lists sold cars without a recorded sale', async () => {
    const creta = kit.vehicles.cars.get(CRETA);
    if (creta !== undefined) creta.status = 'sold';

    expect(await awaiting.execute({ sessionToken: token }, ADMIN)).toEqual([
      { vehicleId: CRETA, label: 'Hyundai Creta · KA05CD5678', soldLeadId: null },
    ]);

    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: CRETA,
        finalisedPricePaise: 70_000_000,
        soldOn: '2026-10-30',
        leadId: null,
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
          leadId: LEAD_ANIL,
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

  it('needs a live lead for a quote and returns its name and phone', async () => {
    const add = (leadId: string) =>
      addQuote.execute(
        {
          sessionToken: token,
          vehicleId: SWIFT,
          amountPaise: 58_500_000,
          quotedOn: '2026-10-18',
          leadId,
          quotedTo: null,
          note: null,
        },
        ADMIN,
      );

    await expect(add('99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(NotFoundError);
    await expect(add(LEAD_DELETED)).rejects.toBeInstanceOf(NotFoundError);
    const added = await add(LEAD_ANIL);

    expect(added.lead).toEqual({ id: LEAD_ANIL, name: 'Anil Kumar', phone: '+919876500001' });
    expect(
      (await listQuotes.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN))[0]?.lead,
    ).toEqual({ id: LEAD_ANIL, name: 'Anil Kumar', phone: '+919876500001' });
  });

  it('still reads older quotes recorded without a lead', async () => {
    const { cipher } = await kit.sessionService.open(ADMIN, token);
    const legacy = VehicleQuote.create({
      id: toVehicleQuoteId('33333333-3333-4333-8333-000000000009'),
      vehicleId: SWIFT,
      leadId: null,
      quotedOn: CalendarDate.create('2026-10-01'),
      amount: Money.fromRupees(600000),
      quotedTo: 'Walk-in',
      note: null,
      createdBy: ADMIN.userId,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    });
    await kit.quotes.save(kit.quoteSealer.seal(legacy, cipher));

    const [quote] = await listQuotes.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN);

    expect(quote).toMatchObject({ leadId: null, lead: null, quotedTo: 'Walk-in' });
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
        saleModel: 'purchase',
        purchaseRate: 700000,
        commissionPercent: null,
        landingCost: 720000,
        currentQuote: null,
        finalisedPrice: null,
        profit: null,
        owedToSeller: 700000,
        owedByBuyer: null,
      },
      {
        vehicleId: SWIFT,
        saleModel: 'purchase',
        purchaseRate: 500000,
        commissionPercent: null,
        landingCost: 545000,
        currentQuote: 585000,
        finalisedPrice: 560000,
        profit: 15000,
        owedToSeller: 0,
        owedByBuyer: 0,
      },
      {
        vehicleId: DELETED_CAR,
        saleModel: 'purchase',
        purchaseRate: null,
        commissionPercent: null,
        landingCost: 0,
        currentQuote: null,
        finalisedPrice: null,
        profit: null,
        owedToSeller: null,
        owedByBuyer: null,
      },
    ]);
  });

  it('a commission car takes a %, earns it on the sale and owes the owner the rest', async () => {
    const baleno = kit.vehicles.cars.get(BALENO);
    if (baleno === undefined) throw new Error('missing BALENO');
    baleno.saleModel = 'commission';
    const setCommission = (
      commissionBasisPoints: number | null,
      purchaseRatePaise: number | null,
    ) =>
      setDeal.execute(
        {
          sessionToken: token,
          vehicleId: BALENO,
          purchaseRatePaise,
          commissionBasisPoints,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );

    await expect(setCommission(null, 50_000_000)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
    const set = await setCommission(400, 50_000_000);
    expect(set.deal).toMatchObject({ commissionPercent: 4, purchaseRate: null });

    await entry({ vehicleId: BALENO, amountPaise: 1_000_000 }); // ₹10,000 cost
    markCarSold(kit, BALENO);
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: BALENO,
        finalisedPricePaise: 50_000_000,
        soldOn: '2026-10-25',
        leadId: null,
      },
      ADMIN,
    );

    const money = await getFinance.execute({ sessionToken: token, vehicleId: BALENO }, ADMIN);
    expect(money).toMatchObject({
      vehicle: { saleModel: 'commission' },
      commission: 20000,
      profit: 20000,
      landingCost: 10000,
      owedToSeller: 500000 - 20000 - 10000,
      flags: { purchaseRateMissing: false, saleRecorded: true },
    });
  });

  it('a purchase car needs a purchase rate', async () => {
    await expect(
      setDeal.execute(
        {
          sessionToken: token,
          vehicleId: SWIFT,
          purchaseRatePaise: null,
          commissionBasisPoints: 300,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
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
