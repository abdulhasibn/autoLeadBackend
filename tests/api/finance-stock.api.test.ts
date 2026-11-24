import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { api, login } from './support/client';

// BE-78: the Stock report and the dashboard summary measure cash actually paid
// out on unsold cars (seller payments + costs), not the agreed rate.
//
// Two layers:
//  1. Always on: auth, session lock (423) and query validation for both
//     endpoints. The suite can't know the vault key, so this is as far as it
//     gets without one.
//  2. Opt-in: set API_TEST_FINANCE_KEY to the finance key of the target
//     database and the suite unlocks, creates its own owner and cars, records
//     entries and checks the row fields, the totals and the sort order. All
//     rows it creates are removed afterwards. Assertions only look at the
//     suite's own cars, so a database that already holds other stock is fine.

const FINANCE_KEY = process.env.API_TEST_FINANCE_KEY ?? '';
const NO_SESSION = '00000000-0000-4000-8000-0000000000aa';

let adminToken: string;
let salesToken: string;

beforeAll(async () => {
  const ctx = inject('apiContext');
  adminToken = await login(ctx.admin.email);
  salesToken = await login(ctx.salesperson.email);
});

describe.each(['/finance/reports/stock', '/finance/summary'])('GET %s (locked)', (path) => {
  it('returns 401 without a token', async () => {
    const res = await api('GET', path);
    expect(res.status).toBe(401);
  });

  it('returns 423 FINANCE_LOCKED for an admin without a finance session', async () => {
    const res = await api('GET', path, { token: adminToken });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('FINANCE_LOCKED');
  });

  it('returns 423 FINANCE_LOCKED for a session token the server does not know', async () => {
    const res = await fetch(`${process.env.API_BASE_URL ?? 'http://localhost:3000'}${path}`, {
      headers: { authorization: `Bearer ${adminToken}`, 'x-finance-session': NO_SESSION },
    });
    expect(res.status).toBe(423);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FINANCE_LOCKED');
  });

  it('refuses a salesperson (403, or 423 when the session check comes first)', async () => {
    const res = await api('GET', path, { token: salesToken });
    expect([403, 423]).toContain(res.status);
    expect(typeof res.body.error.code).toBe('string');
  });
});

describe('GET /finance/reports/stock (query validation)', () => {
  it('returns 422 VALIDATION_ERROR for a malformed showroomId', async () => {
    const res = await api('GET', '/finance/reports/stock?showroomId=not-a-uuid', {
      token: adminToken,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Opt-in: real figures
// ---------------------------------------------------------------------------

interface Fixture {
  readonly ownerId: string;
  readonly purchasePaid: string; // rate 880000, paid 300000, cost 20000 => 320000
  readonly purchaseUnpaid: string; // rate 500000, nothing paid => 0
  readonly commissionAdvance: string; // advance 50000 => 50000
  readonly vehicleIds: string[];
}

const live = FINANCE_KEY === '' ? describe.skip : describe;

live('stock report with real figures (needs API_TEST_FINANCE_KEY)', () => {
  let db: SupabaseClient;
  let session: string;
  let fx: Fixture;
  const createdVehicleIds: string[] = [];
  let createdOwnerId: string | null = null;

  const fin = (method: string, path: string, body?: unknown) =>
    fetchJson(method, path, adminToken, session, body);

  beforeAll(async () => {
    const ctx = inject('apiContext');
    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const unlock = await api('POST', '/finance/unlock', {
      token: adminToken,
      body: { financeKey: FINANCE_KEY },
    });
    if (unlock.status !== 200) throw new Error(`unlock failed (status ${unlock.status})`);
    session = unlock.body.sessionToken as string;

    // Catalog: the first make -> model -> variant that exists.
    const makes = await api('GET', '/catalog/makes?limit=1', { token: adminToken });
    const model = await api('GET', `/catalog/makes/${makes.body.items[0].id}/models?limit=1`, {
      token: adminToken,
    });
    const variants = await api(
      'GET',
      `/catalog/models/${model.body.items[0].id}/variants?limit=1`,
      {
        token: adminToken,
      },
    );
    const variant = variants.body.items[0];

    const owner = await api('POST', '/owners', {
      token: adminToken,
      body: {
        fullName: `${ctx.runId} stock owner`,
        phone: `+919${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      },
    });
    expect(owner.status).toBe(201);
    createdOwnerId = owner.body.id as string;

    const vehicleIds = createdVehicleIds;
    const plateTag = ctx.runId
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(-8);
    const car = async (acquisitionType: string, n: number): Promise<string> => {
      const res = await api('POST', '/vehicles', {
        token: adminToken,
        body: {
          ownerId: owner.body.id,
          variantId: variant.id,
          year: 2020,
          registrationNumber: `T${n}${plateTag}`,
          fuelType: variant.fuelType ?? 'petrol',
          transmission: variant.transmission ?? 'manual',
          kmDriven: 40000,
          numPreviousOwners: 1,
          colour: 'White',
          acquisitionType,
        },
      });
      if (res.status !== 201) throw new Error(`create vehicle failed (status ${res.status})`);
      vehicleIds.push(res.body.id as string);
      return res.body.id as string;
    };

    const purchasePaid = await car('dealership_purchase', 1);
    const purchaseUnpaid = await car('dealership_purchase', 2);
    const commissionAdvance = await car('consignment', 3);
    fx = { ownerId: owner.body.id, purchasePaid, purchaseUnpaid, commissionAdvance, vehicleIds };

    const entry = (vehicleId: string, amount: number, purpose: string, extra = {}) =>
      fin('POST', '/finance/entries', {
        kind: 'expense',
        amount,
        entryDate: '2026-11-20',
        vehicleId,
        purpose,
        ...extra,
      });

    const a = await entry(purchasePaid, 300000, 'purchase', {
      deal: { purchaseRate: 880000, purchasedOn: '2026-11-18' },
    });
    expect(a.status).toBe(201);
    expect((await entry(purchasePaid, 20000, 'cost')).status).toBe(201);
    expect(
      (await fin('PUT', `/finance/vehicles/${purchaseUnpaid}`, { purchaseRate: 500000 })).status,
    ).toBe(200);
    const c = await entry(commissionAdvance, 50000, 'purchase', { deal: { commissionPercent: 5 } });
    expect(c.status).toBe(201);
  });

  afterAll(async () => {
    const ids = createdVehicleIds;
    if (ids.length > 0) {
      await db.from('finance_entries').delete().in('vehicle_id', ids);
      await db.from('vehicle_quotes').delete().in('vehicle_id', ids);
      await db.from('vehicle_financials').delete().in('vehicle_id', ids);
      await db.from('vehicle_status_history').delete().in('vehicle_id', ids);
      await db.from('vehicles').delete().in('id', ids);
    }
    if (createdOwnerId !== null) await db.from('owners').delete().eq('id', createdOwnerId);
    await fin('POST', '/finance/lock').catch(() => undefined);
  });

  it('carries paidToSeller and moneyInStock on each of our cars', async () => {
    const res = await fin('GET', '/finance/reports/stock');
    expect(res.status).toBe(200);
    const row = (id: string) => res.body.items.find((r: any) => r.vehicle.id === id);

    const paid = row(fx.purchasePaid);
    expect(paid).toMatchObject({
      paidToSeller: 300000,
      costs: 20000,
      purchaseRate: 880000,
      landingCost: 900000,
      moneyInStock: 320000,
    });
    expect(typeof paid.status).toBe('string');
    expect('currentQuote' in paid && 'listedPrice' in paid).toBe(true);

    // Agreed rate, nothing paid: listed, with no cash in it.
    expect(row(fx.purchaseUnpaid)).toMatchObject({
      paidToSeller: 0,
      purchaseRate: 500000,
      moneyInStock: 0,
    });
    // Commission car: an advance counts as cash paid.
    expect(row(fx.commissionAdvance)).toMatchObject({ paidToSeller: 50000, moneyInStock: 50000 });
  });

  it('totals.moneyInStock is the sum of the rows and equals /finance/summary', async () => {
    const [stock, summary] = await Promise.all([
      fin('GET', '/finance/reports/stock'),
      fin('GET', '/finance/summary'),
    ]);
    expect(stock.status).toBe(200);
    expect(summary.status).toBe(200);
    expect(stock.body.totals.cars).toBe(stock.body.items.length);
    if (!stock.body.truncated) {
      const sum = (stock.body.items as { moneyInStock: number }[]).reduce(
        (acc, r) => acc + r.moneyInStock,
        0,
      );
      expect(Math.abs(stock.body.totals.moneyInStock - sum)).toBeLessThan(0.01);
    }
    expect(summary.body.moneyInStock).toBe(stock.body.totals.moneyInStock);
  });

  it('sorts rows by moneyInStock, biggest first', async () => {
    const res = await fin('GET', '/finance/reports/stock');
    const values = (res.body.items as { moneyInStock: number }[]).map((r) => r.moneyInStock);
    expect(values).toEqual([...values].sort((x, y) => y - x));
    const order = (res.body.items as any[])
      .map((r) => r.vehicle.id)
      .filter((id) => fx.vehicleIds.includes(id));
    expect(order).toEqual([fx.purchasePaid, fx.commissionAdvance, fx.purchaseUnpaid]);
  });
});

async function fetchJson(
  method: string,
  path: string,
  token: string,
  session: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const base = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    'x-finance-session': session,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text.length > 0 ? JSON.parse(text) : null };
}
