import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type {
  DemandReadModel,
  IInsightsQueries,
  InsightsRange,
  LeadJourneyReadModel,
  TrafficReadModel,
  VehicleDetailReadModel,
  VehicleStatsReadModel,
} from '../domain/insights.queries';

export const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

export const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

export const SHOWROOM = '11111111-1111-4111-8111-111111111111';
export const CRETA = '7c1e2b8a-3f41-4d2a-9b6e-2a1f0c9d4e01';
export const CITY = '7c1e2b8a-3f41-4d2a-9b6e-2a1f0c9d4e02';
export const LEAD = '44444444-4444-4444-8444-444444444441';

/** 2026-11-03 15:00 IST. */
export const NOW = new Date('2026-11-03T09:30:00.000Z');

export class FakeClock implements Clock {
  constructor(private readonly at: Date = NOW) {}
  now(): Date {
    return this.at;
  }
}

export function trafficReadModel(overrides: Partial<TrafficReadModel> = {}): TrafficReadModel {
  return {
    current: { visitors: 3412, sessions: 4186, leads: 74 },
    previous: { visitors: 2310, sessions: 2851, leads: 51 },
    channels: [
      {
        channel: 'instagram_ads',
        visitors: 1820,
        carViews: 1240,
        testDriveOpens: 212,
        leads: 47,
        bookings: 14,
        sold: 6,
      },
    ],
    campaigns: [
      { campaign: 'Diwali SUVs', content: 'Creta reel', visits: 742, leads: 23, bookings: 7 },
      { campaign: 'Swift story', content: null, visits: 0, leads: 1, bookings: 0 },
    ],
    devices: { mobile: 2970, desktop: 442 },
    cities: [
      { city: 'Kochi', visitors: 1420 },
      { city: 'Thrissur', visitors: 610 },
      { city: 'Kottayam', visitors: 388 },
      { city: 'Kozhikode', visitors: 301 },
      { city: 'Kannur', visitors: 200 },
      { city: null, visitors: 493 },
    ],
    ...overrides,
  };
}

function stats(overrides: Partial<VehicleStatsReadModel>): VehicleStatsReadModel {
  return {
    vehicleId: CRETA,
    year: 2021,
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    bodyType: 'suv',
    listedPrice: 1240000,
    createdAt: '2026-10-16T09:30:00.000Z',
    views: 0,
    uniqueViewers: 0,
    repeatViewers: 0,
    testDriveOpens: 0,
    contactClicks: 0,
    leads: 0,
    topChannel: null,
    ...overrides,
  };
}

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** The web app's vehicles fixture, as raw stats. */
export const CRETA_STATS: VehicleStatsReadModel = stats({
  views: 486,
  uniqueViewers: 312,
  repeatViewers: 74,
  testDriveOpens: 58,
  contactClicks: 41,
  leads: 14,
  topChannel: 'instagram_ads',
  createdAt: daysAgo(18),
});

export const STOCK: readonly VehicleStatsReadModel[] = [
  CRETA_STATS,
  stats({
    vehicleId: CITY,
    year: 2019,
    make: 'Honda',
    model: 'City',
    variant: 'VX',
    bodyType: 'sedan',
    listedPrice: 890000,
    views: 352,
    uniqueViewers: 260,
    repeatViewers: 22,
    testDriveOpens: 9,
    contactClicks: 6,
    leads: 2,
    topChannel: 'instagram_ads',
    createdAt: daysAgo(34),
  }),
  stats({
    vehicleId: 'v-swift',
    year: 2020,
    make: 'Maruti',
    model: 'Swift',
    variant: 'VXI',
    bodyType: 'hatchback',
    listedPrice: 510000,
    views: 268,
    uniqueViewers: 201,
    leads: 8,
    topChannel: 'instagram_ads',
    createdAt: daysAgo(26),
  }),
  stats({
    vehicleId: 'v-innova',
    year: 2017,
    make: 'Toyota',
    model: 'Innova Crysta',
    variant: '2.4 VX',
    bodyType: 'muv',
    listedPrice: 1580000,
    views: 138,
    uniqueViewers: 110,
    leads: 2,
    topChannel: 'google_organic',
    createdAt: daysAgo(63),
  }),
  stats({
    vehicleId: 'v-ciaz',
    year: 2018,
    make: 'Maruti',
    model: 'Ciaz',
    variant: 'Alpha',
    bodyType: 'sedan',
    listedPrice: 720000,
    views: 41,
    uniqueViewers: 36,
    leads: 1,
    topChannel: 'google_organic',
    createdAt: daysAgo(21),
  }),
  stats({
    vehicleId: 'v-sonet',
    year: 2023,
    make: 'Kia',
    model: 'Sonet',
    variant: 'HTX',
    bodyType: 'crossover, suv',
    listedPrice: 940000,
    views: 22,
    uniqueViewers: 19,
    leads: 0,
    topChannel: 'instagram_ads',
    createdAt: daysAgo(4),
  }),
];

export function vehicleDetailReadModel(
  overrides: Partial<VehicleDetailReadModel> = {},
): VehicleDetailReadModel {
  return {
    daily: [
      { date: '2026-10-25', views: 9, leads: 0 },
      { date: '2026-10-31', views: 15, leads: 1 },
      { date: '2026-11-02', views: 16, leads: 0 },
    ],
    priceHistory: [
      { price: 940000, changedAt: '2026-09-30T05:00:00.000Z' },
      { price: 890000, changedAt: '2026-10-30T05:45:00.000Z' },
    ],
    channels: [{ channel: 'instagram_ads', views: 198 }],
    ...overrides,
  };
}

export function demandReadModel(overrides: Partial<DemandReadModel> = {}): DemandReadModel {
  return {
    searchPrices: [
      { value: 350000, count: 18 },
      { value: 600000, count: 31 },
      { value: 800000, count: 27 },
      { value: 1000000, count: 17 },
      { value: 1500000, count: 7 },
    ],
    searchBodyTypes: [
      { value: 'suv', count: 48 },
      { value: 'hatchback', count: 29 },
      { value: 'sedan', count: 14 },
      { value: 'muv', count: 9 },
    ],
    stockPrices: [
      { value: 510000, count: 3 },
      { value: 720000, count: 4 },
      { value: 890000, count: 8 },
      { value: 1580000, count: 4 },
      { value: 380000, count: 1 },
    ],
    stockBodyTypes: [
      { value: 'suv', count: 6 },
      { value: 'crossover, suv', count: 0 },
      { value: 'hatchback', count: 4 },
      { value: 'sedan', count: 6 },
      { value: 'muv', count: 4 },
    ],
    zeroResultCount: 63,
    zeroResultTop: [
      {
        make: 'Hyundai',
        model: 'Creta',
        bodyType: null,
        fuelType: null,
        transmission: null,
        priceMax: 1000000,
        count: 18,
      },
      {
        make: null,
        model: null,
        bodyType: null,
        fuelType: null,
        transmission: 'automatic',
        priceMax: 600000,
        count: 14,
      },
      {
        make: 'Maruti',
        model: 'Brezza',
        bodyType: null,
        fuelType: 'diesel',
        transmission: null,
        priceMax: null,
        count: 9,
      },
    ],
    ...overrides,
  };
}

export function leadJourneyReadModel(
  overrides: Partial<LeadJourneyReadModel> = {},
): LeadJourneyReadModel {
  return {
    hasAttribution: true,
    channel: 'instagram_ads',
    campaign: 'Diwali SUVs',
    content: 'Creta reel',
    firstVisitAt: '2026-10-22T14:12:00.000Z',
    visits: 4,
    viewsOfThisCar: 6,
    galleryOpens: 3,
    otherCars: [
      {
        vehicleId: CITY,
        year: 2019,
        make: 'Honda',
        model: 'City',
        variant: 'VX',
        listedPrice: 890000,
        views: 2,
      },
    ],
    ...overrides,
  };
}

interface Call {
  readonly method: string;
  readonly args: readonly unknown[];
}

export class FakeInsightsQueries implements IInsightsQueries {
  readonly calls: Call[] = [];
  traffic = trafficReadModel();
  stock: readonly VehicleStatsReadModel[] = STOCK;
  detail = vehicleDetailReadModel();
  demand = demandReadModel();
  journey: LeadJourneyReadModel | null = leadJourneyReadModel();

  async getTraffic(
    showroomId: ShowroomId | null,
    current: InsightsRange,
    previous: InsightsRange,
    campaignLimit: number,
  ): Promise<TrafficReadModel> {
    this.calls.push({ method: 'getTraffic', args: [showroomId, current, previous, campaignLimit] });
    return this.traffic;
  }

  async getVehicleStats(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    includeVehicleId: string | null,
  ): Promise<readonly VehicleStatsReadModel[]> {
    this.calls.push({ method: 'getVehicleStats', args: [showroomId, range, includeVehicleId] });
    return this.stock;
  }

  async getVehicleDetail(
    vehicleId: string,
    seriesFrom: Date,
    range: InsightsRange,
    timeZone: string,
  ): Promise<VehicleDetailReadModel> {
    this.calls.push({ method: 'getVehicleDetail', args: [vehicleId, seriesFrom, range, timeZone] });
    return this.detail;
  }

  async getDemand(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    zeroResultLimit: number,
  ): Promise<DemandReadModel> {
    this.calls.push({ method: 'getDemand', args: [showroomId, range, zeroResultLimit] });
    return this.demand;
  }

  async getLeadJourney(
    leadId: string,
    otherCarsLimit: number,
  ): Promise<LeadJourneyReadModel | null> {
    this.calls.push({ method: 'getLeadJourney', args: [leadId, otherCarsLimit] });
    return this.journey;
  }

  last(method: string): readonly unknown[] | undefined {
    return [...this.calls].reverse().find((call) => call.method === method)?.args;
  }
}
