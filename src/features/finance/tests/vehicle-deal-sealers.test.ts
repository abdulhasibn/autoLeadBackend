import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { QuoteSealer } from '../application/services/quote.sealer';
import { VehicleDealSealer } from '../application/services/vehicle-deal.sealer';
import { Money } from '../domain/money.value-object';
import { VehicleDeal } from '../domain/vehicle-deal.entity';
import { toVehicleQuoteId } from '../domain/vehicle-quote-id';
import { VehicleQuote } from '../domain/vehicle-quote.entity';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';
import { CRETA, dealTerms, SWIFT } from './fakes';

const crypto = new NodeFinanceCrypto();
const cipher = crypto.cipherFor(crypto.newDataKey(), 1);
const NOW = new Date('2026-11-02T10:00:00.000Z');
const ADMIN_ID = toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

function dealWithSale(): VehicleDeal {
  const deal = VehicleDeal.empty(SWIFT, Money.fromRupees(585000), NOW);
  deal.setTerms(
    {
      purchaseRate: Money.fromRupees(500000),
      commissionBasisPoints: null,
      purchasedOn: CalendarDate.create('2026-10-01'),
      ownerExpectedPrice: Money.fromRupees(520000),
      minimumSellingPrice: null,
      note: ' bought from Mr Rao ',
    },
    NOW,
  );
  deal.recordSale(Money.fromRupees(560000), CalendarDate.create('2026-10-25'), ADMIN_ID, NOW);
  return deal;
}

describe('VehicleDeal', () => {
  it('rejects non-positive prices', () => {
    const deal = VehicleDeal.empty(SWIFT, null, NOW);

    expect(() =>
      deal.setTerms(
        {
          purchaseRate: Money.zero(),
          commissionBasisPoints: null,
          purchasedOn: null,
          ownerExpectedPrice: null,
          minimumSellingPrice: null,
          note: null,
        },
        NOW,
      ),
    ).toThrow(BusinessRuleViolationError);
    expect(() =>
      deal.recordSale(Money.zero(), CalendarDate.create('2026-10-25'), ADMIN_ID, NOW),
    ).toThrow(BusinessRuleViolationError);
  });

  it('needs exactly one of a purchase rate or a commission % in range', () => {
    const deal = VehicleDeal.empty(SWIFT, null, NOW);
    const bad = [
      dealTerms(),
      dealTerms({ purchaseRate: Money.fromRupees(1), commissionBasisPoints: 100 }),
      dealTerms({ commissionBasisPoints: 0 }),
      dealTerms({ commissionBasisPoints: 10_001 }),
      dealTerms({ commissionBasisPoints: 2.5 }),
    ];
    for (const terms of bad) {
      expect(() => deal.setTerms(terms, NOW)).toThrow(BusinessRuleViolationError);
    }
    deal.setTerms(dealTerms({ commissionBasisPoints: 10_000 }), NOW);
    expect(deal.terms?.commissionBasisPoints).toBe(10_000);
  });

  it('records and clears a sale without touching the terms', () => {
    const deal = dealWithSale();
    deal.clearSale(NOW);

    expect(deal.sale).toBeNull();
    expect(deal.terms?.purchaseRate?.rupees).toBe(500000);
    expect(deal.terms?.note).toBe('bought from Mr Rao');
  });
});

describe('VehicleDealSealer', () => {
  const sealer = new VehicleDealSealer();

  it('round-trips terms and sale; only the listed price and sale date stay plaintext', () => {
    const sealed = sealer.seal(dealWithSale(), cipher);
    const opened = sealer.open(sealed, cipher);

    expect(sealed.listedPrice).toBe(585000);
    expect(sealed.soldOn).toBe('2026-10-25');
    expect(sealed.payload).not.toContain('Rao');
    expect(JSON.stringify({ ...sealed, payload: null })).not.toMatch(/500000|560000|Rao/);
    expect(opened.terms?.purchaseRate?.rupees).toBe(500000);
    expect(opened.terms?.ownerExpectedPrice?.rupees).toBe(520000);
    expect(opened.sale?.finalisedPrice.rupees).toBe(560000);
    expect(opened.sale?.soldBy).toBe(ADMIN_ID);
  });

  it('writes no payload for a car with only a listed price', () => {
    const sealed = sealer.seal(VehicleDeal.empty(SWIFT, Money.fromRupees(400000), NOW), cipher);

    expect(sealed.payload).toBeNull();
    expect(sealed.keyVersion).toBeNull();
    expect(sealer.open(sealed, cipher).terms).toBeNull();
  });

  it('round-trips commission terms', () => {
    const deal = VehicleDeal.empty(SWIFT, null, NOW);
    deal.setTerms(dealTerms({ commissionBasisPoints: 350 }), NOW);

    const opened = sealer.open(sealer.seal(deal, cipher), cipher);
    expect(opened.terms?.commissionBasisPoints).toBe(350);
    expect(opened.terms?.purchaseRate).toBeNull();
  });

  it('reads payloads sealed before commission sales', () => {
    const old = JSON.stringify({
      purchaseRate: 50_000_000,
      purchasedOn: null,
      ownerExpectedPrice: null,
      minimumSellingPrice: null,
      note: null,
      finalisedPrice: null,
    });
    const opened = sealer.open(
      {
        vehicleId: SWIFT,
        listedPrice: null,
        soldOn: null,
        soldBy: null,
        updatedAt: NOW,
        payload: cipher.seal(old, `vehicle_financials:${SWIFT}`),
        keyVersion: cipher.keyVersion,
      },
      cipher,
    );
    expect(opened.terms?.purchaseRate?.rupees).toBe(500000);
    expect(opened.terms?.commissionBasisPoints).toBeNull();
  });

  it("refuses another car's payload or a sale date without a price", () => {
    const sealed = sealer.seal(dealWithSale(), cipher);

    expect(() => sealer.open({ ...sealed, vehicleId: CRETA }, cipher)).toThrow(DataIntegrityError);
    expect(() => sealer.open({ ...sealed, soldOn: null }, cipher)).toThrow(DataIntegrityError);
    expect(() => sealer.open({ ...sealed, payload: null, keyVersion: null }, cipher)).toThrow(
      DataIntegrityError,
    );
  });
});

describe('QuoteSealer', () => {
  it('round-trips a quote and hides amount and person', () => {
    const sealer = new QuoteSealer();
    const quote = VehicleQuote.create({
      id: toVehicleQuoteId('33333333-3333-4333-8333-000000000001'),
      vehicleId: SWIFT,
      leadId: null,
      quotedOn: CalendarDate.create('2026-10-18'),
      amount: Money.fromRupees(585000),
      quotedTo: 'Anil Kumar',
      note: null,
      createdBy: ADMIN_ID,
      createdAt: NOW,
    });

    const sealed = sealer.seal(quote, cipher);
    const opened = sealer.open(sealed, cipher);

    expect(sealed.payload).not.toContain('Anil');
    expect(opened.amount.rupees).toBe(585000);
    expect(opened.quotedTo).toBe('Anil Kumar');
  });
});
