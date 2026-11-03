import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import {
  daysBetween,
  monthStart,
  startOfIsoWeek,
  startOfYear,
} from '../../../domain/shared/business-calendar';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';

export const REPORT_PERIODS = ['day', 'week', 'month', 'year'] as const;

export type ReportPeriodValue = (typeof REPORT_PERIODS)[number];

export interface ReportBucket {
  /** First day of the bucket (YYYY-MM-DD). Weeks start on Monday (ISO). */
  readonly start: string;
  /** Last day of the bucket, inclusive, clipped to the report range. */
  readonly end: string;
  /** `2026-10-25` (day, week start), `2026-10` (month), `2026` (year). */
  readonly label: string;
}

const MAX_RANGE_DAYS: Readonly<Record<ReportPeriodValue, number>> = {
  day: 366,
  week: 366,
  month: 5 * 366,
  year: 5 * 366,
};

/**
 * How a report groups dates. Finance dates are calendar dates (`entry_date`,
 * `sold_on`), so bucketing needs no timezone.
 */
export class ReportPeriod {
  private constructor(readonly value: ReportPeriodValue) {}

  static create(input: string): ReportPeriod {
    if (!(REPORT_PERIODS as readonly string[]).includes(input)) {
      throw new Error(`period must be one of: ${REPORT_PERIODS.join(', ')}`);
    }
    return new ReportPeriod(input as ReportPeriodValue);
  }

  bucketStart(date: CalendarDate): CalendarDate {
    switch (this.value) {
      case 'day':
        return date;
      case 'week':
        return startOfIsoWeek(date);
      case 'month':
        return monthStart(date, 0);
      case 'year':
        return startOfYear(date);
    }
  }

  /** Every bucket overlapping `from`–`to`, in order; empty buckets included. */
  bucketsBetween(from: CalendarDate, to: CalendarDate): ReportBucket[] {
    const buckets: ReportBucket[] = [];
    let start = this.bucketStart(from);
    while (start.value <= to.value) {
      const next = this.nextStart(start);
      const end = next.addDays(-1);
      buckets.push({
        start: start.value < from.value ? from.value : start.value,
        end: end.value > to.value ? to.value : end.value,
        label: this.label(start),
      });
      start = next;
    }
    return buckets;
  }

  /** Throws when the range is backwards or too long for this period. */
  assertRange(from: CalendarDate, to: CalendarDate): void {
    const days = daysBetween(from, to) + 1;
    if (days < 1) {
      throw new BusinessRuleViolationError('INVALID_DATE_RANGE', 'to must not be before from');
    }
    if (days > MAX_RANGE_DAYS[this.value]) {
      throw new BusinessRuleViolationError(
        'DATE_RANGE_TOO_LONG',
        `A ${this.value} report can cover at most ${MAX_RANGE_DAYS[this.value]} days`,
      );
    }
  }

  private nextStart(start: CalendarDate): CalendarDate {
    switch (this.value) {
      case 'day':
        return start.addDays(1);
      case 'week':
        return start.addDays(7);
      case 'month':
        return monthStart(start, 1);
      case 'year':
        return monthStart(start, 12);
    }
  }

  private label(start: CalendarDate): string {
    switch (this.value) {
      case 'day':
      case 'week':
        return start.value;
      case 'month':
        return start.value.slice(0, 7);
      case 'year':
        return start.value.slice(0, 4);
    }
  }
}

/** Index of the bucket containing `date`, or -1 when it falls outside them all. */
export function bucketIndexOf(buckets: readonly ReportBucket[], date: string): number {
  return buckets.findIndex((bucket) => bucket.start <= date && date <= bucket.end);
}
