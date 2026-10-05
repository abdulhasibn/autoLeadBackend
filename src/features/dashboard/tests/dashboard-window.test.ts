import { describe, expect, it } from 'vitest';

import { resolveDashboardWindow } from '../domain/dashboard-window';

const IST = 'Asia/Kolkata';

describe('resolveDashboardWindow', () => {
  it('runs a month window to date and compares with the same span last month', () => {
    // 2026-10-05 15:00 IST
    const now = new Date('2026-10-05T09:30:00.000Z');
    const window = resolveDashboardWindow('month', now, IST);

    expect(window.startDate).toBe('2026-10-01');
    expect(window.endDate).toBe('2026-10-31');
    expect(window.from.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(window.previousFrom.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    expect(window.previousUntil.toISOString()).toBe('2026-09-05T09:30:00.000Z');
    expect(window.todayEnd.toISOString()).toBe('2026-10-05T18:30:00.000Z');
  });

  it('uses the business timezone to decide what day it is', () => {
    // 2026-10-31 20:00 UTC is already 2026-11-01 01:30 in IST
    const window = resolveDashboardWindow('month', new Date('2026-10-31T20:00:00.000Z'), IST);

    expect(window.startDate).toBe('2026-11-01');
    expect(window.endDate).toBe('2026-11-30');
    expect(window.from.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  it('caps the previous range at the current period start', () => {
    // March 31 is longer into the month than February has days.
    const window = resolveDashboardWindow('month', new Date('2026-03-31T12:00:00.000Z'), 'UTC');

    expect(window.previousFrom.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(window.previousUntil.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('starts weeks on Monday', () => {
    // Sunday 2026-10-11
    const window = resolveDashboardWindow('week', new Date('2026-10-11T06:00:00.000Z'), 'UTC');

    expect(window.startDate).toBe('2026-10-05');
    expect(window.endDate).toBe('2026-10-11');
    expect(window.previousFrom.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('rolls quarters across the year boundary', () => {
    const window = resolveDashboardWindow('quarter', new Date('2027-02-10T00:00:00.000Z'), 'UTC');

    expect(window.startDate).toBe('2027-01-01');
    expect(window.endDate).toBe('2027-03-31');
    expect(window.previousFrom.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('compares today with yesterday up to the same time', () => {
    const window = resolveDashboardWindow('today', new Date('2026-10-05T10:00:00.000Z'), 'UTC');

    expect(window.startDate).toBe('2026-10-05');
    expect(window.endDate).toBe('2026-10-05');
    expect(window.previousFrom.toISOString()).toBe('2026-10-04T00:00:00.000Z');
    expect(window.previousUntil.toISOString()).toBe('2026-10-04T10:00:00.000Z');
  });

  it('finds local midnight across a DST change', () => {
    // US clocks go back on 2026-11-01; midnight that day is still EDT (UTC-4).
    const window = resolveDashboardWindow(
      'today',
      new Date('2026-11-01T15:00:00.000Z'),
      'America/New_York',
    );

    expect(window.from.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(window.todayEnd.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
});
