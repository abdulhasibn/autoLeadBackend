import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  localDate,
  monthStart,
  startOfIsoWeek,
  startOfYear,
} from './business-calendar';
import { CalendarDate } from './calendar-date.value-object';

const d = (value: string): CalendarDate => CalendarDate.create(value);

describe('business calendar', () => {
  it('starts ISO weeks on Monday, across a year boundary', () => {
    expect(startOfIsoWeek(d('2026-11-03')).value).toBe('2026-11-02');
    expect(startOfIsoWeek(d('2026-11-02')).value).toBe('2026-11-02');
    expect(startOfIsoWeek(d('2027-01-03')).value).toBe('2026-12-28');
  });

  it('finds month and year starts', () => {
    expect(monthStart(d('2028-02-29'), 0).value).toBe('2028-02-01');
    expect(monthStart(d('2026-01-15'), -1).value).toBe('2025-12-01');
    expect(startOfYear(d('2026-11-03')).value).toBe('2026-01-01');
  });

  it('counts days between dates', () => {
    expect(daysBetween(d('2026-10-01'), d('2026-10-31'))).toBe(30);
    expect(daysBetween(d('2026-10-31'), d('2026-10-01'))).toBe(-30);
    expect(daysBetween(d('2028-02-28'), d('2028-03-01'))).toBe(2);
  });

  it('takes today in the business timezone', () => {
    const lateUtc = new Date('2026-10-31T20:00:00.000Z');

    expect(localDate(lateUtc, 'UTC').value).toBe('2026-10-31');
    expect(localDate(lateUtc, 'Asia/Kolkata').value).toBe('2026-11-01');
  });
});
