import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';

/** Which records the dashboard counts. `null` means no filter. */
export interface DashboardScope {
  readonly showroomId: ShowroomId | null;
  readonly assigneeId: UserId | null;
}

export interface DashboardRange {
  readonly from: Date;
  readonly now: Date;
  readonly previousFrom: Date;
  readonly previousUntil: Date;
  readonly todayEnd: Date;
  readonly agedBefore: Date;
  readonly listLimit: number;
}

export interface PeriodCount {
  readonly current: number;
  readonly previous: number;
}

export interface VehicleLabelParts {
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly registrationNumber: string;
}

export interface FollowUpItemReadModel {
  readonly followUpId: string;
  readonly leadId: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly contactName: string;
  readonly contactPhone: string | null;
  readonly vehicle: VehicleLabelParts | null;
}

export interface LeadItemReadModel {
  readonly leadId: string;
  readonly status: string;
  readonly source: string;
  readonly contactName: string;
  readonly contactPhone: string | null;
  readonly vehicle: VehicleLabelParts | null;
  readonly createdAt: string;
}

export interface VehicleItemReadModel {
  readonly vehicleId: string;
  readonly status: string;
  readonly activeLeads: number;
  readonly createdAt: string;
  readonly vehicle: VehicleLabelParts;
}

export interface CappedList<T> {
  readonly total: number;
  readonly items: readonly T[];
}

/**
 * Raw counts and capped rows. Ratios are left to the use case.
 *
 * Follow-ups are judged per active lead: a lead's current follow-up is its
 * latest open one, so scheduling a new follow-up supersedes older ones.
 */
export interface DashboardSummaryReadModel {
  readonly carsSold: PeriodCount;
  readonly newLeads: PeriodCount;
  readonly converted: PeriodCount;
  readonly lost: PeriodCount;
  readonly inventory: { readonly open: number; readonly linked: number };
  readonly pipeline: {
    readonly new: number;
    readonly not_now: number;
    readonly booking_confirmed: number;
  };
  readonly overdueFollowUps: CappedList<FollowUpItemReadModel>;
  readonly todayFollowUps: CappedList<FollowUpItemReadModel>;
  readonly leadsWithoutFollowUp: CappedList<LeadItemReadModel>;
  readonly agedStock: CappedList<VehicleItemReadModel>;
}

export interface IDashboardQueries {
  getSummary(scope: DashboardScope, range: DashboardRange): Promise<DashboardSummaryReadModel>;
}
