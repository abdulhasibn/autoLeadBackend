import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IInsightsQueries, VehicleStatsReadModel } from '../../domain/insights.queries';
import { rate } from '../../domain/rate';
import { stockBaseline, vehicleSignal } from '../../domain/vehicle-signal';
import type { InsightsQuery, VehicleInsightRowDto, VehicleInsightsDto } from '../dtos/insights.dto';
import { insightsWindow, vehicleTitle, type InsightsSettings } from '../insights-window';
import type { InsightsPolicy } from '../policies/insights.policy';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Live stock (open / linked) with website demand and a pricing signal, most viewed first. */
export class GetVehicleInsightsUseCase {
  constructor(
    private readonly policy: InsightsPolicy,
    private readonly queries: IInsightsQueries,
    private readonly clock: Clock,
    private readonly settings: InsightsSettings,
  ) {}

  async execute(query: InsightsQuery, ctx: AuthenticatedContext): Promise<VehicleInsightsDto> {
    this.policy.requireAdmin(ctx);
    const now = this.clock.now();
    const { range, period } = insightsWindow(query.period, now, this.settings.timeZone);
    const stats = await this.queries.getVehicleStats(
      this.policy.showroom(query.showroomId),
      range,
      null,
    );
    return { period, items: toVehicleRows(stats, now) };
  }
}

/**
 * Shapes stats into rows. Signals compare each car with the whole list, so
 * pass every car in scope (the detail endpoint passes stock plus its car).
 */
export function toVehicleRows(
  stats: readonly VehicleStatsReadModel[],
  now: Date,
): VehicleInsightRowDto[] {
  const base = stats.map((car) => ({
    car,
    daysInStock: Math.max(0, Math.floor((now.getTime() - Date.parse(car.createdAt)) / DAY_MS)),
    leadRate: rate(car.leads, car.uniqueViewers),
  }));
  const baseline = stockBaseline(
    base.map(({ car, daysInStock, leadRate }) => ({ views: car.views, leadRate, daysInStock })),
  );
  return base.map(({ car, daysInStock, leadRate }) => ({
    vehicleId: car.vehicleId,
    title: vehicleTitle(car),
    listedPrice: car.listedPrice,
    daysInStock,
    views: car.views,
    uniqueViewers: car.uniqueViewers,
    repeatViewers: car.repeatViewers,
    testDriveOpens: car.testDriveOpens,
    contactClicks: car.contactClicks,
    leads: car.leads,
    leadRate,
    topChannel: car.topChannel,
    signal: vehicleSignal({ views: car.views, leadRate, daysInStock }, baseline),
  }));
}
