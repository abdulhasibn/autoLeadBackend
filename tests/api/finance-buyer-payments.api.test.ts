import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { api, BASE_URL, login, uniquePhone } from './support/client';

// BE-77: buyer payments follow the lead who paid (sale income and the new
// `refund` expense carry `leadId`; car money has `buyers[]` / `refundsOwed[]`;
// Dues, summary and cash flow carry the refunds-owed figures).
//
// Two layers, like finance-stock.api.test.ts:
//  1. Always on: request validation (the body is parsed before the finance
//     session is checked, so a bad body is 422 even while locked), 423/401/403
//     on every touched route, and that the new params are accepted by the
//     schema (a valid request without a session is 423, not 422).
//  2. Opt-in: set API_TEST_FINANCE_KEY to unlock, create owners, cars and
//     leads of its own, and check the real figures for AC 1-6 and 8. Every row
//     it creates is removed afterwards.

const FINANCE_KEY = process.env.API_TEST_FINANCE_KEY ?? '';
const NO_SESSION = '00000000-0000-4000-8000-0000000000aa';
const SOME_UUID = '00000000-0000-4000-8000-0000000000bb';
const DAY = '2026-11-20';

let adminToken: string;
let salesToken: string;

beforeAll(async () => {
  const ctx = inject('apiContext');
  adminToken = await login(ctx.admin.email);
  salesToken = await login(ctx.salesperson.email);
});

const expense = { kind: 'expense', amount: 1000, entryDate: DAY, vehicleId: SOME_UUID };

describe('POST /finance/entries (BE-77 validation)', () => {
  it('returns 422 VALIDATION_ERROR for a malformed leadId', async () => {
    const res = await api('POST', '/finance/entries', {
      token: adminToken,
      body: { ...expense, purpose: 'refund', leadId: 'not-a-uuid' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for an unknown purpose (refund is the only new one)', async () => {
    const res = await api('POST', '/finance/entries', {
      token: adminToken,
      body: { ...expense, purpose: 'forfeit' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts purpose refund and a uuid or null leadId (locked: 423, not 422)', async () => {
    for (const leadId of [SOME_UUID, null]) {
      const res = await api('POST', '/finance/entries', {
        token: adminToken,
        body: { ...expense, purpose: 'refund', leadId },
      });
      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('FINANCE_LOCKED');
    }
  });

  it('returns 401 without a token', async () => {
    const res = await api('POST', '/finance/entries', {
      body: { ...expense, purpose: 'refund' },
    });
    expect(res.status).toBe(401);
  });

  it('refuses a salesperson (403, or 423 when the session check comes first)', async () => {
    const res = await api('POST', '/finance/entries', {
      token: salesToken,
      body: { ...expense, purpose: 'refund' },
    });
    expect([403, 423]).toContain(res.status);
  });
});

describe('PATCH /finance/entries/:id (BE-77 validation)', () => {
  it('returns 422 VALIDATION_ERROR for a malformed leadId', async () => {
    const res = await api('PATCH', `/finance/entries/${SOME_UUID}`, {
      token: adminToken,
      body: { leadId: 'nope' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for a non-boolean keepLead', async () => {
    const res = await api('PATCH', `/finance/entries/${SOME_UUID}`, {
      token: adminToken,
      body: { keepLead: 'yes' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts leadId (uuid or null), keepLead and purpose refund (locked: 423)', async () => {
    for (const body of [
      { leadId: SOME_UUID },
      { leadId: null },
      { keepLead: true, vehicleId: SOME_UUID },
      { purpose: 'refund' },
    ]) {
      const res = await api('PATCH', `/finance/entries/${SOME_UUID}`, { token: adminToken, body });
      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('FINANCE_LOCKED');
    }
  });

  it('returns 401 without a token and refuses a salesperson', async () => {
    expect((await api('PATCH', `/finance/entries/${SOME_UUID}`, { body: {} })).status).toBe(401);
    const res = await api('PATCH', `/finance/entries/${SOME_UUID}`, {
      token: salesToken,
      body: { leadId: null },
    });
    expect([403, 423]).toContain(res.status);
  });
});

describe('GET /finance/entries (leadId filter)', () => {
  it('returns 422 VALIDATION_ERROR for a leadId without vehicleId', async () => {
    const res = await api('GET', `/finance/entries?leadId=${SOME_UUID}&from=${DAY}&to=${DAY}`, {
      token: adminToken,
    });
    // The rule is enforced where the query is parsed; when it is only checked
    // after the session, a locked admin sees 423 instead.
    expect([422, 423]).toContain(res.status);
    if (res.status === 422) expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for a malformed leadId', async () => {
    const res = await api('GET', `/finance/entries?leadId=not-a-uuid&vehicleId=${SOME_UUID}`, {
      token: adminToken,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /finance/vehicles/:id/sale (BE-77 params)', () => {
  const sale = { finalisedPrice: 600000, soldOn: DAY, leadId: SOME_UUID };
  const path = `/finance/vehicles/${SOME_UUID}/sale`;

  it('returns 422 VALIDATION_ERROR for buyerPayments other than "adjust"', async () => {
    for (const buyerPayments of ['delete', 'ADJUST', true, 1]) {
      const res = await api('POST', path, { token: adminToken, body: { ...sale, buyerPayments } });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts buyerPayments "adjust" (or null) (locked: 423)', async () => {
    for (const buyerPayments of ['adjust', null]) {
      const res = await api('POST', path, { token: adminToken, body: { ...sale, buyerPayments } });
      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('FINANCE_LOCKED');
    }
  });

  it('returns 401 without a token and refuses a salesperson', async () => {
    expect((await api('POST', path, { body: sale })).status).toBe(401);
    const res = await api('POST', path, { token: salesToken, body: sale });
    expect([403, 423]).toContain(res.status);
  });
});

describe('DELETE /finance/vehicles/:id/sale (withBuyerPayments)', () => {
  const path = `/finance/vehicles/${SOME_UUID}/sale`;

  it('returns 422 VALIDATION_ERROR for a non-boolean withBuyerPayments', async () => {
    const res = await api('DELETE', `${path}?withBuyerPayments=maybe`, { token: adminToken });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts withBuyerPayments=true|false (locked: 423)', async () => {
    for (const v of ['true', 'false']) {
      const res = await api('DELETE', `${path}?withBuyerPayments=${v}`, { token: adminToken });
      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('FINANCE_LOCKED');
    }
  });

  it('returns 401 without a token and refuses a salesperson', async () => {
    expect((await api('DELETE', path)).status).toBe(401);
    const res = await api('DELETE', `${path}?withBuyerPayments=true`, { token: salesToken });
    expect([403, 423]).toContain(res.status);
  });
});

const TOUCHED_GETS = [
  `/finance/vehicles/${SOME_UUID}`,
  `/finance/vehicles?vehicleIds=${SOME_UUID}`,
  '/finance/reports/dues',
  '/finance/summary',
  `/finance/reports/cash-flow?from=${DAY}&to=${DAY}&period=day`,
  `/finance/entries/${SOME_UUID}`,
];

describe.each(TOUCHED_GETS)('GET %s (locked)', (path) => {
  it('returns 401 without a token', async () => {
    expect((await api('GET', path)).status).toBe(401);
  });

  it('returns 423 FINANCE_LOCKED for an admin without a finance session', async () => {
    const res = await api('GET', path, { token: adminToken });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('FINANCE_LOCKED');
  });

  it('returns 423 FINANCE_LOCKED for a session token the server does not know', async () => {
    const res = await fetch(`${BASE_URL}${path}`, {
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

// ---------------------------------------------------------------------------
// Opt-in: real figures
// ---------------------------------------------------------------------------

const live = FINANCE_KEY === '' ? describe.skip : describe;

live('buyer payments by lead, real figures (needs API_TEST_FINANCE_KEY)', () => {
  let db: SupabaseClient;
  let session: string;
  let variant: { id: string; fuelType?: string; transmission?: string };
  let plateTag: string;
  let runId: string;
  let plateCounter = 0;
  let ownerId: string;
  // Tracked in outer scope so afterAll cleans up even when a test fails midway.
  const createdVehicleIds: string[] = [];
  const createdLeadIds: string[] = [];
  let createdOwnerId: string | null = null;

  const fin = (method: string, path: string, body?: unknown) =>
    financeFetch(method, path, adminToken, session, body);

  const newCar = async (): Promise<string> => {
    plateCounter += 1;
    const res = await api('POST', '/vehicles', {
      token: adminToken,
      body: {
        ownerId,
        variantId: variant.id,
        year: 2020,
        registrationNumber: `B${plateCounter}${plateTag}`,
        fuelType: variant.fuelType ?? 'petrol',
        transmission: variant.transmission ?? 'manual',
        kmDriven: 40000,
        numPreviousOwners: 1,
        colour: 'White',
        acquisitionType: 'dealership_purchase',
      },
    });
    if (res.status !== 201) throw new Error(`create vehicle failed (status ${res.status})`);
    createdVehicleIds.push(res.body.id as string);
    return res.body.id as string;
  };

  /** A new lead, attached to the car, with its booking confirmed. */
  const bookedLead = async (vehicleId: string, label: string): Promise<string> => {
    const created = await api('POST', '/leads', {
      token: adminToken,
      body: { fullName: `${runId} ${label}`, phone: uniquePhone(), source: 'walkin' },
    });
    if (created.status !== 201) throw new Error(`create lead failed (status ${created.status})`);
    const id = created.body.id as string;
    createdLeadIds.push(id);
    const attach = await api('PATCH', `/leads/${id}/vehicle`, {
      token: adminToken,
      body: { vehicleId },
    });
    if (attach.status !== 200) throw new Error(`attach vehicle failed (status ${attach.status})`);
    const book = await api('POST', `/leads/${id}/status`, {
      token: adminToken,
      body: { status: 'booking_confirmed' },
    });
    if (book.status !== 200) throw new Error(`book lead failed (status ${book.status})`);
    return id;
  };

  const markLost = async (leadId: string) => {
    const res = await api('POST', `/leads/${leadId}/status`, {
      token: adminToken,
      body: { status: 'lost' },
    });
    if (res.status !== 200) throw new Error(`mark lost failed (status ${res.status})`);
  };

  const payment = (
    vehicleId: string,
    leadId: string | undefined,
    amount: number,
    purpose: 'sale' | 'refund' = 'sale',
  ) =>
    fin('POST', '/finance/entries', {
      kind: purpose === 'sale' ? 'income' : 'expense',
      amount,
      entryDate: DAY,
      vehicleId,
      purpose,
      ...(leadId === undefined ? {} : { leadId }),
    });

  const carMoney = async (vehicleId: string) => {
    const res = await fin('GET', `/finance/vehicles/${vehicleId}`);
    expect(res.status).toBe(200);
    return res.body;
  };

  const dues = async () => {
    const res = await fin('GET', '/finance/reports/dues');
    expect(res.status).toBe(200);
    return res.body;
  };

  const owedRows = (body: any, vehicleId: string) =>
    (body.refundsOwed as any[]).filter((r) => r.vehicle.id === vehicleId);

  beforeAll(async () => {
    const ctx = inject('apiContext');
    runId = ctx.runId;
    plateTag = ctx.runId
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(-8);
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

    const makes = await api('GET', '/catalog/makes?limit=1', { token: adminToken });
    const model = await api('GET', `/catalog/makes/${makes.body.items[0].id}/models?limit=1`, {
      token: adminToken,
    });
    const variants = await api(
      'GET',
      `/catalog/models/${model.body.items[0].id}/variants?limit=1`,
      { token: adminToken },
    );
    variant = variants.body.items[0];

    const owner = await api('POST', '/owners', {
      token: adminToken,
      body: { fullName: `${runId} buyers owner`, phone: uniquePhone() },
    });
    expect(owner.status).toBe(201);
    ownerId = owner.body.id as string;
    createdOwnerId = ownerId;
  });

  afterAll(async () => {
    const cars = createdVehicleIds;
    const leads = createdLeadIds;
    if (db === undefined) return;
    if (cars.length > 0) {
      await db.from('finance_entries').delete().in('vehicle_id', cars);
      await db.from('vehicle_quotes').delete().in('vehicle_id', cars);
      await db.from('vehicle_financials').delete().in('vehicle_id', cars);
      // A sold car points at its lead and a lead at its car: cut both first.
      await db.from('vehicles').update({ sold_lead_id: null }).in('id', cars);
    }
    if (leads.length > 0) {
      const rows = await db.from('leads').select('contact_id').in('id', leads);
      await db.from('follow_ups').delete().in('lead_id', leads);
      await db.from('lead_status_history').delete().in('lead_id', leads);
      await db.from('leads').delete().in('id', leads);
      const contacts = (rows.data ?? [])
        .map((r) => r.contact_id as string | null)
        .filter((id): id is string => id !== null);
      if (contacts.length > 0) await db.from('contacts').delete().in('id', contacts);
    }
    if (cars.length > 0) {
      await db.from('vehicle_status_history').delete().in('vehicle_id', cars);
      await db.from('vehicles').delete().in('id', cars);
    }
    if (createdOwnerId !== null) await db.from('owners').delete().eq('id', createdOwnerId);
    if (session !== undefined) await fin('POST', '/finance/lock').catch(() => undefined);
  });

  it('AC1: a Lost buyer’s token is owed back, in car money and Dues', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC1 A');
    const entry = await payment(car, a, 50000);
    expect(entry.status).toBe(201);
    expect(entry.body.purpose).toBe('sale');
    expect(entry.body.lead).toMatchObject({ id: a });
    await markLost(a);

    const money = await carMoney(car);
    expect(money.receivedFromBuyer).toBe(0);
    expect(money.buyers).toEqual([]);
    expect(money.refundsOwed).toHaveLength(1);
    expect(money.refundsOwed[0]).toMatchObject({ paid: 50000, refunded: 0, owed: 50000 });
    expect(money.refundsOwed[0].lead).toMatchObject({ id: a });
    expect(typeof money.refundsOwed[0].lead.name).toBe('string');

    const report = await dues();
    const rows = owedRows(report, car);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ paid: 50000, refunded: 0, owed: 50000 });
    expect(rows[0].lead.id).toBe(a);
    expect(typeof rows[0].vehicle.label).toBe('string');
    expect(report.totals.owedBackToBuyers).toBeGreaterThanOrEqual(50000);
    // A car whose only due is a refund is not an `items` row.
    expect(report.items.find((i: any) => i.vehicle.id === car)).toBeUndefined();

    const summary = await fin('GET', '/finance/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.owedBackToBuyers).toBe(report.totals.owedBackToBuyers);
  });

  it('AC2: a new buyer’s sale is theirs; the Lost lead’s token stays owed back', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC2 A');
    expect((await payment(car, a, 50000)).status).toBe(201);
    await markLost(a);
    const b = await bookedLead(car, 'AC2 B');

    const sale = await fin('POST', `/finance/vehicles/${car}/sale`, {
      finalisedPrice: 600000,
      soldOn: DAY,
      leadId: b,
      buyerPayment: { amount: 600000, paidOn: DAY },
    });
    expect(sale.status).toBe(200);

    const entries = await fin('GET', `/finance/entries?vehicleId=${car}&leadId=${b}`);
    expect(entries.status).toBe(200);
    const sales = (entries.body.items as any[]).filter((e) => e.purpose === 'sale');
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ kind: 'income', amount: 600000 });
    expect(sales[0].lead).toMatchObject({ id: b });

    const money = await carMoney(car);
    expect(money.owedByBuyer).toBe(0);
    expect(money.receivedFromBuyer).toBe(600000);
    expect(money.buyers).toHaveLength(1);
    expect(money.buyers[0]).toMatchObject({ paid: 600000, refunded: 0, net: 600000 });
    expect(money.buyers[0].lead.id).toBe(b);
    expect(money.refundsOwed).toHaveLength(1);
    expect(money.refundsOwed[0]).toMatchObject({ owed: 50000 });
    expect(money.refundsOwed[0].lead.id).toBe(a);
  });

  it('AC3: a sale to A is accepted although B paid; B is owed back', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC3 A');
    const b = await bookedLead(car, 'AC3 B');
    expect((await payment(car, b, 100000)).status).toBe(201);

    const sale = await fin('POST', `/finance/vehicles/${car}/sale`, {
      finalisedPrice: 500000,
      soldOn: DAY,
      leadId: a,
      buyerPayment: { amount: 450000, paidOn: DAY },
    });
    expect(sale.status).toBe(200);

    const money = await carMoney(car);
    expect(money.owedByBuyer).toBe(50000);
    const owedB = (money.refundsOwed as any[]).find((r) => r.lead?.id === b);
    expect(owedB).toMatchObject({ paid: 100000, refunded: 0, owed: 100000 });
    const buyerA = (money.buyers as any[]).find((r) => r.lead.id === a);
    expect(buyerA).toMatchObject({ paid: 450000, net: 450000 });
  });

  it('AC3: a price below the sale lead’s own payments is refused with per-lead figures', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC3b A');
    expect((await payment(car, a, 300000)).status).toBe(201);
    const sale = await fin('POST', `/finance/vehicles/${car}/sale`, {
      finalisedPrice: 250000,
      soldOn: DAY,
      leadId: a,
    });
    expect(sale.status).toBe(422);
    expect(sale.body.error.code).toBe('SALE_PRICE_BELOW_RECEIVED');
    expect(sale.body.error.details).toMatchObject({
      receivedFromBuyer: 300000,
      finalisedPrice: 250000,
    });
  });

  it('AC4: refunding the whole token clears Dues, lands in cash flow, leaves P&L alone', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC4 A');
    expect((await payment(car, a, 50000)).status).toBe(201);
    await markLost(a);

    const range = `from=${DAY}&to=${DAY}&period=day`;
    const pnlBefore = await fin('GET', `/finance/reports/pnl?${range}`);
    const flowBefore = await fin('GET', `/finance/reports/cash-flow?${range}`);
    expect(pnlBefore.status).toBe(200);
    expect(flowBefore.status).toBe(200);

    const refund = await payment(car, a, 50000, 'refund');
    expect(refund.status).toBe(201);
    expect(refund.body).toMatchObject({ kind: 'expense', purpose: 'refund', amount: 50000 });
    expect(refund.body.lead).toMatchObject({ id: a });

    const money = await carMoney(car);
    expect(money.refundsOwed).toEqual([]);
    expect(owedRows(await dues(), car)).toEqual([]);

    const flowAfter = await fin('GET', `/finance/reports/cash-flow?${range}`);
    expect(flowAfter.status).toBe(200);
    expect(flowAfter.body.totals.outRefundsToBuyers).toBe(
      flowBefore.body.totals.outRefundsToBuyers + 50000,
    );
    expect(flowAfter.body.totals.out).toBe(flowBefore.body.totals.out + 50000);
    const bucket = flowAfter.body.buckets[0];
    expect(typeof bucket.outRefundsToBuyers).toBe('number');

    const pnlAfter = await fin('GET', `/finance/reports/pnl?${range}`);
    expect(pnlAfter.body.totals).toEqual(pnlBefore.body.totals);
  });

  it('AC5: a refund above what the lead paid is 422 REFUND_ABOVE_PAID with details', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC5 A');
    expect((await payment(car, a, 50000)).status).toBe(201);
    await markLost(a);

    const res = await payment(car, a, 60000, 'refund');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFUND_ABOVE_PAID');
    expect(res.body.error.details).toMatchObject({
      paid: 50000,
      refunded: 0,
      requested: 60000,
      refundable: 50000,
    });
    expect((await carMoney(car)).refundsOwed[0]).toMatchObject({ owed: 50000 });
  });

  it('AC5: a refund with no leadId is 422 REFUND_LEAD_REQUIRED when two leads can be refunded', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC5b A');
    const b = await bookedLead(car, 'AC5b B');
    expect((await payment(car, a, 10000)).status).toBe(201);
    expect((await payment(car, b, 20000)).status).toBe(201);

    const res = await payment(car, undefined, 5000, 'refund');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFUND_LEAD_REQUIRED');
    expect([...res.body.error.details.leadIds].sort()).toEqual([a, b].sort());
  });

  it('AC6: a buyer payment with two booked leads and no leadId is 422 SALE_LEAD_REQUIRED', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC6 A');
    const b = await bookedLead(car, 'AC6 B');

    const res = await payment(car, undefined, 25000);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SALE_LEAD_REQUIRED');
    expect([...res.body.error.details.bookedLeadIds].sort()).toEqual([a, b].sort());

    // A lead that isn't on the car is refused too.
    const stranger = await bookedLead(await newCar(), 'AC6 stranger');
    const wrong = await payment(car, stranger, 25000);
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.code).toBe('SALE_LEAD_NOT_ON_CAR');
    expect(wrong.body.error.details).toMatchObject({ leadId: stranger });
  });

  it('AC8: removing the sale with buyer payments deletes only the sold lead’s entries', async () => {
    const car = await newCar();
    const a = await bookedLead(car, 'AC8 A');
    const b = await bookedLead(car, 'AC8 B');
    expect((await payment(car, a, 30000)).status).toBe(201);
    expect((await payment(car, b, 40000)).status).toBe(201);
    const sale = await fin('POST', `/finance/vehicles/${car}/sale`, {
      finalisedPrice: 100000,
      soldOn: DAY,
      leadId: a,
    });
    expect(sale.status).toBe(200);

    const removed = await financeFetch(
      'DELETE',
      `/finance/vehicles/${car}/sale?withBuyerPayments=true`,
      adminToken,
      session,
    );
    expect(removed.status).toBe(204);

    const entries = await fin('GET', `/finance/entries?vehicleId=${car}`);
    expect(entries.status).toBe(200);
    const left = (entries.body.items as any[]).filter((e) => e.purpose === 'sale');
    expect(left).toHaveLength(1);
    expect(left[0].lead.id).toBe(b);
    expect(left[0].amount).toBe(40000);

    const money = await carMoney(car);
    const owedB = (money.refundsOwed as any[]).find((r) => r.lead?.id === b);
    expect(owedB).toMatchObject({ paid: 40000, owed: 40000 });
  });
});

async function financeFetch(
  method: string,
  path: string,
  token: string,
  session: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    'x-finance-session': session,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text.length > 0 ? JSON.parse(text) : null };
}
