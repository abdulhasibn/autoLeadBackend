import { DataIntegrityError } from '../../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import { ENTRY_PURPOSES, type EntryPurposeValue } from '../../domain/entry-purpose.value-object';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { Money } from '../../domain/money.value-object';
import type { SealedFinanceEntry } from '../../domain/sealed-finance-records';
import type { Logger } from '../../../../shared/logging/logger.port';
import type { EntryKindValue } from '../../domain/entry-kind.value-object';

interface EntryPayload {
  readonly amount: number;
  readonly purpose: EntryPurposeValue;
  readonly tagIds: readonly string[];
  readonly party: string | null;
  readonly note: string | null;
}

/**
 * Seals a ledger entry's private fields (amount, purpose, tags, party, note)
 * into one payload bound to `finance_entries:<id>`, and opens it again.
 *
 * Opening is tolerant of newer builds' data (so a rollback is safe): an unknown
 * purpose reads as the kind's default (expense -> cost, income -> other) and is
 * logged; unknown extra keys are ignored. A corrupt payload still throws.
 */
export class EntrySealer {
  constructor(private readonly logger?: Logger) {}

  seal(entry: FinanceEntry, cipher: FinanceCipher): SealedFinanceEntry {
    const payload: EntryPayload = {
      amount: entry.amount.paise,
      purpose: entry.purpose,
      tagIds: entry.tagIds,
      party: entry.party,
      note: entry.note,
    };
    return {
      id: entry.id,
      kind: entry.kind,
      vehicleId: entry.vehicleId,
      showroomId: entry.showroomId,
      entryDate: entry.entryDate.value,
      payload: cipher.seal(JSON.stringify(payload), aad(entry.id)),
      keyVersion: cipher.keyVersion,
      recordedBy: entry.recordedBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deletedAt: entry.deletedAt,
    };
  }

  open(record: SealedFinanceEntry, cipher: FinanceCipher): FinanceEntry {
    const payload = parsePayload(
      cipher.open(record.payload, aad(record.id)),
      record.id,
      record.kind,
      this.logger,
    );
    return FinanceEntry.reconstitute({
      id: record.id,
      kind: record.kind,
      amount: Money.ofPaise(payload.amount),
      entryDate: CalendarDate.create(record.entryDate),
      purpose: payload.purpose,
      tagIds: payload.tagIds.map(toFinanceTagId),
      vehicleId: record.vehicleId,
      showroomId: record.showroomId,
      party: payload.party,
      note: payload.note,
      recordedBy: record.recordedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}

function aad(id: string): string {
  return `finance_entries:${id}`;
}

const FALLBACK_PURPOSE: Readonly<Record<EntryKindValue, EntryPurposeValue>> = {
  expense: 'cost',
  income: 'other',
};

function parsePayload(
  json: string,
  id: string,
  kind: EntryKindValue,
  logger: Logger | undefined,
): EntryPayload {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new DataIntegrityError(`Finance entry ${id} has an unreadable payload`);
  }
  const p = value as Partial<Record<keyof EntryPayload, unknown>>;
  const valid =
    typeof value === 'object' &&
    value !== null &&
    typeof p.amount === 'number' &&
    Number.isSafeInteger(p.amount) &&
    p.amount > 0 &&
    typeof p.purpose === 'string' &&
    Array.isArray(p.tagIds) &&
    p.tagIds.every((t) => typeof t === 'string') &&
    (p.party === null || typeof p.party === 'string') &&
    (p.note === null || typeof p.note === 'string');
  if (!valid) {
    throw new DataIntegrityError(`Finance entry ${id} has an invalid payload`);
  }
  const payload = value as EntryPayload;
  if ((ENTRY_PURPOSES as readonly string[]).includes(payload.purpose)) {
    return payload;
  }
  // Written by a newer build (e.g. `refund`). Never log the value's payload or amounts.
  logger?.warn(
    { entryId: id, kind, fallback: FALLBACK_PURPOSE[kind] },
    'Finance entry has an unknown purpose; reading it as the default for its kind',
  );
  return { ...payload, purpose: FALLBACK_PURPOSE[kind] };
}
