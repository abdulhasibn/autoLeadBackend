import type {
  DemandReadModel,
  LeadJourneyReadModel,
  TrafficCounts,
  TrafficReadModel,
  ValueCount,
  VehicleDetailReadModel,
  VehicleStatsReadModel,
} from '../domain/insights.queries';

/**
 * JSON shapes returned by the public.insights_* functions
 * (supabase/migrations/20261108120000_insights_reads.sql). Counts are
 * Postgres bigint, prices numeric(12,2): both arrive as JSON numbers.
 */

export interface TrafficJson {
  readonly current: TrafficCounts;
  readonly previous: TrafficCounts;
  readonly channels: readonly {
    readonly channel: string;
    readonly visitors: number;
    readonly car_views: number;
    readonly test_drive_opens: number;
    readonly leads: number;
    readonly bookings: number;
    readonly sold: number;
  }[];
  readonly campaigns: readonly {
    readonly campaign: string;
    readonly content: string | null;
    readonly visits: number;
    readonly leads: number;
    readonly bookings: number;
  }[];
  readonly devices: { readonly mobile: number; readonly desktop: number };
  readonly cities: readonly { readonly city: string | null; readonly visitors: number }[];
}

export interface VehicleStatsJson {
  readonly vehicle_id: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly body_type: string | null;
  readonly listed_price: number | null;
  readonly created_at: string;
  readonly views: number;
  readonly unique_viewers: number;
  readonly repeat_viewers: number;
  readonly test_drive_opens: number;
  readonly contact_clicks: number;
  readonly leads: number;
  readonly top_channel: string | null;
}

export interface VehicleDetailJson {
  readonly daily: readonly {
    readonly date: string;
    readonly views: number;
    readonly leads: number;
  }[];
  readonly price_history: readonly { readonly price: number | null; readonly changed_at: string }[];
  readonly channels: readonly { readonly channel: string; readonly views: number }[];
}

interface PriceCountJson {
  readonly price: number;
  readonly count: number;
}

interface BodyTypeCountJson {
  readonly body_type: string;
  readonly count: number;
}

export interface DemandJson {
  readonly search_prices: readonly PriceCountJson[];
  readonly search_body_types: readonly BodyTypeCountJson[];
  readonly stock_prices: readonly PriceCountJson[];
  readonly stock_body_types: readonly BodyTypeCountJson[];
  readonly zero_result_count: number;
  readonly zero_result_top: readonly {
    readonly make: string | null;
    readonly model: string | null;
    readonly body_type: string | null;
    readonly fuel_type: string | null;
    readonly transmission: string | null;
    readonly price_max: number | null;
    readonly count: number;
  }[];
}

export interface LeadJourneyJson {
  readonly has_attribution: boolean;
  readonly channel: string | null;
  readonly campaign: string | null;
  readonly content: string | null;
  readonly first_visit_at: string | null;
  readonly visits: number;
  readonly views_of_this_car: number;
  readonly gallery_opens: number;
  readonly other_cars: readonly {
    readonly vehicle_id: string;
    readonly year: number;
    readonly make: string;
    readonly model: string;
    readonly variant: string;
    readonly listed_price: number | null;
    readonly views: number;
  }[];
}

const iso = (value: string): string => new Date(value).toISOString();

const numberOrNull = (value: number | null): number | null =>
  value === null ? null : Number(value);

export function toTrafficReadModel(json: TrafficJson): TrafficReadModel {
  return {
    current: json.current,
    previous: json.previous,
    channels: json.channels.map((row) => ({
      channel: row.channel,
      visitors: row.visitors,
      carViews: row.car_views,
      testDriveOpens: row.test_drive_opens,
      leads: row.leads,
      bookings: row.bookings,
      sold: row.sold,
    })),
    campaigns: json.campaigns,
    devices: json.devices,
    cities: json.cities,
  };
}

export function toVehicleStatsReadModel(json: VehicleStatsJson): VehicleStatsReadModel {
  return {
    vehicleId: json.vehicle_id,
    year: json.year,
    make: json.make,
    model: json.model,
    variant: json.variant,
    bodyType: json.body_type,
    listedPrice: numberOrNull(json.listed_price),
    createdAt: iso(json.created_at),
    views: json.views,
    uniqueViewers: json.unique_viewers,
    repeatViewers: json.repeat_viewers,
    testDriveOpens: json.test_drive_opens,
    contactClicks: json.contact_clicks,
    leads: json.leads,
    topChannel: json.top_channel,
  };
}

export function toVehicleDetailReadModel(json: VehicleDetailJson): VehicleDetailReadModel {
  return {
    daily: json.daily,
    priceHistory: json.price_history.map((entry) => ({
      price: numberOrNull(entry.price),
      changedAt: iso(entry.changed_at),
    })),
    channels: json.channels,
  };
}

const prices = (rows: readonly PriceCountJson[]): ValueCount<number>[] =>
  rows.map((row) => ({ value: Number(row.price), count: row.count }));

const bodyTypes = (rows: readonly BodyTypeCountJson[]): ValueCount<string>[] =>
  rows.map((row) => ({ value: row.body_type, count: row.count }));

export function toDemandReadModel(json: DemandJson): DemandReadModel {
  return {
    searchPrices: prices(json.search_prices),
    searchBodyTypes: bodyTypes(json.search_body_types),
    stockPrices: prices(json.stock_prices),
    stockBodyTypes: bodyTypes(json.stock_body_types),
    zeroResultCount: json.zero_result_count,
    zeroResultTop: json.zero_result_top.map((row) => ({
      make: row.make,
      model: row.model,
      bodyType: row.body_type,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      priceMax: numberOrNull(row.price_max),
      count: row.count,
    })),
  };
}

export function toLeadJourneyReadModel(json: LeadJourneyJson): LeadJourneyReadModel {
  return {
    hasAttribution: json.has_attribution,
    channel: json.channel,
    campaign: json.campaign,
    content: json.content,
    firstVisitAt: json.first_visit_at === null ? null : iso(json.first_visit_at),
    visits: json.visits,
    viewsOfThisCar: json.views_of_this_car,
    galleryOpens: json.gallery_opens,
    otherCars: json.other_cars.map((car) => ({
      vehicleId: car.vehicle_id,
      year: car.year,
      make: car.make,
      model: car.model,
      variant: car.variant,
      listedPrice: numberOrNull(car.listed_price),
      views: car.views,
    })),
  };
}
