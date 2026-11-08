import express, { type RequestHandler } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import { createErrorHandlerMiddleware } from '../../../presentation/http/errors/error-handler.middleware';
import type { Logger } from '../../../shared/logging/logger.port';
import { createInsightsRouterWith } from '../composition';
import type { InsightsRange } from '../domain/insights.queries';
import { ADMIN, CITY, FakeClock, FakeInsightsQueries, LEAD, SALESPERSON, SHOWROOM } from './fakes';

const silent = { warn: () => {}, error: () => {}, info: () => {} } as unknown as Logger;

/** Stands in for the Supabase bearer check: `X-Test-Role: admin | salesperson`. */
const fakeBearer: RequestHandler = (req, _res, next) => {
  const role = req.header('x-test-role');
  if (role === undefined) {
    next(new AuthenticationRequiredError());
    return;
  }
  req.auth = role === 'admin' ? ADMIN : SALESPERSON;
  next();
};

function appWith(queries: FakeInsightsQueries) {
  const app = express();
  app.use(
    '/insights',
    createInsightsRouterWith(queries, {
      bearerMiddleware: fakeBearer,
      clock: new FakeClock(),
      timeZone: 'Asia/Kolkata',
    }),
  );
  app.use(createErrorHandlerMiddleware(silent));
  return app;
}

// Keys of the web app's fixtures (autoLeadFrontend src/features/insights/__fixtures__).
const PERIOD_KEYS = ['from', 'to'].sort();
const TRAFFIC_KEYS = [
  'campaigns',
  'channels',
  'cities',
  'devices',
  'leads',
  'period',
  'previous',
  'sessions',
  'visitorToLeadRate',
  'visitors',
].sort();
const TOTALS_KEYS = ['leads', 'sessions', 'visitorToLeadRate', 'visitors'].sort();
const CHANNEL_KEYS = [
  'bookings',
  'carViews',
  'channel',
  'leads',
  'sold',
  'testDriveOpens',
  'visitors',
].sort();
const CAMPAIGN_KEYS = ['bookings', 'campaign', 'content', 'leadRate', 'leads', 'visits'].sort();
const VEHICLE_ROW_KEYS = [
  'contactClicks',
  'daysInStock',
  'leadRate',
  'leads',
  'listedPrice',
  'repeatViewers',
  'signal',
  'testDriveOpens',
  'title',
  'topChannel',
  'uniqueViewers',
  'vehicleId',
  'views',
].sort();
const VEHICLE_DETAIL_KEYS = [
  ...VEHICLE_ROW_KEYS,
  'budgetContext',
  'channels',
  'daily',
  'period',
  'priceChanges',
].sort();
const PRICE_CHANGE_KEYS = ['after', 'at', 'before', 'from', 'to'].sort();
const DEMAND_KEYS = ['budgetBands', 'period', 'segments', 'zeroResultSearches'].sort();
const JOURNEY_KEYS = [
  'campaign',
  'channel',
  'content',
  'firstVisitAt',
  'galleryOpens',
  'intent',
  'otherCarsViewed',
  'visits',
  'viewsOfThisCar',
].sort();

const keys = (value: unknown) => Object.keys(value as object).sort();

const ENDPOINTS = [
  '/insights/traffic',
  '/insights/vehicles',
  `/insights/vehicles/${CITY}`,
  '/insights/demand',
  `/insights/leads/${LEAD}`,
];

describe('insights routes', () => {
  let queries: FakeInsightsQueries;

  beforeEach(() => {
    queries = new FakeInsightsQueries();
  });

  describe('access', () => {
    it.each(ENDPOINTS)('GET %s answers 401 without a session', async (path) => {
      const response = await supertest(appWith(queries)).get(path);

      expect(response.status).toBe(401);
      expect(queries.calls).toHaveLength(0);
    });

    it.each(ENDPOINTS)('GET %s answers 403 to a salesperson', async (path) => {
      const response = await supertest(appWith(queries))
        .get(path)
        .set('X-Test-Role', 'salesperson');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: { code: 'FORBIDDEN', message: 'Only admins can view insights' },
      });
      expect(queries.calls).toHaveLength(0);
    });

    it.each(ENDPOINTS)(
      'GET %s answers 200 to an admin with a private cache header',
      async (path) => {
        const response = await supertest(appWith(queries)).get(path).set('X-Test-Role', 'admin');

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('private, max-age=60');
      },
    );
  });

  describe('response shapes match the web app contract', () => {
    const get = (path: string) => supertest(appWith(queries)).get(path).set('X-Test-Role', 'admin');

    it('GET /insights/traffic', async () => {
      const { body } = await get('/insights/traffic');

      expect(keys(body)).toEqual(TRAFFIC_KEYS);
      expect(keys(body.period)).toEqual(PERIOD_KEYS);
      expect(keys(body.previous)).toEqual(TOTALS_KEYS);
      expect(keys(body.channels[0])).toEqual(CHANNEL_KEYS);
      expect(keys(body.campaigns[0])).toEqual(CAMPAIGN_KEYS);
      expect(keys(body.devices)).toEqual(['desktop', 'mobile']);
      expect(keys(body.cities[0])).toEqual(['city', 'visitors']);
    });

    it('GET /insights/vehicles', async () => {
      const { body } = await get('/insights/vehicles');

      expect(keys(body)).toEqual(['items', 'period']);
      expect(keys(body.items[0])).toEqual(VEHICLE_ROW_KEYS);
      expect(keys(body.items[0].signal)).toEqual(['code', 'reason']);
    });

    it('GET /insights/vehicles/:vehicleId', async () => {
      const { body } = await get(`/insights/vehicles/${CITY}?period=quarter`);

      expect(keys(body)).toEqual(VEHICLE_DETAIL_KEYS);
      expect(body.vehicleId).toBe(CITY);
      expect(keys(body.daily[0])).toEqual(['date', 'leads', 'views']);
      expect(keys(body.priceChanges[0])).toEqual(PRICE_CHANGE_KEYS);
      expect(keys(body.priceChanges[0].before)).toEqual(['leadsPerDay', 'viewsPerDay']);
      expect(keys(body.channels[0])).toEqual(['channel', 'views']);
      expect(keys(body.budgetContext)).toEqual(['segment', 'shareBelowPrice']);
    });

    it('GET /insights/demand', async () => {
      const { body } = await get('/insights/demand');

      expect(keys(body)).toEqual(DEMAND_KEYS);
      expect(keys(body.budgetBands[0])).toEqual(['band', 'searchShare', 'stockShare']);
      expect(keys(body.segments[0])).toEqual(['demandShare', 'gap', 'label', 'stockShare']);
      expect(keys(body.zeroResultSearches)).toEqual(['count', 'top']);
      expect(keys(body.zeroResultSearches.top[0])).toEqual(['count', 'label']);
    });

    it('GET /insights/leads/:leadId, with and without a journey', async () => {
      const { body } = await get(`/insights/leads/${LEAD}`);
      expect(keys(body)).toEqual(JOURNEY_KEYS);
      expect(keys(body.otherCarsViewed[0])).toEqual(['listedPrice', 'title', 'vehicleId', 'views']);

      queries.journey = { ...(queries.journey ?? body), hasAttribution: false };
      const none = await get(`/insights/leads/${LEAD}`);
      expect(keys(none.body)).toEqual(JOURNEY_KEYS);
      expect(none.body.intent).toBeNull();
    });
  });

  describe('periods', () => {
    const rangeOf = (args: readonly unknown[] | undefined, index: number) =>
      args?.[index] as InsightsRange;

    it('defaults to this month in Asia/Kolkata', async () => {
      const { body } = await supertest(appWith(queries))
        .get('/insights/traffic')
        .set('X-Test-Role', 'admin');

      expect(body.period).toEqual({
        from: '2026-11-01T00:00:00+05:30',
        to: '2026-11-30T23:59:59+05:30',
      });
      expect(rangeOf(queries.last('getTraffic'), 1).from.toISOString()).toBe(
        '2026-10-31T18:30:00.000Z',
      );
    });

    it.each([
      [
        'today',
        '2026-11-03T00:00:00+05:30',
        '2026-11-03T23:59:59+05:30',
        '2026-11-02T18:30:00.000Z',
      ],
      [
        'week',
        '2026-11-02T00:00:00+05:30',
        '2026-11-08T23:59:59+05:30',
        '2026-11-01T18:30:00.000Z',
      ],
      [
        'month',
        '2026-11-01T00:00:00+05:30',
        '2026-11-30T23:59:59+05:30',
        '2026-10-31T18:30:00.000Z',
      ],
      [
        'quarter',
        '2026-10-01T00:00:00+05:30',
        '2026-12-31T23:59:59+05:30',
        '2026-09-30T18:30:00.000Z',
      ],
    ])('?period=%s covers %s to %s', async (period, from, to, rangeFrom) => {
      for (const path of ['/insights/traffic', '/insights/vehicles', '/insights/demand']) {
        const { body } = await supertest(appWith(queries))
          .get(`${path}?period=${period}`)
          .set('X-Test-Role', 'admin');
        expect(body.period).toEqual({ from, to });
      }
      expect(rangeOf(queries.last('getVehicleStats'), 1).from.toISOString()).toBe(rangeFrom);
      expect(rangeOf(queries.last('getDemand'), 1).until).toEqual(new FakeClock().now());
    });

    it('rejects an unknown period and a malformed showroom id with 422', async () => {
      const app = appWith(queries);
      const badPeriod = await supertest(app)
        .get('/insights/traffic?period=year')
        .set('X-Test-Role', 'admin');
      const badShowroom = await supertest(app)
        .get('/insights/demand?showroomId=x')
        .set('X-Test-Role', 'admin');

      expect(badPeriod.status).toBe(422);
      expect(badPeriod.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(badShowroom.status).toBe(422);
    });

    it('passes a named showroom through', async () => {
      await supertest(appWith(queries))
        .get(`/insights/vehicles?showroomId=${SHOWROOM}`)
        .set('X-Test-Role', 'admin');

      expect(queries.last('getVehicleStats')?.[0]).toBe(SHOWROOM);
    });
  });

  describe('ids', () => {
    it.each(['/insights/vehicles/nope', '/insights/leads/nope'])(
      'GET %s answers 422 for a malformed id',
      async (path) => {
        const response = await supertest(appWith(queries)).get(path).set('X-Test-Role', 'admin');

        expect(response.status).toBe(422);
      },
    );

    it('answers 404 for a vehicle that is not in scope', async () => {
      const response = await supertest(appWith(queries))
        .get('/insights/vehicles/99999999-9999-4999-8999-999999999999')
        .set('X-Test-Role', 'admin');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    });

    it('answers 404 for a lead that does not exist', async () => {
      queries.journey = null;

      const response = await supertest(appWith(queries))
        .get(`/insights/leads/${LEAD}`)
        .set('X-Test-Role', 'admin');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    });
  });
});
