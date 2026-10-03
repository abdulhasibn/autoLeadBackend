import { describe, expect, it } from 'vitest';

import { isNotificationDue } from '../domain/is-notification-due';

const NOW = new Date('2026-10-03T10:00:00.000Z');

describe('isNotificationDue', () => {
  it('treats a null due time as visible now', () => {
    expect(isNotificationDue(null, NOW)).toBe(true);
  });

  it('hides a future reminder', () => {
    expect(isNotificationDue(new Date('2026-10-10T10:00:00.000Z'), NOW)).toBe(false);
  });

  it('shows a reminder once due', () => {
    expect(isNotificationDue(new Date('2026-10-03T10:00:00.000Z'), NOW)).toBe(true);
  });
});
