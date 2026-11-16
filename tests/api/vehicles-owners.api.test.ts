import { beforeAll, describe, expect, it } from 'vitest';

import { api, login } from './support/client';
import { inject } from 'vitest';

let adminToken: string;

beforeAll(async () => {
  adminToken = await login(inject('apiContext').admin.email);
});

describe.each(['/vehicles', '/owners'])('GET %s', (path) => {
  it('returns a 200 page with the pagination envelope', async () => {
    const res = await api('GET', `${path}?limit=3`, { token: adminToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(3);
    expect(res.body.limit).toBe(3);
    expect(res.body.offset).toBe(0);
    expect(typeof res.body.total).toBe('number');
    for (const item of res.body.items) expect(typeof item.id).toBe('string');
  });

  it('returns 422 for an invalid limit', async () => {
    const res = await api('GET', `${path}?limit=0`, { token: adminToken });
    expect(res.status).toBe(422);
  });

  it('returns 401 without a token', async () => {
    const res = await api('GET', path);
    expect(res.status).toBe(401);
  });
});

describe('GET /owners/:id', () => {
  it('returns 404 for an unknown id', async () => {
    const res = await api('GET', '/owners/00000000-0000-4000-8000-00000000dead', {
      token: adminToken,
    });
    expect(res.status).toBe(404);
  });
});
