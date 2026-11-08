import type { ShowroomId } from '../../../domain/shared/showroom-id';

/**
 * Raw counts behind the Insights page, read from website analytics
 * (ADR-0016), leads and vehicles. Ratios, bands, signals and labels are left
 * to the use cases.
 *
 * `channel` values are site-analytics traffic channels (e.g. `instagram_ads`);
 * the database only stores known ones. Website sessions belong to no
 * showroom, so a showroom filter narrows leads and vehicles only.
 */

/** Half-open time range [from, until). */
export interface InsightsRange {
  readonly from: Date;
  readonly until: Date;
}

export interface TrafficCounts {
  readonly visitors: number;
  readonly sessions: number;
  /** Website leads with attribution (lead_attribution rows). */
  readonly leads: number;
}

export interface ChannelCounts {
  readonly channel: string;
  readonly visitors: number;
  readonly carViews: number;
  readonly testDriveOpens: number;
  readonly leads: number;
  readonly bookings: number;
  readonly sold: number;
}

export interface CampaignCounts {
  readonly campaign: string;
  readonly content: string | null;
  readonly visits: number;
  readonly leads: number;
  readonly bookings: number;
}

export interface TrafficReadModel {
  readonly current: TrafficCounts;
  readonly previous: TrafficCounts;
  readonly channels: readonly ChannelCounts[];
  readonly campaigns: readonly CampaignCounts[];
  readonly devices: { readonly mobile: number; readonly desktop: number };
  /** Distinct visitors per edge city; `city: null` when the edge sent none. */
  readonly cities: readonly { readonly city: string | null; readonly visitors: number }[];
}

export interface VehicleStatsReadModel {
  readonly vehicleId: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  /** Raw catalog body type, e.g. `suv` or `crossover, suv`. */
  readonly bodyType: string | null;
  readonly listedPrice: number | null;
  readonly createdAt: string;
  readonly views: number;
  readonly uniqueViewers: number;
  /** Visitors who viewed the car in two or more sessions. */
  readonly repeatViewers: number;
  readonly testDriveOpens: number;
  /** WhatsApp and call clicks. */
  readonly contactClicks: number;
  /** Leads on this car created in the range, any source. */
  readonly leads: number;
  readonly topChannel: string | null;
}

export interface DailyCounts {
  /** Business-timezone date, YYYY-MM-DD. */
  readonly date: string;
  readonly views: number;
  readonly leads: number;
}

export interface VehicleDetailReadModel {
  /** Sparse: days without views or leads are left out. */
  readonly daily: readonly DailyCounts[];
  /** Every listed-price change up to the end of the range, oldest first. */
  readonly priceHistory: readonly { readonly price: number | null; readonly changedAt: string }[];
  readonly channels: readonly { readonly channel: string; readonly views: number }[];
}

export interface ValueCount<T> {
  readonly value: T;
  readonly count: number;
}

export interface ZeroResultSearch {
  readonly make: string | null;
  readonly model: string | null;
  readonly bodyType: string | null;
  readonly fuelType: string | null;
  readonly transmission: string | null;
  readonly priceMax: number | null;
  readonly count: number;
}

export interface DemandReadModel {
  /** Website searches (filter_apply) by their budget ceiling. */
  readonly searchPrices: readonly ValueCount<number>[];
  readonly searchBodyTypes: readonly ValueCount<string>[];
  /** Live stock (open / linked) by listed price; cars without one are left out. */
  readonly stockPrices: readonly ValueCount<number>[];
  readonly stockBodyTypes: readonly ValueCount<string>[];
  readonly zeroResultCount: number;
  readonly zeroResultTop: readonly ZeroResultSearch[];
}

export interface OtherCarViewed {
  readonly vehicleId: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly listedPrice: number | null;
  readonly views: number;
}

export interface LeadJourneyReadModel {
  readonly hasAttribution: boolean;
  /** Last-touch channel the lead is credited to. */
  readonly channel: string | null;
  readonly campaign: string | null;
  readonly content: string | null;
  readonly firstVisitAt: string | null;
  readonly visits: number;
  readonly viewsOfThisCar: number;
  readonly galleryOpens: number;
  readonly otherCars: readonly OtherCarViewed[];
}

export interface IInsightsQueries {
  getTraffic(
    showroomId: ShowroomId | null,
    current: InsightsRange,
    previous: InsightsRange,
    campaignLimit: number,
  ): Promise<TrafficReadModel>;

  /** Live stock, plus `includeVehicleId` whatever its status. */
  getVehicleStats(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    includeVehicleId: string | null,
  ): Promise<readonly VehicleStatsReadModel[]>;

  getVehicleDetail(
    vehicleId: string,
    seriesFrom: Date,
    range: InsightsRange,
    timeZone: string,
  ): Promise<VehicleDetailReadModel>;

  getDemand(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    zeroResultLimit: number,
  ): Promise<DemandReadModel>;

  /** Null when the lead does not exist. */
  getLeadJourney(leadId: string, otherCarsLimit: number): Promise<LeadJourneyReadModel | null>;
}
