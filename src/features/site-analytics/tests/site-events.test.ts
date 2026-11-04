import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import type { Logger } from '../../../shared/logging/logger.port';
import { IngestEventsUseCase } from '../application/use-cases/ingest-events.use-case';
import type {
  IWebEventIngest,
  WebEventRecord,
  WebSessionRecord,
} from '../domain/web-event-ingest.port';
import { IngestEventsController } from '../presentation/controllers/ingest-events.controller';
import { ingestEventsBodySchema } from '../presentation/schemas/site-events.schemas';
import { createSiteAnalyticsRouter } from '../presentation/site-analytics.routes';

const SITE = 'https://wheelsexperts.in';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0';

class FakeWebEventIngest implements IWebEventIngest {
  readonly batches: {
    session: WebSessionRecord;
    events: readonly WebEventRecord[];
    ipHash: string;
  }[] = [];
  failing = false;

  async record(
    session: WebSessionRecord,
    events: readonly WebEventRecord[],
    ipHash: string,
  ): Promise<number> {
    if (this.failing) {
      throw new Error('db down');
    }
    this.batches.push({ session, events, ipHash });
    return events.length;
  }
}

const silent = { warn: () => {}, error: () => {}, info: () => {} } as unknown as Logger;

function batch(overrides: Record<string, unknown> = {}) {
  return {
    visitorId: '22222222-2222-4222-8222-222222222222',
    sessionId: '33333333-3333-4333-8333-333333333333',
    touch: {
      utmSource: 'instagram',
      utmMedium: 'paid_social',
      utmCampaign: 'diwali',
      hasFbclid: true,
      hasGclid: false,
      landingPath: '/cars/11111111-1111-4111-8111-111111111111',
      inAppBrowser: 'instagram',
    },
    events: [
      { type: 'page_view', at: '2026-11-04T10:00:00.000Z', path: '/cars/1' },
      {
        type: 'car_view',
        at: '2026-11-04T10:00:01.000Z',
        path: '/cars/1',
        vehicleId: '11111111-1111-4111-8111-111111111111',
        props: { listedPrice: 1450000 },
      },
    ],
    ...overrides,
  };
}

describe('ingestEventsBodySchema', () => {
  const event = { type: 'page_view', at: '2026-11-04T10:00:00.000Z', path: '/' };

  it('accepts the site payload', () => {
    expect(ingestEventsBodySchema.safeParse(batch()).success).toBe(true);
  });

  it.each([
    ['an empty batch', batch({ events: [] })],
    ['more than 20 events', batch({ events: Array.from({ length: 21 }, () => event) })],
    ['an unknown event type', batch({ events: [{ ...event, type: 'scroll' }] })],
    ['a non-ISO time', batch({ events: [{ ...event, at: 'yesterday' }] })],
    ['a bad vehicle id', batch({ events: [{ ...event, vehicleId: 'car-1' }] })],
    [
      'more than 12 props',
      batch({
        events: [
          {
            ...event,
            props: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i])),
          },
        ],
      }),
    ],
    ['an object prop value', batch({ events: [{ ...event, props: { nested: { a: 1 } } }] })],
    ['a non-uuid visitor', batch({ visitorId: 'visitor-1' })],
    ['an over-long UTM', batch({ touch: { ...batch().touch, utmCampaign: 'x'.repeat(121) } })],
    ['an unknown in-app browser', batch({ touch: { ...batch().touch, inAppBrowser: 'tiktok' } })],
    ['a missing touch', batch({ touch: undefined })],
  ])('rejects %s', (_label, payload) => {
    expect(ingestEventsBodySchema.safeParse(payload).success).toBe(false);
  });
});

describe('POST /public/events', () => {
  function app(ingest = new FakeWebEventIngest()) {
    const server = express();
    server.use(
      '/public',
      createSiteAnalyticsRouter({
        allowedOrigins: [SITE],
        ingestEventsController: new IngestEventsController(
          new IngestEventsUseCase(ingest),
          'test-key',
          silent,
        ),
      }),
    );
    return server;
  }

  it('parses a text/plain beacon and stores a classified session', async () => {
    const ingest = new FakeWebEventIngest();
    const response = await supertest(app(ingest))
      .post('/public/events')
      .set('Origin', SITE)
      .set('User-Agent', IPHONE_INSTAGRAM)
      .set('X-Vercel-IP-City', 'Bengaluru%20Urban')
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(JSON.stringify(batch()));

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(SITE);
    expect(ingest.batches).toHaveLength(1);
    expect(ingest.batches[0]?.session).toMatchObject({
      channel: 'instagram_ads',
      device: 'mobile',
      city: 'Bengaluru Urban',
      utmCampaign: 'diwali',
    });
    expect(ingest.batches[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ingest.batches[0]?.events[1]).toMatchObject({
      type: 'car_view',
      vehicleId: '11111111-1111-4111-8111-111111111111',
      props: { listedPrice: 1450000 },
    });
  });

  it('accepts a JSON body too', async () => {
    const ingest = new FakeWebEventIngest();
    await supertest(app(ingest))
      .post('/public/events')
      .set('User-Agent', IPHONE_INSTAGRAM)
      .send(batch());

    expect(ingest.batches).toHaveLength(1);
  });

  it.each([
    ['a bot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['a link unfurler', 'facebookexternalhit/1.1'],
    ['a blank user agent', ''],
  ])('drops %s with a 204', async (_label, userAgent) => {
    const ingest = new FakeWebEventIngest();
    const response = await supertest(app(ingest))
      .post('/public/events')
      .set('User-Agent', userAgent)
      .send(batch());

    expect(response.status).toBe(204);
    expect(ingest.batches).toEqual([]);
  });

  it('answers 204 to junk, oversized bodies and a failing store', async () => {
    const failing = new FakeWebEventIngest();
    failing.failing = true;
    const ua = IPHONE_INSTAGRAM;

    const junk = await supertest(app())
      .post('/public/events')
      .set('User-Agent', ua)
      .set('Content-Type', 'text/plain')
      .send('{not json');
    const invalid = await supertest(app())
      .post('/public/events')
      .set('User-Agent', ua)
      .send(batch({ events: [] }));
    const oversized = await supertest(app())
      .post('/public/events')
      .set('User-Agent', ua)
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(20_000));
    const down = await supertest(app(failing))
      .post('/public/events')
      .set('User-Agent', ua)
      .send(batch());

    expect([junk.status, invalid.status, oversized.status, down.status]).toEqual([
      204, 204, 204, 204,
    ]);
  });
});
