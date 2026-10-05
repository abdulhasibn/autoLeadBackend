import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';

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

function monthOf(date: CalendarDate): number {
  return Number(date.value.slice(5, 7));
}

function dayOfWeek(date: CalendarDate): number {
  const [year, month, day] = date.value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** First day of the month `offset` months away from `date`'s month. */
function monthStart(date: CalendarDate, offset: number): CalendarDate {
  const year = Number(date.value.slice(0, 4));
  const monthIndex = year * 12 + (monthOf(date) - 1) + offset;
  const yyyy = String(Math.floor(monthIndex / 12)).padStart(4, '0');
  const mm = String((monthIndex % 12) + 1).padStart(2, '0');
  return CalendarDate.create(`${yyyy}-${mm}-01`);
}

function localDate(instant: Date, timeZone: string): CalendarDate {
  const parts = zonedParts(instant.getTime(), timeZone);
  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return CalendarDate.create(`${yyyy}-${mm}-${dd}`);
}

/** The UTC instant of 00:00 on `date` in `timeZone`. */
function zonedMidnight(date: CalendarDate, timeZone: string): Date {
  const [year, month, day] = date.value.split('-').map(Number) as [number, number, number];
  const wallClock = Date.UTC(year, month - 1, day);
  const firstGuess = wallClock - offsetMs(wallClock, timeZone);
  // Re-read the offset at the guessed instant so DST transitions land right.
  return new Date(wallClock - offsetMs(firstGuess, timeZone));
}

function offsetMs(epochMs: number, timeZone: string): number {
  const whole = Math.floor(epochMs / 1000) * 1000;
  const p = zonedParts(whole, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}
