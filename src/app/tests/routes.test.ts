import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/environment';
import { composeApp } from '../composition-root';

const ID = '11111111-1111-4111-8111-111111111111';

const PROTECTED_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['get', '/auth/me'],
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
  ['get', `/leads/${ID}`],
  ['patch', `/leads/${ID}/vehicle`],
  ['put', `/leads/${ID}/assignment`],
  ['post', `/leads/${ID}/status`],
  ['post', `/leads/${ID}/follow-ups`],
  ['get', '/notifications'],
  ['patch', `/notifications/${ID}/read`],
];

function testConfig(): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    logLevel: 'silent',
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
