import type { DashboardPeriodKey } from '../../domain/dashboard-window';

export interface GetDashboardQuery {
  readonly period: DashboardPeriodKey;
  readonly showroomId?: string;
}

export interface TrendKpi<T> {
  readonly value: T;
  readonly previous: T;
}

export interface FollowUpCardDto {
  readonly followUpId: string;
  readonly leadId: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly contactName: string;
  readonly contactPhone: string | null;
  readonly vehicleLabel: string | null;
}

export interface LeadCardDto {
  readonly leadId: string;
  readonly status: string;
  readonly source: string;
  readonly contactName: string;
  readonly contactPhone: string | null;
  readonly vehicleLabel: string | null;
  readonly createdAt: string;
}

export interface VehicleCardDto {
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly status: string;
  readonly daysListed: number;
  readonly activeLeads: number;
}

export interface CardListDto<T> {
  readonly total: number;
  readonly items: readonly T[];
}

/** `all`: every lead in scope (admin). `mine`: the caller's assigned leads (salesperson). */
export type DashboardScopeKey = 'all' | 'mine';

export interface DashboardDto {
  readonly generatedAt: string;
  readonly scope: DashboardScopeKey;
  readonly period: {
    readonly key: DashboardPeriodKey;
    readonly from: string;
    readonly to: string;
    readonly timezone: string;
  };
  readonly kpis: {
    readonly carsSold: TrendKpi<number>;
    readonly newLeads: TrendKpi<number>;
    readonly conversionRate: TrendKpi<number | null>;
    /** Showroom-wide stock; null on a `mine` dashboard. */
    readonly inStock: { readonly value: number } | null;
  };
  readonly attention: {
    readonly overdueFollowUps: CardListDto<FollowUpCardDto>;
    readonly leadsWithoutFollowUp: CardListDto<LeadCardDto>;
    /** Showroom-wide stock; null on a `mine` dashboard. */
    readonly agedStock: CardListDto<VehicleCardDto> | null;
  };
  readonly today: CardListDto<FollowUpCardDto>;
  readonly pipeline: {
    readonly new: number;
    readonly not_now: number;
    readonly booking_confirmed: number;
  };
  /** Showroom-wide stock; null on a `mine` dashboard. */
  readonly inventory: { readonly open: number; readonly linked: number } | null;
}
