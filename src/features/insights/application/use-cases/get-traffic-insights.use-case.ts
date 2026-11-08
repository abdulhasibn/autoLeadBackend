import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type {
  IInsightsQueries,
  TrafficCounts,
  TrafficReadModel,
} from '../../domain/insights.queries';
import { rate } from '../../domain/rate';
import type { InsightsQuery, TrafficInsightsDto, TrafficTotalsDto } from '../dtos/insights.dto';
import { insightsWindow, type InsightsSettings } from '../insights-window';
import type { InsightsPolicy } from '../policies/insights.policy';

/** Campaign rows returned, most visited first. */
export const CAMPAIGN_LIMIT = 10;
/** Named cities returned; the rest (and visits without a city) are "Other". */
export const CITY_LIMIT = 4;
export const OTHER_CITY = 'Other';

export class GetTrafficInsightsUseCase {
  constructor(
    private readonly policy: InsightsPolicy,
    private readonly queries: IInsightsQueries,
    private readonly clock: Clock,
    private readonly settings: InsightsSettings,
  ) {}

  async execute(query: InsightsQuery, ctx: AuthenticatedContext): Promise<TrafficInsightsDto> {
    this.policy.requireAdmin(ctx);
    const { range, previous, period } = insightsWindow(
      query.period,
      this.clock.now(),
      this.settings.timeZone,
    );
    const traffic = await this.queries.getTraffic(
      this.policy.showroom(query.showroomId),
      range,
      previous,
      CAMPAIGN_LIMIT,
    );

    return {
      period,
      ...totals(traffic.current),
      previous: totals(traffic.previous),
      channels: traffic.channels,
      campaigns: traffic.campaigns.map((row) => ({
        campaign: row.campaign,
        content: row.content,
        visits: row.visits,
        leads: row.leads,
        leadRate: rate(row.leads, row.visits),
        bookings: row.bookings,
      })),
      devices: traffic.devices,
      cities: topCities(traffic.cities),
    };
  }
}

function totals(counts: TrafficCounts): TrafficTotalsDto {
  return {
    visitors: counts.visitors,
    sessions: counts.sessions,
    leads: counts.leads,
    visitorToLeadRate: rate(counts.leads, counts.visitors),
  };
}

function topCities(cities: TrafficReadModel['cities']): { city: string; visitors: number }[] {
  const named = cities
    .filter((row): row is { city: string; visitors: number } => row.city !== null)
    .sort((a, b) => b.visitors - a.visitors);
  const top = named.slice(0, CITY_LIMIT);
  const other =
    named.slice(CITY_LIMIT).reduce((sum, row) => sum + row.visitors, 0) +
    cities.filter((row) => row.city === null).reduce((sum, row) => sum + row.visitors, 0);
  const result = top.map((row) => ({ city: row.city, visitors: row.visitors }));
  return other > 0 ? [...result, { city: OTHER_CITY, visitors: other }] : result;
}
