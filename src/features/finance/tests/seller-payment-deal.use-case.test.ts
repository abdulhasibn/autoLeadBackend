import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import type { SetVehicleDealCommand } from '../application/dtos/set-vehicle-deal-command';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import type { CreateFinanceEntryUseCase } from '../application/use-cases/create-finance-entry.use-case';
import { GetVehicleFinanceUseCase } from '../application/use-cases/get-vehicle-finance.use-case';
import type { SetVehicleDealUseCase } from '../application/use-cases/set-vehicle-deal.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import type { UpdateFinanceEntryUseCase } from '../application/use-cases/update-finance-entry.use-case';
import {
  ADMIN,
  CRETA,
  SWIFT,
  TEST_KDF,
  createFinanceTestKit,
  makeCreateEntry,
  makeSetDeal,
  makeUpdateEntry,
  type FinanceTestKit,
} from './fakes';

/** ₹8,80,000 in paise. */
const RATE = 88_000_000;

describe('payments to the seller are tied to the deal', () => {
  let kit: FinanceTestKit;
  let token: string;
  let createEntry: CreateFinanceEntryUseCase;
  let updateEntry: UpdateFinanceEntryUseCase;
  let setDeal: SetVehicleDealUseCase;
  let getFinance: GetVehicleFinanceUseCase;

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
    createEntry = makeCreateEntry(k);
    updateEntry = makeUpdateEntry(k);
    setDeal = makeSetDeal(k);
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
  });

  const pay = (overrides: Partial<CreateFinanceEntryCommand> = {}) =>
    createEntry.execute(
      {
        sessionToken: token,
        kind: 'expense',
        amountPaise: RATE,
        entryDate: '2026-11-22',
        tagIds: [],
        vehicleId: SWIFT,
        purpose: 'purchase',
        party: null,
        note: null,
        showroomId: null,
        ...overrides,
      },
      ADMIN,
    );

  const terms = (purchaseRatePaise: number) => ({
    purchaseRatePaise,
    commissionBasisPoints: null,
    purchasedOn: '2026-11-20',
  });

  const setTerms = (overrides: Partial<SetVehicleDealCommand> = {}) =>
    setDeal.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        purchaseRatePaise: RATE,
        commissionBasisPoints: null,
        purchasedOn: '2026-11-20',
        ownerExpectedPricePaise: null,
        minimumSellingPricePaise: null,
        note: null,
        ...overrides,
      },
      ADMIN,
    );

  const money = () => getFinance.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN);

  const rejection = async (promise: Promise<unknown>): Promise<BusinessRuleViolationError> => {
    const err = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(BusinessRuleViolationError);
    return err as BusinessRuleViolationError;
  };

  it('refuses a payment to the seller on a car with no deal', async () => {
    expect((await rejection(pay())).code).toBe('DEAL_TERMS_REQUIRED');
    expect(kit.entries.rows.size).toBe(0);
  });

  it('saves the deal sent with the payment, and both show on the money tab', async () => {
    await pay({ deal: terms(RATE) });

    expect(await money()).toMatchObject({
      deal: { purchaseRate: 880000, purchasedOn: '2026-11-20' },
      paidToSeller: 880000,
      owedToSeller: 0,
      landingCost: 880000,
      sellerPaymentStatus: 'full',
      flags: { purchaseRateMissing: false, paidWithoutTerms: false },
    });
  });

  it('ignores the sent deal when the car already has terms', async () => {
    await setTerms();
    await pay({ amountPaise: 10_000_000, deal: terms(1_000_000) });

    expect(await money()).toMatchObject({
      deal: { purchaseRate: 880000 },
      sellerPaymentStatus: 'part',
    });
  });

  it('refuses a deal whose field does not fit the sale model', async () => {
    const err = await rejection(
      pay({ deal: { purchaseRatePaise: null, commissionBasisPoints: 500, purchasedOn: null } }),
    );
    expect(err.code).toBe('INVALID_DEAL_TERMS');
    expect(kit.entries.rows.size).toBe(0);
    expect(kit.deals.rows.size).toBe(0);
  });

  it('a commission car needs its commission % before a payout', async () => {
    const creta = kit.vehicles.cars.get(CRETA);
    if (creta !== undefined) creta.saleModel = 'commission';
    expect((await rejection(pay({ vehicleId: CRETA }))).code).toBe('DEAL_TERMS_REQUIRED');
  });

  it('puts the payment back when the deal save fails', async () => {
    const save = kit.deals.save.bind(kit.deals);
    kit.deals.save = async () => {
      throw new Error('db down');
    };
    await expect(pay({ deal: terms(RATE) })).rejects.toThrow('db down');
    kit.deals.save = save;

    const rows = [...kit.entries.rows.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).not.toBeNull();
    expect((await money()).paidToSeller).toBe(0);
  });

  describe('overpayment', () => {
    beforeEach(async () => {
      await setTerms();
      await pay();
    });

    it('refuses a second payment above the rate, unless kept', async () => {
      const err = await rejection(pay({ amountPaise: 100_000 }));
      expect(err.code).toBe('SELLER_PAID_ABOVE_RATE');
      expect(err.details).toEqual({ paidToSeller: 881000, owedLimit: 880000, overpaidBy: 1000 });

      await pay({ amountPaise: 100_000, keepOverpayment: true });
      expect(await money()).toMatchObject({ owedToSeller: -1000, sellerPaymentStatus: 'overpaid' });
    });

    it('refuses raising a payment above the rate', async () => {
      const [id] = kit.entries.rows.keys();
      const err = await rejection(
        updateEntry.execute(
          { sessionToken: token, entryId: id ?? '', amountPaise: RATE + 1 },
          ADMIN,
        ),
      );
      expect(err.code).toBe('SELLER_PAID_ABOVE_RATE');
    });

    it('refuses turning a car cost into a payment that overpays', async () => {
      const cost = await pay({ amountPaise: 500_000, purpose: 'cost' });
      const err = await rejection(
        updateEntry.execute({ sessionToken: token, entryId: cost.id, purpose: 'purchase' }, ADMIN),
      );
      expect(err.code).toBe('SELLER_PAID_ABOVE_RATE');
    });

    it('refuses lowering the rate below what was paid, unless kept', async () => {
      const err = await rejection(setTerms({ purchaseRatePaise: RATE - 100 }));
      expect(err.code).toBe('SELLER_PAID_ABOVE_RATE');
      await setTerms({ purchaseRatePaise: RATE - 100, keepOverpayment: true });
      expect((await money()).sellerPaymentStatus).toBe('overpaid');
    });

    it('still allows edits that do not add to an existing overpayment', async () => {
      await pay({ amountPaise: 100_000, keepOverpayment: true });
      const [id] = kit.entries.rows.keys();
      await expect(
        updateEntry.execute({ sessionToken: token, entryId: id ?? '', note: 'Cheque' }, ADMIN),
      ).resolves.toMatchObject({ note: 'Cheque' });
    });
  });

  it('editing an old payment on a car with no deal is still allowed', async () => {
    // A payment saved before payments needed a deal.
    await setTerms();
    const old = await pay();
    kit.deals.rows.clear();
    await expect(
      updateEntry.execute({ sessionToken: token, entryId: old.id, note: 'Bank transfer' }, ADMIN),
    ).resolves.toMatchObject({ note: 'Bank transfer' });
    expect(await money()).toMatchObject({
      sellerPaymentStatus: 'no_terms',
      flags: { purchaseRateMissing: true, paidWithoutTerms: true },
    });
  });

  describe('deal with a seller payment', () => {
    it('saves the deal and its payment in one request', async () => {
      await setTerms({ sellerPayment: { amountPaise: 30_000_000, paidOn: '2026-11-21' } });
      expect(await money()).toMatchObject({
        paidToSeller: 300000,
        owedToSeller: 580000,
        sellerPaymentStatus: 'part',
      });
    });

    it('refuses a payment above the rate and saves nothing', async () => {
      const err = await rejection(
        setTerms({ sellerPayment: { amountPaise: RATE + 100, paidOn: '2026-11-21' } }),
      );
      expect(err.code).toBe('SELLER_PAID_ABOVE_RATE');
      expect(kit.entries.rows.size).toBe(0);
      expect(kit.deals.rows.size).toBe(0);
    });

    it('soft-deletes the payment when the deal save fails', async () => {
      kit.deals.save = async () => {
        throw new Error('db down');
      };
      await expect(
        setTerms({ sellerPayment: { amountPaise: RATE, paidOn: '2026-11-21' } }),
      ).rejects.toThrow('db down');
      const rows = [...kit.entries.rows.values()];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.deletedAt).not.toBeNull();
    });
  });
});
