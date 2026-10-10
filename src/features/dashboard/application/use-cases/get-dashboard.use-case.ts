import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import { resolveDashboardWindow } from '../../domain/dashboard-window';
import type {
  FollowUpItemReadModel,
  IDashboardQueries,
  LeadItemReadModel,
  PeriodCount,
  VehicleItemReadModel,
  VehicleLabelParts,
} from '../../domain/dashboard.queries';
import type {
  DashboardDto,
  FollowUpCardDto,
  GetDashboardQuery,
  LeadCardDto,
  VehicleCardDto,
} from '../dtos/dashboard.dto';
import type { DashboardPolicy } from '../policies/dashboard.policy';

/** A listed vehicle older than this is aged stock. */
export const AGED_STOCK_DAYS = 45;

/** Rows returned per dashboard list; `total` carries the full count. */
export const DASHBOARD_LIST_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GetDashboardSettings {
  readonly timeZone: string;
}

export class GetDashboardUseCase {
  constructor(
    private readonly policy: DashboardPolicy,
    private readonly queries: IDashboardQueries,
    private readonly clock: Clock,
    private readonly settings: GetDashboardSettings,
  ) {}

  async execute(query: GetDashboardQuery, ctx: AuthenticatedContext): Promise<DashboardDto> {
    this.policy.requireStaff(ctx);

    const now = this.clock.now();
    const window = resolveDashboardWindow(query.period, now, this.settings.timeZone);
    const scope = this.policy.scope(ctx, query.showroomId);
    // Inventory is showroom-wide, so an assignee-scoped dashboard leaves it out.
    const showStock = scope.assigneeId === null;
    const summary = await this.queries.getSummary(scope, {
      from: window.from,
      now,
      previousFrom: window.previousFrom,
      previousUntil: window.previousUntil,
      todayEnd: window.todayEnd,
      agedBefore: new Date(now.getTime() - AGED_STOCK_DAYS * DAY_MS),
      listLimit: DASHBOARD_LIST_LIMIT,
    });

    return {
      generatedAt: now.toISOString(),
      scope: showStock ? 'all' : 'mine',
      period: {
        key: window.key,
        from: window.startDate,
        to: window.endDate,
        timezone: window.timeZone,
      },
      kpis: {
        carsSold: trend(summary.carsSold),
        newLeads: trend(summary.newLeads),
        conversionRate: {
          value: conversionRate(summary.converted.current, summary.lost.current),
          previous: conversionRate(summary.converted.previous, summary.lost.previous),
        },
        inStock: showStock ? { value: summary.inventory.open + summary.inventory.linked } : null,
      },
      attention: {
        overdueFollowUps: {
          total: summary.overdueFollowUps.total,
          items: summary.overdueFollowUps.items.map(toFollowUpCard),
        },
        leadsWithoutFollowUp: {
          total: summary.leadsWithoutFollowUp.total,
          items: summary.leadsWithoutFollowUp.items.map(toLeadCard),
        },
        agedStock: showStock
          ? {
              total: summary.agedStock.total,
              items: summary.agedStock.items.map((item) => toVehicleCard(item, now)),
            }
          : null,
      },
      today: {
        total: summary.todayFollowUps.total,
        items: summary.todayFollowUps.items.map(toFollowUpCard),
      },
      pipeline: summary.pipeline,
      inventory: showStock ? summary.inventory : null,
    };
  }
}

function trend(count: PeriodCount): { value: number; previous: number } {
  return { value: count.current, previous: count.previous };
}

/** Share of closed leads that converted; null when nothing closed. */
function conversionRate(converted: number, lost: number): number | null {
  const closed = converted + lost;
  if (closed === 0) {
    return null;
  }
  return Math.round((converted / closed) * 1000) / 1000;
}

function vehicleLabel(parts: VehicleLabelParts): string {
  return `${parts.year} ${parts.make} ${parts.model} ${parts.variant} · ${parts.registrationNumber}`;
}

function toFollowUpCard(item: FollowUpItemReadModel): FollowUpCardDto {
  return {
    followUpId: item.followUpId,
    leadId: item.leadId,
    taskType: item.taskType,
    scheduledAt: item.scheduledAt,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    vehicleLabel: item.vehicle === null ? null : vehicleLabel(item.vehicle),
  };
}

function toLeadCard(item: LeadItemReadModel): LeadCardDto {
  return {
    leadId: item.leadId,
    status: item.status,
    source: item.source,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    vehicleLabel: item.vehicle === null ? null : vehicleLabel(item.vehicle),
    createdAt: item.createdAt,
  };
}

function toVehicleCard(item: VehicleItemReadModel, now: Date): VehicleCardDto {
  return {
    vehicleId: item.vehicleId,
    vehicleLabel: vehicleLabel(item.vehicle),
    status: item.status,
    daysListed: Math.floor((now.getTime() - new Date(item.createdAt).getTime()) / DAY_MS),
    activeLeads: item.activeLeads,
  };
}
