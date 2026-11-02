import { describe, expect, it } from 'vitest';

import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { EntrySealer } from '../application/services/entry.sealer';
import { TagSealer } from '../application/services/tag.sealer';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { toFinanceTagId } from '../domain/finance-tag-id';
import { FinanceTag } from '../domain/finance-tag.entity';
import { Money } from '../domain/money.value-object';
import { TagColor } from '../domain/tag-color.value-object';
import { TagName } from '../domain/tag-name.value-object';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';
import { SHOWROOM_A, SWIFT } from './fakes';

const crypto = new NodeFinanceCrypto();
const cipher = crypto.cipherFor(crypto.newDataKey(), 1);
const NOW = new Date('2026-11-02T10:00:00.000Z');

function mediatorPayment(): FinanceEntry {
  return FinanceEntry.create({
    id: toFinanceEntryId('11111111-1111-4111-8111-000000000001'),
    kind: 'expense',
    amount: Money.fromRupees(10000),
    entryDate: CalendarDate.create('2026-10-20'),
    purpose: null,
    tagIds: [toFinanceTagId('22222222-2222-4222-8222-000000000001')],
    vehicleId: SWIFT,
    showroomId: SHOWROOM_A,
    party: 'Ravi (mediator)',
    note: 'Paid in cash at handover',
    recordedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: NOW,
  });
}

describe('EntrySealer', () => {
  const sealer = new EntrySealer();

  it('round-trips an entry', () => {
    const original = mediatorPayment();

    const opened = sealer.open(sealer.seal(original, cipher), cipher);

    expect(opened.amount.paise).toBe(1_000_000);
    expect(opened.purpose).toBe('cost');
    expect(opened.tagIds).toEqual(original.tagIds);
    expect(opened.party).toBe('Ravi (mediator)');
    expect(opened.vehicleId).toBe(SWIFT);
  });

  it('keeps amount, purpose, tags, party and note out of the plaintext columns', () => {
    const sealed = sealer.seal(mediatorPayment(), cipher);
    const { payload, ...columns } = sealed;
    const visible = JSON.stringify(columns);

    for (const secret of ['1000000', '10000', 'cost', 'Ravi', 'cash', '22222222-2222']) {
      expect(visible).not.toContain(secret);
      expect(payload).not.toContain(secret);
    }
    expect(columns.kind).toBe('expense');
    expect(columns.vehicleId).toBe(SWIFT);
  });

  it('refuses a payload moved to another entry', () => {
    const a = sealer.seal(mediatorPayment(), cipher);
    const moved = { ...a, id: toFinanceEntryId('11111111-1111-4111-8111-000000000002') };

    expect(() => sealer.open(moved, cipher)).toThrow(DataIntegrityError);
  });
});

describe('TagSealer', () => {
  it('round-trips a tag and hides its name', () => {
    const sealer = new TagSealer();
    const tag = FinanceTag.create({
      id: toFinanceTagId('22222222-2222-4222-8222-000000000001'),
      name: TagName.create('Mediator commission'),
      color: TagColor.create('#1e88e5'),
      now: NOW,
    });

    const sealed = sealer.seal(tag, cipher);
    const opened = sealer.open(sealed, cipher);

    expect(sealed.payload).not.toContain('Mediator');
    expect(opened.name.value).toBe('Mediator commission');
    expect(opened.color?.value).toBe('#1E88E5');
  });
});
