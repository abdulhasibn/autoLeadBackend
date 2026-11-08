import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { localDate } from '../../../../domain/shared/business-calendar';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import type { Clock } from '../../../../shared/clock/clock';
import { segmentOf, shareOfSearchesBelow } from '../../domain/demand';
import type { DailyCounts, IInsightsQueries } from '../../domain/insights.queries';
import { PRICE_CHANGE_SPAN_DAYS, priceChanges } from '../../domain/price-change';
import type { InsightsQuery, VehicleInsightDetailDto } from '../dtos/insights.dto';
import { insightsWindow, type InsightsSettings } from '../insights-window';
import type { InsightsPolicy } from '../policies/insights.policy';
import { toVehicleRows } from './get-vehicle-insights.use-case';

export interface GetVehicleInsightDetailQuery extends InsightsQuery {
  readonly vehicleId: string;
}

/**
 * One car's demand over the period: the list row (signal judged against live
 * stock), a daily views/leads series from the period start to today,
 * listed-price changes with before/after rates, views by channel and where
 * its price sits against what visitors search for.
 */
export class GetVehicleInsightDetailUseCase {
  constructor(
    private readonly policy: InsightsPolicy,
    private readonly queries: IInsightsQueries,
    private readonly clock: Clock,
    private readonly settings: InsightsSettings,
  ) {}

  async execute(
    query: GetVehicleInsightDetailQuery,
    ctx: AuthenticatedContext,
  ): Promise<VehicleInsightDetailDto> {
    this.policy.requireAdmin(ctx);
    const now = this.clock.now();
    const { timeZone } = this.settings;
    const { window, range, period } = insightsWindow(query.period, now, timeZone);
    const showroomId = this.policy.showroom(query.showroomId);
    // Price changes early in the period still get a "before" span.
    const seriesFrom = new Date(window.from.getTime() - PRICE_CHANGE_SPAN_DAYS * 86_400_000);

    const [stats, detail, demand] = await Promise.all([
      this.queries.getVehicleStats(showroomId, range, query.vehicleId),
      this.queries.getVehicleDetail(query.vehicleId, seriesFrom, range, timeZone),
      this.queries.getDemand(showroomId, range, 0),
    ]);

    const rows = toVehicleRows(stats, now);
    const row = rows.find((item) => item.vehicleId === query.vehicleId);
    const car = stats.find((item) => item.vehicleId === query.vehicleId);
    if (row === undefined || car === undefined) {
      throw new NotFoundError('Vehicle not found');
    }

    const today = localDate(now, timeZone).value;
    const series = denseSeries(detail.daily, localDate(seriesFrom, timeZone).value, today);

    return {
      ...row,
      period,
      daily: series.filter((day) => day.date >= window.startDate),
      priceChanges: priceChanges(
        detail.priceHistory.map((entry) => ({
          price: entry.price,
          changedAt: entry.changedAt,
          changedOn: localDate(new Date(entry.changedAt), timeZone).value,
        })),
        series,
        {
          periodStart: window.startDate,
          today,
          listedOn: localDate(new Date(car.createdAt), timeZone).value,
        },
      ),
      channels: detail.channels,
      budgetContext: {
        segment: segmentOf(car.bodyType),
        shareBelowPrice: shareOfSearchesBelow(demand.searchPrices, car.listedPrice),
      },
    };
  }
}

/** Every date from `from` to `to` inclusive, zero-filled. */
function denseSeries(sparse: readonly DailyCounts[], from: string, to: string): DailyCounts[] {
  const byDate = new Map(sparse.map((day) => [day.date, day]));
  const series: DailyCounts[] = [];
  for (let date = CalendarDate.create(from); date.value <= to; date = date.addDays(1)) {
    const day = byDate.get(date.value);
    series.push({ date: date.value, views: day?.views ?? 0, leads: day?.leads ?? 0 });
  }
  return series;
}
