import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { EntryPurpose } from '../domain/entry-purpose.value-object';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { toFinanceTagId } from '../domain/finance-tag-id';
import { Money } from '../domain/money.value-object';
import { CRETA, SHOWROOM_A, SHOWROOM_B, SWIFT } from './fakes';

const T0 = new Date('2026-11-02T10:00:00.000Z');
const T1 = new Date('2026-11-02T11:00:00.000Z');

function entry(input: Partial<Parameters<typeof FinanceEntry.create>[0]> = {}): FinanceEntry {
  return FinanceEntry.create({
    id: toFinanceEntryId('11111111-1111-4111-8111-000000000001'),
    kind: 'expense',
    amount: Money.fromRupees(5000),
    entryDate: CalendarDate.create('2026-10-20'),
    purpose: null,
    tagIds: [],
    vehicleId: null,
    showroomId: SHOWROOM_A,
    party: null,
    note: null,
    recordedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: T0,
    ...input,
  });
}

describe('EntryPurpose', () => {
  it('defaults by kind and car link', () => {
    expect(EntryPurpose.defaultFor('expense', true).value).toBe('cost');
    expect(EntryPurpose.defaultFor('income', true).value).toBe('sale');
    expect(EntryPurpose.defaultFor('expense', false).value).toBe('general');
    expect(EntryPurpose.defaultFor('income', false).value).toBe('general');
  });

  it('allows only purposes that fit the kind and link', () => {
    expect(EntryPurpose.of('expense', true, 'purchase').value).toBe('purchase');
    expect(EntryPurpose.of('income', true, 'other').value).toBe('other');
    expect(() => EntryPurpose.of('expense', true, 'sale')).toThrow(BusinessRuleViolationError);
    expect(() => EntryPurpose.of('income', true, 'purchase')).toThrow(BusinessRuleViolationError);
    expect(() => EntryPurpose.of('expense', false, 'cost')).toThrow(BusinessRuleViolationError);
    expect(() => EntryPurpose.of('expense', true, 'general')).toThrow(BusinessRuleViolationError);
  });
});

describe('FinanceEntry', () => {
  it('rejects a zero amount, too many tags and over-long text', () => {
    expect(() => entry({ amount: Money.zero() })).toThrow(BusinessRuleViolationError);
    expect(() =>
      entry({ tagIds: Array.from({ length: 11 }, (_, i) => toFinanceTagId(`t${i}`)) }),
    ).toThrow(BusinessRuleViolationError);
    expect(() => entry({ party: 'x'.repeat(121) })).toThrow(BusinessRuleViolationError);
  });

  it('dedupes tags and turns blank text into null', () => {
    const tag = toFinanceTagId('t1');
    const created = entry({ tagIds: [tag, tag], party: '  ', note: ' paid cash ' });

    expect(created.tagIds).toEqual([tag]);
    expect(created.party).toBeNull();
    expect(created.note).toBe('paid cash');
  });

  it('linking takes the car showroom and resets purpose to the car default', () => {
    const e = entry();

    e.linkToVehicle(SWIFT, SHOWROOM_A, null, T1);
    expect(e.purpose).toBe('cost');

    e.changePurpose('purchase', T1);
    e.linkToVehicle(CRETA, SHOWROOM_B, null, T1);

    expect(e.vehicleId).toBe(CRETA);
    expect(e.showroomId).toBe(SHOWROOM_B);
    expect(e.purpose).toBe('cost');
    expect(e.updatedAt).toEqual(T1);
  });

  it('keeps an explicit purpose when linking, and keeps purpose when relinking the same car', () => {
    const e = entry();
    e.linkToVehicle(SWIFT, SHOWROOM_A, 'purchase', T1);
    expect(e.purpose).toBe('purchase');

    e.linkToVehicle(SWIFT, SHOWROOM_A, null, T1);
    expect(e.purpose).toBe('purchase');
  });

  it('unlinking makes it a general business entry', () => {
    const e = entry({ vehicleId: SWIFT, purpose: 'purchase' });

    e.unlink(SHOWROOM_B, T1);

    expect(e.vehicleId).toBeNull();
    expect(e.showroomId).toBe(SHOWROOM_B);
    expect(e.purpose).toBe('general');
  });

  it("won't move a car-linked entry to another showroom", () => {
    const e = entry({ vehicleId: SWIFT });

    expect(() => e.moveToShowroom(SHOWROOM_B, T1)).toThrow(BusinessRuleViolationError);
    e.moveToShowroom(SHOWROOM_A, T1);
  });

  it('soft deletes once', () => {
    const e = entry();
    e.softDelete(T1);
    e.softDelete(new Date('2026-12-01T00:00:00.000Z'));

    expect(e.deletedAt).toEqual(T1);
  });
});
