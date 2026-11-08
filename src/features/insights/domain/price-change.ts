import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { DailyCounts } from './insights.queries';

/** Days compared on each side of a price change. */
export const PRICE_CHANGE_SPAN_DAYS = 14;

export interface RatePerDay {
  readonly viewsPerDay: number;
  readonly leadsPerDay: number;
}

export interface PriceChange {
  readonly at: string;
  readonly from: number;
  readonly to: number;
  readonly before: RatePerDay;
  readonly after: RatePerDay;
}

export interface PriceHistoryEntry {
  readonly price: number | null;
  readonly changedAt: string;
  /** Business-timezone date of `changedAt`. */
  readonly changedOn: string;
}

/**
 * Listed-price changes inside the period, each with daily views and leads
 * over up to 14 days before (from the day the car was listed, at the
 * earliest) and up to 14 days from the change day to today.
 *
 * `daily` must be a dense series of business dates covering the comparison
 * spans. Clearing a price, or setting the first one, is not a change.
 */
export function priceChanges(
  history: readonly PriceHistoryEntry[],
  daily: readonly DailyCounts[],
  window: { readonly periodStart: string; readonly today: string; readonly listedOn: string },
): PriceChange[] {
  const changes: PriceChange[] = [];
  let previous: number | null = null;
  for (const entry of history) {
    const from: number | null = previous;
    previous = entry.price;
    if (from === null || entry.price === null || from === entry.price) continue;
    if (entry.changedOn < window.periodStart || entry.changedOn > window.today) continue;

    const before = daily.filter(
      (d) =>
        d.date < entry.changedOn &&
        d.date >= window.listedOn &&
        d.date >= addDays(entry.changedOn, -PRICE_CHANGE_SPAN_DAYS),
    );
    const after = daily.filter(
      (d) =>
        d.date >= entry.changedOn &&
        d.date <= window.today &&
        d.date < addDays(entry.changedOn, PRICE_CHANGE_SPAN_DAYS),
    );
    changes.push({
      at: entry.changedAt,
      from,
      to: entry.price,
      before: perDay(before),
      after: perDay(after),
    });
  }
  return changes;
}

function perDay(days: readonly DailyCounts[]): RatePerDay {
  if (days.length === 0) return { viewsPerDay: 0, leadsPerDay: 0 };
  const views = days.reduce((sum, d) => sum + d.views, 0);
  const leads = days.reduce((sum, d) => sum + d.leads, 0);
  return {
    viewsPerDay: Math.round((views / days.length) * 100) / 100,
    leadsPerDay: Math.round((leads / days.length) * 100) / 100,
  };
}

function addDays(date: string, days: number): string {
  return CalendarDate.create(date).addDays(days).value;
}
