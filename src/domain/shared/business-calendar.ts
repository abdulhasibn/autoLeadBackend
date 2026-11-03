import { CalendarDate } from './calendar-date.value-object';

/**
 * Calendar arithmetic on business dates. Day and period boundaries are taken
 * in the business timezone (`BUSINESS_TIMEZONE`); instants are UTC. Shared by
 * the dashboard and finance features.
 */

export function monthOf(date: CalendarDate): number {
  return Number(date.value.slice(5, 7));
}

export function dayOfWeek(date: CalendarDate): number {
  const [year, month, day] = date.value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** First day of the month `offset` months away from `date`'s month. */
export function monthStart(date: CalendarDate, offset: number): CalendarDate {
  const year = Number(date.value.slice(0, 4));
  const monthIndex = year * 12 + (monthOf(date) - 1) + offset;
  const yyyy = String(Math.floor(monthIndex / 12)).padStart(4, '0');
  const mm = String((monthIndex % 12) + 1).padStart(2, '0');
  return CalendarDate.create(`${yyyy}-${mm}-01`);
}

export function localDate(instant: Date, timeZone: string): CalendarDate {
  const parts = zonedParts(instant.getTime(), timeZone);
  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return CalendarDate.create(`${yyyy}-${mm}-${dd}`);
}

/** The UTC instant of 00:00 on `date` in `timeZone`. */
export function zonedMidnight(date: CalendarDate, timeZone: string): Date {
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

/** Monday of the ISO week containing `date`. */
export function startOfIsoWeek(date: CalendarDate): CalendarDate {
  return date.addDays(-((dayOfWeek(date) + 6) % 7));
}

/** 1 January of `date`'s year. */
export function startOfYear(date: CalendarDate): CalendarDate {
  return CalendarDate.create(`${date.value.slice(0, 4)}-01-01`);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((Date.parse(to.value) - Date.parse(from.value)) / 86_400_000);
}
