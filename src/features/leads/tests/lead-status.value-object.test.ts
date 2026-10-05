import { describe, expect, it } from 'vitest';

import { LeadStatus } from '../domain/lead-status.value-object';

const s = (value: string): LeadStatus => LeadStatus.create(value);

describe('LeadStatus', () => {
  it('moves between new and not_now and on to booking', () => {
    expect(s('new').canTransitionTo(s('not_now'))).toBe(true);
    expect(s('not_now').canTransitionTo(s('new'))).toBe(true);
    expect(s('not_now').canTransitionTo(s('booking_confirmed'))).toBe(true);
    expect(s('booking_confirmed').canTransitionTo(s('converted'))).toBe(true);
  });

  it('only converts from booking_confirmed', () => {
    expect(s('new').canTransitionTo(s('converted'))).toBe(false);
    expect(s('not_now').canTransitionTo(s('converted'))).toBe(false);
  });

  it('can lose any open lead', () => {
    for (const from of ['new', 'not_now', 'booking_confirmed', 'vehicle_unavailable']) {
      expect(s(from).canTransitionTo(s('lost'))).toBe(true);
    }
  });

  it('treats converted and lost as terminal', () => {
    expect(s('converted').isTerminal()).toBe(true);
    expect(s('lost').isTerminal()).toBe(true);
    expect(s('converted').canTransitionTo(s('lost'))).toBe(false);
    expect(s('vehicle_unavailable').isTerminal()).toBe(false);
  });

  it('revives a vehicle_unavailable lead', () => {
    expect(s('vehicle_unavailable').canTransitionTo(s('new'))).toBe(true);
    expect(s('vehicle_unavailable').canTransitionTo(s('booking_confirmed'))).toBe(true);
  });

  it('counts new, not_now and booking_confirmed as active', () => {
    expect(['new', 'not_now', 'booking_confirmed'].every((v) => s(v).isActive())).toBe(true);
    expect(['converted', 'lost', 'vehicle_unavailable'].some((v) => s(v).isActive())).toBe(false);
  });

  it('keeps vehicle_unavailable system-only', () => {
    expect(s('vehicle_unavailable').isManuallySettable()).toBe(false);
    expect(s('lost').isManuallySettable()).toBe(true);
  });

  it('rejects removed statuses', () => {
    expect(() => s('contacted')).toThrow('Invalid lead status');
    expect(() => s('sold')).toThrow('Invalid lead status');
  });
});
