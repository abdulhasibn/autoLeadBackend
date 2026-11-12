import { describe, expect, it, inject } from 'vitest';

import { api } from './support/client';

describe('GET /health', () => {
  it('returns 200 with status ok and an ISO timestamp', async () => {
    const res = await api('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});

describe('POST /auth/login', () => {
  it('returns 200 with access and refresh tokens for valid credentials', async () => {
    const { admin, password } = inject('apiContext');
    const res = await api('POST', '/auth/login', { body: { email: admin.email, password } });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('returns 401 for a wrong password', async () => {
    const { admin } = inject('apiContext');
    const res = await api('POST', '/auth/login', {
      body: { email: admin.email, password: 'definitely-wrong-password' },
    });
    expect(res.status).toBe(401);
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'nobody-apitest@example.test', password: 'whatever-password' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when the body is missing fields', async () => {
    const res = await api('POST', '/auth/login', { body: {} });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await api('GET', '/auth/me');
    expect(res.status).toBe(401);
  });
});
