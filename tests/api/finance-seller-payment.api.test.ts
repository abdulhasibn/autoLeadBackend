import { beforeAll, describe, expect, inject, it } from 'vitest';

import { api, login } from './support/client';

// Contract for the deal fields that travel with a payment to the seller. The
// suite can't unlock finance (the vault key isn't known here), so it checks
// that the new fields are validated before the session and that a well-formed
// body reaches the session check (423) instead of being refused as invalid.
const CAR = '00000000-0000-4000-8000-00000000c0de';

let adminToken: string;

beforeAll(async () => {
  adminToken = await login(inject('apiContext').admin.email);
});

const payment = (extra: Record<string, unknown>) => ({
  kind: 'expense',
  amount: 880000,
  entryDate: '2026-11-22',
  vehicleId: CAR,
  purpose: 'purchase',
  ...extra,
});

describe('POST /finance/entries with deal terms', () => {
  it('accepts deal + keepOverpayment and then asks for the finance session', async () => {
    const res = await api('POST', '/finance/entries', {
      token: adminToken,
      body: payment({
        deal: { purchaseRate: 880000, purchasedOn: '2026-11-20' },
        keepOverpayment: false,
      }),
    });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('FINANCE_LOCKED');
  });

  it('returns 422 VALIDATION_ERROR for a non-positive purchase rate', async () => {
    const res = await api('POST', '/finance/entries', {
      token: adminToken,
      body: payment({ deal: { purchaseRate: 0 } }),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for a commission % above 100', async () => {
    const res = await api('POST', '/finance/entries', {
      token: adminToken,
      body: payment({ deal: { commissionPercent: 120 } }),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /finance/entries/:id with only deal terms', () => {
  it('returns 422 VALIDATION_ERROR: deal alone changes nothing', async () => {
    const res = await api('PATCH', `/finance/entries/${CAR}`, {
      token: adminToken,
      body: { deal: { purchaseRate: 880000 }, keepOverpayment: true },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /finance/vehicles/:id with a seller payment', () => {
  it('accepts sellerPayment and then asks for the finance session', async () => {
    const res = await api('PUT', `/finance/vehicles/${CAR}`, {
      token: adminToken,
      body: {
        purchaseRate: 880000,
        sellerPayment: { amount: 300000, paidOn: '2026-11-21' },
        keepOverpayment: false,
      },
    });
    expect(res.status).toBe(423);
  });

  it('returns 422 VALIDATION_ERROR for a seller payment without a date', async () => {
    const res = await api('PUT', `/finance/vehicles/${CAR}`, {
      token: adminToken,
      body: { purchaseRate: 880000, sellerPayment: { amount: 300000 } },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
