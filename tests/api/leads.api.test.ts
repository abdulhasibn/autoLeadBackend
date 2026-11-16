import { beforeAll, describe, expect, it, inject } from 'vitest';

import { api, login, uniquePhone } from './support/client';

let adminToken: string;
let salesToken: string;
let otherSalesToken: string;

/** Lead created by the admin and assigned to the salesperson / other salesperson. */
let ownLeadId: string;
let otherLeadId: string;

async function createAssignedLead(assignee: string, label: string): Promise<string> {
  const { runId } = inject('apiContext');
  const created = await api('POST', '/leads', {
    token: adminToken,
    body: { fullName: `${runId} ${label}`, phone: uniquePhone(), source: 'walkin' },
  });
  expect(created.status).toBe(201);
  const assigned = await api('PUT', `/leads/${created.body.id}/assignment`, {
    token: adminToken,
    body: { assignedTo: assignee },
  });
  expect(assigned.status).toBe(200);
  return created.body.id as string;
}

/** PATCH /leads/:id is a full replace, so every update sends the required fields. */
function fullUpdate(label: string) {
  return {
    fullName: `${inject('apiContext').runId} ${label}`,
    phone: uniquePhone(),
    source: 'walkin',
  };
}

beforeAll(async () => {
  const ctx = inject('apiContext');
  adminToken = await login(ctx.admin.email);
  salesToken = await login(ctx.salesperson.email);
  otherSalesToken = await login(ctx.otherSalesperson.email);
  ownLeadId = await createAssignedLead(ctx.salesperson.id, 'own lead');
  otherLeadId = await createAssignedLead(ctx.otherSalesperson.id, 'other lead');
});

describe('POST /leads', () => {
  it('creates a lead (201) with the key fields', async () => {
    const { runId, admin, showroomId } = inject('apiContext');
    const phone = uniquePhone();
    const res = await api('POST', '/leads', {
      token: adminToken,
      body: { fullName: `${runId} create`, phone, source: 'phone', budget: 500000 },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      contactFullName: `${runId} create`,
      contactPhone: phone,
      source: 'phone',
      status: 'new',
      createdBy: admin.id,
      showroomId,
      assignedTo: null,
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number(res.body.budget)).toBe(500000);
  });

  it('assigns a salesperson-created lead to that salesperson', async () => {
    const { runId, salesperson } = inject('apiContext');
    const res = await api('POST', '/leads', {
      token: salesToken,
      body: { fullName: `${runId} sales-created`, phone: uniquePhone(), source: 'walkin' },
    });
    expect(res.status).toBe(201);
    expect(res.body.assignedTo).toBe(salesperson.id);
  });

  it('returns 422 VALIDATION_ERROR for missing required fields', async () => {
    const res = await api('POST', '/leads', { token: adminToken, body: {} });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for an invalid phone and an unknown source', async () => {
    const badPhone = await api('POST', '/leads', {
      token: adminToken,
      body: { fullName: 'x', phone: '12345', source: 'walkin' },
    });
    expect(badPhone.status).toBe(422);
    const badSource = await api('POST', '/leads', {
      token: adminToken,
      body: { fullName: 'x', phone: uniquePhone(), source: 'carrier-pigeon' },
    });
    expect(badSource.status).toBe(422);
  });

  it('returns 401 without a token', async () => {
    const res = await api('POST', '/leads', {
      body: { fullName: 'x', phone: uniquePhone(), source: 'walkin' },
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /leads', () => {
  it('returns a 200 page for admin with the pagination envelope', async () => {
    const res = await api('GET', '/leads?limit=5', { token: adminToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(0);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    const item = res.body.items[0];
    expect(typeof item.id).toBe('string');
    expect(typeof item.status).toBe('string');
    expect(typeof item.contactFullName).toBe('string');
  });

  it('honours offset and does not repeat items across pages', async () => {
    const first = await api('GET', '/leads?limit=1&offset=0', { token: adminToken });
    const second = await api('GET', '/leads?limit=1&offset=1', { token: adminToken });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.offset).toBe(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
  });

  it('returns 422 for an out-of-range limit', async () => {
    const res = await api('GET', '/leads?limit=100000', { token: adminToken });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('scopes a salesperson to their own leads', async () => {
    const { salesperson } = inject('apiContext');
    const res = await api('GET', '/leads?limit=100', { token: salesToken });
    expect(res.status).toBe(200);
    const ids = res.body.items.map((l: { id: string }) => l.id);
    expect(ids).toContain(ownLeadId);
    expect(ids).not.toContain(otherLeadId);
    for (const lead of res.body.items) expect(lead.assignedTo).toBe(salesperson.id);
  });

  it('returns 401 without a token', async () => {
    const res = await api('GET', '/leads');
    expect(res.status).toBe(401);
  });
});

describe('GET /leads/:id', () => {
  it('returns the lead to its assignee', async () => {
    const res = await api('GET', `/leads/${ownLeadId}`, { token: salesToken });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ownLeadId);
  });

  it('returns the lead to an admin', async () => {
    const res = await api('GET', `/leads/${otherLeadId}`, { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(otherLeadId);
  });

  it('hides another assignee lead from a salesperson (404 NOT_FOUND)', async () => {
    const res = await api('GET', `/leads/${otherLeadId}`, { token: salesToken });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await api('GET', '/leads/00000000-0000-4000-8000-00000000dead', {
      token: adminToken,
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 for a malformed id', async () => {
    const res = await api('GET', '/leads/not-a-uuid', { token: adminToken });
    expect(res.status).toBe(422);
  });

  it('returns 401 without a token', async () => {
    const res = await api('GET', `/leads/${ownLeadId}`);
    expect(res.status).toBe(401);
  });
});

describe('modifying another assignee lead', () => {
  it('PATCH /leads/:id by a non-assignee salesperson is 404 and changes nothing', async () => {
    const res = await api('PATCH', `/leads/${otherLeadId}`, {
      token: salesToken,
      body: { ...fullUpdate('hijack'), notes: 'hijack attempt' },
    });
    expect(res.status).toBe(404);
    const after = await api('GET', `/leads/${otherLeadId}`, { token: adminToken });
    expect(after.body.notes).not.toBe('hijack attempt');
  });

  it('POST /leads/:id/status by a non-assignee salesperson is 404', async () => {
    const res = await api('POST', `/leads/${otherLeadId}/status`, {
      token: salesToken,
      body: { status: 'not_now' },
    });
    expect(res.status).toBe(404);
  });

  it('PUT /leads/:id/assignment by a salesperson is 403 FORBIDDEN', async () => {
    const { salesperson } = inject('apiContext');
    const res = await api('PUT', `/leads/${ownLeadId}/assignment`, {
      token: salesToken,
      body: { assignedTo: salesperson.id },
    });
    expect(res.status).toBe(403);
    expect(typeof res.body.error.code).toBe('string');
  });

  it('PATCH /leads/:id by the assignee succeeds (200)', async () => {
    const res = await api('PATCH', `/leads/${ownLeadId}`, {
      token: salesToken,
      body: { ...fullUpdate('assignee'), notes: 'assignee update' },
    });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('assignee update');
  });

  it('other salesperson can still read their own lead', async () => {
    const res = await api('GET', `/leads/${otherLeadId}`, { token: otherSalesToken });
    expect(res.status).toBe(200);
  });
});
