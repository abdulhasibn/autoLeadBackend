import { describe, expect, it } from 'vitest';

import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import type { EntryKindValue } from '../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../domain/entry-purpose.value-object';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { toFinanceTagId } from '../domain/finance-tag-id';
import { Money } from '../domain/money.value-object';
import { calculateVehicleMoney } from '../domain/vehicle-money';
import { SHOWROOM_A, SWIFT } from './fakes';

let seq = 0;
function carEntry(
  kind: EntryKindValue,
  rupees: number,
  purpose: EntryPurposeValue,
  tags: string[] = [],
): FinanceEntry {
  seq += 1;
  return FinanceEntry.create({
    id: toFinanceEntryId(`11111111-1111-4111-8111-${String(seq).padStart(12, '0')}`),
    kind,
    amount: Money.fromRupees(rupees),
    entryDate: CalendarDate.create('2026-10-10'),
    purpose,
    tagIds: tags.map(toFinanceTagId),
    vehicleId: SWIFT,
    showroomId: SHOWROOM_A,
    party: null,
    note: null,
    recordedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: new Date('2026-11-02T10:00:00.000Z'),
  });
}

/** The client's worked example (docs/plans/finance-module.md §2.1, §2.3). */
function clientExampleEntries(): FinanceEntry[] {
  return [
    carEntry('expense', 200000, 'purchase', ['purchase']),
    carEntry('expense', 300000, 'purchase', ['purchase']),
    carEntry('expense', 10000, 'cost', ['mediator']),
    carEntry('expense', 5000, 'cost', ['painting']),
    carEntry('expense', 5000, 'cost', ['service']),
    carEntry('expense', 5000, 'cost', ['polish']),
    carEntry('expense', 15000, 'cost', ['insurance', 'tyres']),
    carEntry('expense', 5000, 'cost', []),
    carEntry('income', 50000, 'sale'),
    carEntry('income', 510000, 'sale'),
  ];
}

const rupees = (paise: number | null): number | null => (paise === null ? null : paise / 100);

describe('calculateVehicleMoney', () => {
  it("matches the client's worked example", () => {
    const money = calculateVehicleMoney({
      purchaseRate: Money.fromRupees(500000),
      finalisedPrice: Money.fromRupees(560000),
      entries: clientExampleEntries(),
    });

    expect(rupees(money.landingCost)).toBe(545000);
    expect(rupees(money.costs)).toBe(45000);
    expect(rupees(money.profit)).toBe(15000);
    expect(rupees(money.owedToSeller)).toBe(0);
    expect(rupees(money.owedByBuyer)).toBe(0);
    expect(rupees(money.paidToSeller)).toBe(500000);
    expect(rupees(money.receivedFromBuyer)).toBe(560000);
  });

  it('groups costs by their first tag without double counting, untagged last bucket', () => {
    const money = calculateVehicleMoney({
      purchaseRate: Money.fromRupees(500000),
      finalisedPrice: null,
      entries: clientExampleEntries(),
    });

    const byTag = Object.fromEntries(
      money.costBreakdown.map((g) => [g.tagId ?? 'untagged', [g.paise / 100, g.count]]),
    );
    expect(byTag).toEqual({
      insurance: [15000, 1],
      mediator: [10000, 1],
      painting: [5000, 1],
      service: [5000, 1],
      polish: [5000, 1],
      untagged: [5000, 1],
    });
    expect(money.costBreakdown.reduce((sum, g) => sum + g.paise, 0)).toBe(money.costs);
  });

  it('leaves profit and buyer dues empty until the sale is recorded', () => {
    const money = calculateVehicleMoney({
      purchaseRate: Money.fromRupees(500000),
      finalisedPrice: null,
      entries: clientExampleEntries(),
    });

    expect(money.profit).toBeNull();
    expect(money.owedByBuyer).toBeNull();
    expect(rupees(money.owedToSeller)).toBe(0);
  });

  it('without a purchase rate: landing cost is the costs alone, no profit or seller dues', () => {
    const money = calculateVehicleMoney({
      purchaseRate: null,
      finalisedPrice: Money.fromRupees(560000),
      entries: clientExampleEntries(),
    });

    expect(rupees(money.landingCost)).toBe(45000);
    expect(money.profit).toBeNull();
    expect(money.owedToSeller).toBeNull();
    expect(rupees(money.owedByBuyer)).toBe(0);
  });

  it('shows part payments as dues, an overpaid seller as negative, and a loss as negative profit', () => {
    const money = calculateVehicleMoney({
      purchaseRate: Money.fromRupees(500000),
      finalisedPrice: Money.fromRupees(500000),
      entries: [
        carEntry('expense', 520000, 'purchase'),
        carEntry('expense', 30000, 'cost'),
        carEntry('income', 100000, 'sale'),
      ],
    });

    expect(rupees(money.owedToSeller)).toBe(-20000);
    expect(rupees(money.owedByBuyer)).toBe(400000);
    expect(rupees(money.profit)).toBe(-30000);
  });

  it('ignores other income and general entries', () => {
    const money = calculateVehicleMoney({
      purchaseRate: Money.fromRupees(100000),
      finalisedPrice: Money.fromRupees(150000),
      entries: [carEntry('income', 9999, 'other')],
    });

    expect(rupees(money.landingCost)).toBe(100000);
    expect(rupees(money.profit)).toBe(50000);
    expect(money.receivedFromBuyer).toBe(0);
  });
});
