import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/environment';
import { composeApp } from '../composition-root';

const ID = '11111111-1111-4111-8111-111111111111';

const PROTECTED_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['get', '/auth/me'],
  ['post', '/auth/logout'],
  ['post', '/auth/change-password'],
  ['post', '/users'],
  ['get', '/users'],
  ['get', `/users/${ID}`],
  ['patch', `/users/${ID}`],
  ['put', `/users/${ID}/roles`],
  ['delete', `/users/${ID}`],
  ['post', '/owners'],
  ['get', '/owners'],
  ['get', `/owners/${ID}`],
  ['patch', `/owners/${ID}`],
  ['delete', `/owners/${ID}`],
  ['get', '/catalog/makes'],
  ['get', `/catalog/makes/${ID}/models`],
  ['get', `/catalog/models/${ID}/variants`],
  ['post', '/vehicles'],
  ['get', '/vehicles'],
  ['get', `/vehicles/${ID}`],
  ['patch', `/vehicles/${ID}`],
  ['put', `/vehicles/${ID}/listed-price`],
  ['post', `/vehicles/${ID}/status`],
  ['get', `/vehicles/${ID}/status-history`],
  ['post', `/vehicles/${ID}/media/uploads`],
  ['post', `/vehicles/${ID}/media`],
  ['get', `/vehicles/${ID}/media`],
  ['delete', `/vehicles/${ID}/media/${ID}`],
  ['post', `/vehicles/${ID}/documents/uploads`],
  ['post', `/vehicles/${ID}/documents`],
  ['get', `/vehicles/${ID}/documents`],
  ['delete', `/vehicles/${ID}/documents/${ID}`],
  ['post', '/leads'],
  ['get', '/leads'],
  ['get', `/leads/vehicle-matches/${ID}`],
  ['get', `/leads/${ID}`],
  ['get', `/leads/${ID}/vehicle-matches`],
  ['patch', `/leads/${ID}/vehicle`],
  ['put', `/leads/${ID}/assignment`],
  ['post', `/leads/${ID}/status`],
  ['post', `/leads/${ID}/follow-ups`],
  ['get', `/leads/${ID}/follow-ups`],
  ['post', `/leads/${ID}/follow-ups/${ID}/complete`],
  ['post', `/leads/${ID}/follow-ups/${ID}/cancel`],
  ['get', '/notifications'],
  ['patch', `/notifications/${ID}/read`],
  ['get', '/dashboard'],
  ['get', '/finance/vault'],
  ['post', '/finance/vault/setup'],
  ['post', '/finance/vault/confirm'],
  ['post', '/finance/vault/change-key'],
  ['post', '/finance/vault/recover'],
  ['post', '/finance/unlock'],
  ['post', '/finance/lock'],
  ['get', '/finance/tags'],
  ['post', '/finance/tags'],
  ['patch', `/finance/tags/${ID}`],
  ['get', '/finance/entries'],
  ['post', '/finance/entries'],
  ['get', `/finance/entries/${ID}`],
  ['patch', `/finance/entries/${ID}`],
  ['delete', `/finance/entries/${ID}`],
  ['get', '/finance/vehicles'],
  ['get', '/finance/vehicles/awaiting-sale-price'],
  ['get', `/finance/vehicles/${ID}`],
  ['put', `/finance/vehicles/${ID}`],
  ['post', `/finance/vehicles/${ID}/sale`],
  ['delete', `/finance/vehicles/${ID}/sale`],
  ['get', `/finance/vehicles/${ID}/quotes`],
  ['post', `/finance/vehicles/${ID}/quotes`],
  ['delete', `/finance/vehicles/${ID}/quotes/${ID}`],
  ['get', '/finance/reports/pnl'],
  ['get', '/finance/reports/cash-flow'],
  ['get', '/finance/reports/vehicle-profit'],
  ['get', '/finance/reports/dues'],
  ['get', '/finance/reports/stock'],
  ['get', '/finance/summary'],
  ['get', '/insights/traffic'],
  ['get', '/insights/vehicles'],
  ['get', `/insights/vehicles/${ID}`],
  ['get', '/insights/demand'],
  ['get', `/insights/leads/${ID}`],
];

function testConfig(): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    logLevel: 'silent',
    businessTimeZone: 'Asia/Kolkata',
    publicSiteOrigins: ['http://localhost:3002'],
    pushDispatchSecret: null,
    expoAccessToken: null,
    supabase: {
      url: 'https://test-project.supabase.co',
      anonKey: 'test-anon-key',
      serviceRoleKey: 'test-service-role-key',
      jwtSecret: 'test-jwt-secret-at-least-32-characters-long',
    },
  };
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

describe('protected routes', () => {
  const { app } = composeApp(testConfig());

  it.each(PROTECTED_ROUTES)('%s %s answers 401 without a bearer token', async (method, path) => {
    const response = await supertest(app)[method as Method](path).send({});

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'AUTHENTICATION_FAILED' } });
  });

  it('rejects a non-bearer authorization header', async () => {
    const response = await supertest(app).get('/leads').set('Authorization', 'Basic abc');

    expect(response.status).toBe(401);
  });
});

describe('public password routes', () => {
  const { app } = composeApp(testConfig());

  it.each([
    ['/auth/forgot-password', { email: 'nope' }],
    ['/auth/reset-password', { email: 'ada@example.com', code: '12', newPassword: 'new-secret-1' }],
  ])('POST %s answers 422 for a malformed body without a bearer token', async (path, body) => {
    const response = await supertest(app).post(path).send(body);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('public marketplace routes', () => {
  const { app } = composeApp(testConfig());

  it('validates a test-drive request without a bearer token', async () => {
    const response = await supertest(app)
      .post('/public/test-drive-requests')
      .send({ vehicleId: ID, fullName: 'Asha', phone: '123' });

    expect(response.status).toBe(422);
  });

  it('sends the configured origin, not a wildcard, to the website', async () => {
    const response = await supertest(app)
      .options('/public/vehicles')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3002');
  });

  it('lets other origins load /public responses (CORP cross-origin), staff routes stay same-origin', async () => {
    const publicResponse = await supertest(app).get('/public/nope');
    const staffResponse = await supertest(app).get('/health');

    expect(publicResponse.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(staffResponse.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('answers a malformed analytics beacon with 204 and the site origin', async () => {
    const response = await supertest(app)
      .post('/public/events')
      .set('Origin', 'http://localhost:3002')
      .set('Content-Type', 'text/plain')
      .send('{"events":[]}');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3002');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('answers unknown public paths with 404', async () => {
    const response = await supertest(app).get('/public/nope');

    expect(response.status).toBe(404);
  });
});
