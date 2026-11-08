import type { ReportingPeriodKey } from '../../../../domain/shared/reporting-period';
import type { BudgetBand } from '../../domain/demand';
import type { LeadIntent } from '../../domain/lead-intent';
import type { PriceChange } from '../../domain/price-change';
import type { VehicleSignal } from '../../domain/vehicle-signal';

/**
 * Response shapes of `/insights/*`. The web app's
 * `src/features/insights/types.ts` mirrors these.
 *
 * Units: `*Rate` fields are fractions (0–1, 4 places); `*Share` fields are
 * whole percentages (0–100). `channel` is a site-analytics traffic channel.
 */

export interface InsightsQuery {
  readonly period: ReportingPeriodKey;
  readonly showroomId?: string;
}

/** The whole calendar period in the business timezone, e.g. `2026-10-01T00:00:00+05:30`. */
export interface InsightsPeriodDto {
  readonly from: string;
  readonly to: string;
}

export interface TrafficTotalsDto {
  readonly visitors: number;
  readonly sessions: number;
  readonly leads: number;
  readonly visitorToLeadRate: number | null;
}

export interface ChannelRowDto {
  readonly channel: string;
  readonly visitors: number;
  readonly carViews: number;
  readonly testDriveOpens: number;
  readonly leads: number;
  readonly bookings: number;
  readonly sold: number;
}

export interface CampaignRowDto {
  readonly campaign: string;
  readonly content: string | null;
  readonly visits: number;
  readonly leads: number;
  readonly leadRate: number | null;
  readonly bookings: number;
}

export interface TrafficInsightsDto extends TrafficTotalsDto {
  readonly period: InsightsPeriodDto;
  readonly previous: TrafficTotalsDto;
  readonly channels: readonly ChannelRowDto[];
  readonly campaigns: readonly CampaignRowDto[];
  readonly devices: { readonly mobile: number; readonly desktop: number };
  readonly cities: readonly { readonly city: string; readonly visitors: number }[];
}

export interface VehicleInsightRowDto {
  readonly vehicleId: string;
  readonly title: string;
  readonly listedPrice: number | null;
  readonly daysInStock: number;
  readonly views: number;
  readonly uniqueViewers: number;
  readonly repeatViewers: number;
  readonly testDriveOpens: number;
  readonly contactClicks: number;
  readonly leads: number;
  readonly leadRate: number | null;
  readonly topChannel: string | null;
  readonly signal: VehicleSignal;
}

export interface VehicleInsightsDto {
  readonly period: InsightsPeriodDto;
  readonly items: readonly VehicleInsightRowDto[];
}

export interface VehicleInsightDetailDto extends VehicleInsightRowDto {
  readonly period: InsightsPeriodDto;
  readonly daily: readonly {
    readonly date: string;
    readonly views: number;
    readonly leads: number;
  }[];
  readonly priceChanges: readonly PriceChange[];
  readonly channels: readonly { readonly channel: string; readonly views: number }[];
  readonly budgetContext: { readonly segment: string; readonly shareBelowPrice: number | null };
}

export interface DemandInsightsDto {
  readonly period: InsightsPeriodDto;
  readonly budgetBands: readonly {
    readonly band: BudgetBand;
    readonly searchShare: number;
    readonly stockShare: number;
  }[];
  readonly segments: readonly {
    readonly label: string;
    readonly demandShare: number;
    readonly stockShare: number;
    readonly gap: 'under' | 'over' | null;
  }[];
  readonly zeroResultSearches: {
    readonly count: number;
    readonly top: readonly { readonly label: string; readonly count: number }[];
  };
}

export interface LeadJourneyDto {
  readonly channel: string | null;
  readonly campaign: string | null;
  readonly content: string | null;
  readonly firstVisitAt: string | null;
  readonly visits: number;
  readonly viewsOfThisCar: number;
  readonly galleryOpens: number;
  readonly otherCarsViewed: readonly {
    readonly vehicleId: string;
    readonly title: string;
    readonly listedPrice: number | null;
    readonly views: number;
  }[];
  readonly intent: LeadIntent | null;
}
