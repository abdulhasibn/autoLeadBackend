import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { InsightsPolicy } from '../application/policies/insights.policy';
import { GetDemandInsightsUseCase } from '../application/use-cases/get-demand-insights.use-case';
import {
  GetLeadJourneyUseCase,
  NO_JOURNEY,
} from '../application/use-cases/get-lead-journey.use-case';
import {
  CAMPAIGN_LIMIT,
  GetTrafficInsightsUseCase,
} from '../application/use-cases/get-traffic-insights.use-case';
import { GetVehicleInsightDetailUseCase } from '../application/use-cases/get-vehicle-insight-detail.use-case';
import { GetVehicleInsightsUseCase } from '../application/use-cases/get-vehicle-insights.use-case';
import {
  ADMIN,
  CITY,
  CRETA,
  CRETA_STATS,
  FakeClock,
  FakeInsightsQueries,
  LEAD,
  leadJourneyReadModel,
  NOW,
  SALESPERSON,
} from './fakes';

const settings = { timeZone: 'Asia/Kolkata' };
const policy = new InsightsPolicy();

describe('GetTrafficInsightsUseCase', () => {
  let queries: FakeInsightsQueries;
  const run = (period: 'today' | 'week' | 'month' | 'quarter' = 'month') =>
    new GetTrafficInsightsUseCase(policy, queries, new FakeClock(), settings).execute(
      { period },
      ADMIN,
    );

  beforeEach(() => {
    queries = new FakeInsightsQueries();
  });

  it('adds visitor-to-lead rates to this period and the same span of the last one', async () => {
    const traffic = await run();

    expect(traffic).toMatchObject({
      visitors: 3412,
      sessions: 4186,
      leads: 74,
      visitorToLeadRate: 0.0217,
      previous: { visitors: 2310, sessions: 2851, leads: 51, visitorToLeadRate: 0.0221 },
      devices: { mobile: 2970, desktop: 442 },
    });
    expect(traffic.channels[0]).toEqual({
      channel: 'instagram_ads',
      visitors: 1820,
      carViews: 1240,
      testDriveOpens: 212,
      leads: 47,
      bookings: 14,
      sold: 6,
    });
  });

  it('gives campaigns a lead rate, null when a campaign had no tracked visits', async () => {
    const { campaigns } = await run();

    expect(campaigns).toEqual([
      {
        campaign: 'Diwali SUVs',
        content: 'Creta reel',
        visits: 742,
        leads: 23,
        leadRate: 0.031,
        bookings: 7,
      },
      { campaign: 'Swift story', content: null, visits: 0, leads: 1, leadRate: null, bookings: 0 },
    ]);
    expect(queries.last('getTraffic')?.[3]).toBe(CAMPAIGN_LIMIT);
  });

  it('keeps the top four cities and folds the rest, and unknown cities, into Other', async () => {
    const { cities } = await run();

    expect(cities).toEqual([
      { city: 'Kochi', visitors: 1420 },
      { city: 'Thrissur', visitors: 610 },
      { city: 'Kottayam', visitors: 388 },
      { city: 'Kozhikode', visitors: 301 },
      { city: 'Other', visitors: 693 },
    ]);
  });

  it('reports null rates and no Other city when nothing was tracked', async () => {
    queries.traffic = {
      ...queries.traffic,
      current: { visitors: 0, sessions: 0, leads: 0 },
      previous: { visitors: 0, sessions: 0, leads: 0 },
      cities: [],
    };

    const traffic = await run('today');

    expect(traffic.visitorToLeadRate).toBeNull();
    expect(traffic.previous.visitorToLeadRate).toBeNull();
    expect(traffic.cities).toEqual([]);
  });

  it('compares a period to date with the same elapsed span of the previous period', async () => {
    await run('week');

    // Tuesday 2026-11-03 15:00 IST: this week from Monday, last week Mon 00:00 to Tue 15:00.
    expect(queries.last('getTraffic')).toEqual([
      null,
      { from: new Date('2026-11-01T18:30:00.000Z'), until: NOW },
      {
        from: new Date('2026-10-25T18:30:00.000Z'),
        until: new Date('2026-10-27T09:30:00.000Z'),
      },
      CAMPAIGN_LIMIT,
    ]);
  });
});

describe('GetVehicleInsightsUseCase', () => {
  it('reproduces the web app fixture: titles, ages, lead rates and signals', async () => {
    const queries = new FakeInsightsQueries();

    const { items } = await new GetVehicleInsightsUseCase(
      policy,
      queries,
      new FakeClock(),
      settings,
    ).execute({ period: 'month' }, ADMIN);

    expect(
      items.map((item) => [item.title, item.daysInStock, item.leadRate, item.signal.code]),
    ).toEqual([
      ['2021 Hyundai Creta SX', 18, 0.0449, 'hot'],
      ['2019 Honda City VX', 34, 0.0077, 'seen_not_enquired'],
      ['2020 Maruti Swift VXI', 26, 0.0398, 'normal'],
      ['2017 Toyota Innova Crysta 2.4 VX', 63, 0.0182, 'ageing_cooling'],
      ['2018 Maruti Ciaz Alpha', 21, 0.0278, 'low_visibility'],
      ['2023 Kia Sonet HTX', 4, 0, 'insufficient_data'],
    ]);
    expect(items[0]).toMatchObject({
      vehicleId: CRETA,
      listedPrice: 1240000,
      views: 486,
      uniqueViewers: 312,
      repeatViewers: 74,
      testDriveOpens: 58,
      contactClicks: 41,
      leads: 14,
      topChannel: 'instagram_ads',
      signal: { code: 'hot', reason: 'Strong demand. Hold firm, small or no discount.' },
    });
    expect(queries.last('getVehicleStats')?.[2]).toBeNull();
  });

  it('gives a car nobody has viewed a null lead rate and insufficient data', async () => {
    const queries = new FakeInsightsQueries();
    queries.stock = [{ ...CRETA_STATS, views: 0, uniqueViewers: 0, leads: 0 }];

    const { items } = await new GetVehicleInsightsUseCase(
      policy,
      queries,
      new FakeClock(),
      settings,
    ).execute({ period: 'today' }, ADMIN);

    expect(items[0]).toMatchObject({ leadRate: null, signal: { code: 'insufficient_data' } });
  });
});

describe('GetVehicleInsightDetailUseCase', () => {
  let queries: FakeInsightsQueries;
  const run = (period: 'month' | 'quarter', vehicleId = CITY) =>
    new GetVehicleInsightDetailUseCase(policy, queries, new FakeClock(), settings).execute(
      { period, vehicleId },
      ADMIN,
    );

  beforeEach(() => {
    queries = new FakeInsightsQueries();
  });

  it('returns the list row plus a zero-filled daily series from the period start to today', async () => {
    const detail = await run('month');

    expect(detail).toMatchObject({
      vehicleId: CITY,
      title: '2019 Honda City VX',
      signal: { code: 'seen_not_enquired' },
      period: { from: '2026-11-01T00:00:00+05:30', to: '2026-11-30T23:59:59+05:30' },
    });
    expect(detail.daily).toEqual([
      { date: '2026-11-01', views: 0, leads: 0 },
      { date: '2026-11-02', views: 16, leads: 0 },
      { date: '2026-11-03', views: 0, leads: 0 },
    ]);
    expect(detail.channels).toEqual([{ channel: 'instagram_ads', views: 198 }]);
  });

  it('judges the car against stock and reads 14 extra days for price comparisons', async () => {
    await run('month');

    expect(queries.last('getVehicleStats')?.[2]).toBe(CITY);
    expect(queries.last('getVehicleDetail')).toEqual([
      CITY,
      new Date('2026-10-17T18:30:00.000Z'),
      { from: new Date('2026-10-31T18:30:00.000Z'), until: NOW },
      'Asia/Kolkata',
    ]);
  });

  it('lists price changes in the period with views and leads per day either side', async () => {
    const { priceChanges } = await run('quarter');

    // Changed 2026-10-30 11:15 IST. Before: Oct 16–29 (14 days, 9 views on the 25th).
    // After: Oct 30 – Nov 3 (5 days: 15 + 16 views, 1 lead).
    expect(priceChanges).toEqual([
      {
        at: '2026-10-30T05:45:00.000Z',
        from: 940000,
        to: 890000,
        before: { viewsPerDay: 0.64, leadsPerDay: 0 },
        after: { viewsPerDay: 6.2, leadsPerDay: 0.2 },
      },
    ]);
  });

  it('leaves out changes before the period, and setting or clearing a price', async () => {
    queries.detail = {
      ...queries.detail,
      priceHistory: [
        { price: 900000, changedAt: '2026-09-15T05:00:00.000Z' },
        { price: null, changedAt: '2026-10-05T05:00:00.000Z' },
        { price: 880000, changedAt: '2026-10-06T05:00:00.000Z' },
      ],
    };

    expect((await run('quarter')).priceChanges).toEqual([]);
  });

  it('places the price against what visitors search for', async () => {
    const detail = await run('month');

    // Searches capped below ₹8.9L: 18 + 31 + 27 of 100.
    expect(detail.budgetContext).toEqual({ segment: 'Sedan', shareBelowPrice: 76 });
  });

  it('answers 404 for a car outside the stock in scope', async () => {
    await expect(run('month', '99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('GetDemandInsightsUseCase', () => {
  let queries: FakeInsightsQueries;
  const run = () =>
    new GetDemandInsightsUseCase(policy, queries, new FakeClock(), settings).execute(
      { period: 'month' },
      ADMIN,
    );

  beforeEach(() => {
    queries = new FakeInsightsQueries();
  });

  it('compares search budgets with stock prices in every band', async () => {
    const { budgetBands } = await run();

    expect(budgetBands).toEqual([
      { band: '<4L', searchShare: 18, stockShare: 5 },
      { band: '4-6L', searchShare: 31, stockShare: 15 },
      { band: '6-8L', searchShare: 27, stockShare: 20 },
      { band: '8-12L', searchShare: 17, stockShare: 40 },
      { band: '12L+', searchShare: 7, stockShare: 20 },
    ]);
  });

  it('flags segments where demand and stock are 10 or more points apart', async () => {
    const { segments } = await run();

    expect(segments).toEqual([
      { label: 'SUV', demandShare: 48, stockShare: 30, gap: 'under' },
      { label: 'Hatchback', demandShare: 29, stockShare: 20, gap: null },
      { label: 'Sedan', demandShare: 14, stockShare: 30, gap: 'over' },
      { label: 'MUV / MPV', demandShare: 9, stockShare: 20, gap: 'over' },
    ]);
  });

  it('names the top searches the site had no car for', async () => {
    const { zeroResultSearches } = await run();

    expect(zeroResultSearches).toEqual({
      count: 63,
      top: [
        { label: 'Creta under ₹10L', count: 18 },
        { label: 'Automatic under ₹6L', count: 14 },
        { label: 'Diesel Brezza', count: 9 },
      ],
    });
  });

  it('reports zero shares and no gaps before anyone has searched', async () => {
    queries.demand = {
      ...queries.demand,
      searchPrices: [],
      searchBodyTypes: [],
      zeroResultCount: 0,
      zeroResultTop: [],
    };

    const demand = await run();

    expect(demand.budgetBands.map((band) => band.searchShare)).toEqual([0, 0, 0, 0, 0]);
    expect(demand.budgetBands.reduce((sum, band) => sum + band.stockShare, 0)).toBe(100);
    expect(demand.segments.every((segment) => segment.gap === null)).toBe(true);
    expect(demand.zeroResultSearches).toEqual({ count: 0, top: [] });
  });
});

describe('GetLeadJourneyUseCase', () => {
  let queries: FakeInsightsQueries;
  const run = () => new GetLeadJourneyUseCase(policy, queries).execute(LEAD, ADMIN);

  beforeEach(() => {
    queries = new FakeInsightsQueries();
  });

  it('shapes an attributed lead with its intent', async () => {
    expect(await run()).toEqual({
      channel: 'instagram_ads',
      campaign: 'Diwali SUVs',
      content: 'Creta reel',
      firstVisitAt: '2026-10-22T14:12:00.000Z',
      visits: 4,
      viewsOfThisCar: 6,
      galleryOpens: 3,
      otherCarsViewed: [
        { vehicleId: CITY, title: '2019 Honda City VX', listedPrice: 890000, views: 2 },
      ],
      intent: 'high',
    });
  });

  it('returns the empty journey for a lead without website attribution', async () => {
    queries.journey = { ...leadJourneyReadModel(), hasAttribution: false };

    expect(await run()).toEqual(NO_JOURNEY);
  });
});

describe('admin only', () => {
  const queries = new FakeInsightsQueries();
  const clock = new FakeClock();
  const cases: [string, () => Promise<unknown>][] = [
    [
      'traffic',
      () =>
        new GetTrafficInsightsUseCase(policy, queries, clock, settings).execute(
          { period: 'month' },
          SALESPERSON,
        ),
    ],
    [
      'vehicles',
      () =>
        new GetVehicleInsightsUseCase(policy, queries, clock, settings).execute(
          { period: 'month' },
          SALESPERSON,
        ),
    ],
    [
      'vehicle detail',
      () =>
        new GetVehicleInsightDetailUseCase(policy, queries, clock, settings).execute(
          { period: 'month', vehicleId: CITY },
          SALESPERSON,
        ),
    ],
    [
      'demand',
      () =>
        new GetDemandInsightsUseCase(policy, queries, clock, settings).execute(
          { period: 'month' },
          SALESPERSON,
        ),
    ],
    ['lead journey', () => new GetLeadJourneyUseCase(policy, queries).execute(LEAD, SALESPERSON)],
  ];

  it.each(cases)('rejects a salesperson reading %s before querying', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(queries.calls).toHaveLength(0);
  });
});
