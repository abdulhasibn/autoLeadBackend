import {
  dayOfWeek,
  localDate,
  monthOf,
  monthStart,
  zonedMidnight,
} from '../../../domain/shared/business-calendar';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';

export const DASHBOARD_PERIODS = ['today', 'week', 'month', 'quarter'] as const;

export type DashboardPeriodKey = (typeof DASHBOARD_PERIODS)[number];

/**
 * The time ranges one dashboard read covers. Calendar boundaries are taken in
 * the business timezone; instants are UTC.
 *
 * The current range runs from the period start up to `now` (period to date).
 * The previous range is the same elapsed span from the start of the previous
 * period, so Oct 1–5 compares with Sep 1–5, not with all of September.
 */
export interface DashboardWindow {
  readonly key: DashboardPeriodKey;
  readonly timeZone: string;
  /** First calendar day of the period (YYYY-MM-DD). */
  readonly startDate: string;
  /** Last calendar day of the period, inclusive (YYYY-MM-DD). */
  readonly endDate: string;
  readonly from: Date;
  readonly now: Date;
  readonly previousFrom: Date;
  readonly previousUntil: Date;
  /** Midnight at the end of today. */
  readonly todayEnd: Date;
}

export function resolveDashboardWindow(
  key: DashboardPeriodKey,
  now: Date,
  timeZone: string,
): DashboardWindow {
  const today = localDate(now, timeZone);
  const { start, end, previousStart } = periodDays(key, today);

  const from = zonedMidnight(start, timeZone);
  const previousFrom = zonedMidnight(previousStart, timeZone);
  const elapsed = now.getTime() - from.getTime();
  const previousUntil = new Date(Math.min(previousFrom.getTime() + elapsed, from.getTime()));

  return {
    key,
    timeZone,
    startDate: start.value,
    endDate: end.value,
    from,
    now,
    previousFrom,
    previousUntil,
    todayEnd: zonedMidnight(today.addDays(1), timeZone),
  };
}

interface PeriodDays {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
  readonly previousStart: CalendarDate;
}

function periodDays(key: DashboardPeriodKey, today: CalendarDate): PeriodDays {
  switch (key) {
    case 'today':
      return { start: today, end: today, previousStart: today.addDays(-1) };
    case 'week': {
      // ISO weeks start on Monday.
      const start = today.addDays(-((dayOfWeek(today) + 6) % 7));
      return { start, end: start.addDays(6), previousStart: start.addDays(-7) };
    }
    case 'month': {
      const start = monthStart(today, 0);
      return {
        start,
        end: monthStart(today, 1).addDays(-1),
        previousStart: monthStart(today, -1),
      };
    }
    case 'quarter': {
      const quarterOffset = -((monthOf(today) - 1) % 3);
      const start = monthStart(today, quarterOffset);
      return {
        start,
        end: monthStart(today, quarterOffset + 3).addDays(-1),
        previousStart: monthStart(today, quarterOffset - 3),
      };
    }
  }
}
