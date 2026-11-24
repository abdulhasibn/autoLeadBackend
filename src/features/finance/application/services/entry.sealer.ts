import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { DataIntegrityError } from '../../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import { toLeadId } from '../../../../domain/shared/lead-id';
import {
  carriesLead,
  ENTRY_PURPOSES,
  type EntryPurposeValue,
} from '../../domain/entry-purpose.value-object';
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
  /** The buyer of a `sale` or `refund` entry; absent on older entries. */
  readonly leadId?: string | null;
  /**
   * The car `leadId` was validated against. Read only while it equals the
   * entry's car: an older build can move the entry and carry both keys along,
   * which would leave `leadId` pointing at a lead of the wrong car.
   */
  readonly leadCarId?: string | null;
}

/**
 * Seals a ledger entry's private fields (amount, purpose, tags, party, note)
 * into one payload bound to `finance_entries:<id>`, and opens it again.
 *
 * Opening is tolerant of newer builds' data (so a rollback is safe):
 * - an unknown `purpose` is read as `cost` (car-linked expense), `other`
 *   (car-linked income) or `general` (no car), never `sale`/`purchase`, so it
 *   can't settle a buyer or seller balance. Such an entry is read-only on this
 *   build: sealing it again throws ENTRY_FROM_NEWER_VERSION, so the real
 *   purpose is never overwritten. It is logged as a warning.
 * - unknown extra keys are ignored on read and written back
 *   unchanged on the next save.
 * A corrupt payload still throws DataIntegrityError.
 */
export class EntrySealer {
  private readonly fromNewerVersion = new WeakSet<FinanceEntry>();
  private readonly unknownKeys = new WeakMap<FinanceEntry, Readonly<Record<string, unknown>>>();

  constructor(private readonly logger?: Logger) {}

  /** Throws ENTRY_FROM_NEWER_VERSION for an entry opened with the fallback purpose. */
  assertWritable(entry: FinanceEntry): void {
    if (this.fromNewerVersion.has(entry)) {
      throw new BusinessRuleViolationError(
        'ENTRY_FROM_NEWER_VERSION',
        'This entry was saved by a newer version of the app; update before changing it',
      );
    }
  }

  seal(entry: FinanceEntry, cipher: FinanceCipher): SealedFinanceEntry {
    this.assertWritable(entry);
    const payload: EntryPayload = {
      ...this.unknownKeys.get(entry),
      amount: entry.amount.paise,
      purpose: entry.purpose,
      tagIds: entry.tagIds,
      party: entry.party,
      note: entry.note,
      ...(entry.leadId === null || entry.vehicleId === null
        ? {}
        : { leadId: entry.leadId, leadCarId: entry.vehicleId }),
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
    const { payload, extra, downgraded } = parsePayload(
      cipher.open(record.payload, aad(record.id)),
      record,
      this.logger,
    );
    const entry = FinanceEntry.reconstitute({
      id: record.id,
      kind: record.kind,
      amount: Money.ofPaise(payload.amount),
      entryDate: CalendarDate.create(record.entryDate),
      purpose: payload.purpose,
      tagIds: payload.tagIds.map(toFinanceTagId),
      vehicleId: record.vehicleId,
      leadId:
        carriesLead(payload.purpose) &&
        typeof payload.leadId === 'string' &&
        payload.leadCarId === record.vehicleId
          ? toLeadId(payload.leadId)
          : null,
      showroomId: record.showroomId,
      party: payload.party,
      note: payload.note,
      recordedBy: record.recordedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
    if (Object.keys(extra).length > 0) {
      this.unknownKeys.set(entry, extra);
    }
    if (downgraded) {
      this.fromNewerVersion.add(entry);
    }
    return entry;
  }
}

function aad(id: string): string {
  return `finance_entries:${id}`;
}

const KNOWN_KEYS: ReadonlySet<string> = new Set([
  'amount',
  'purpose',
  'tagIds',
  'party',
  'note',
  'leadId',
  'leadCarId',
]);

interface ParsedPayload {
  readonly payload: EntryPayload;
  /** Keys this build doesn't know, kept so a save writes them back. */
  readonly extra: Readonly<Record<string, unknown>>;
  readonly downgraded: boolean;
}

function parsePayload(
  json: string,
  record: Pick<SealedFinanceEntry, 'id' | 'kind' | 'vehicleId'>,
  logger: Logger | undefined,
): ParsedPayload {
  const id = record.id;
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
    (p.note === null || typeof p.note === 'string') &&
    (p.leadId === undefined || p.leadId === null || typeof p.leadId === 'string') &&
    (p.leadCarId === undefined || p.leadCarId === null || typeof p.leadCarId === 'string');
  if (!valid) {
    throw new DataIntegrityError(`Finance entry ${id} has an invalid payload`);
  }
  const payload = value as EntryPayload;
  const extra = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => !KNOWN_KEYS.has(key)),
  );
  if ((ENTRY_PURPOSES as readonly string[]).includes(payload.purpose)) {
    return { payload, extra, downgraded: false };
  }
  // Written by a newer build (e.g. `refund`). Never log the raw purpose or any sealed field.
  const fallback = fallbackPurpose(record.kind, record.vehicleId);
  logger?.warn(
    { event: 'finance.entry.unknown_purpose', entryId: id, kind: record.kind, fallback },
    'Finance entry has an unknown purpose; reading it as a fallback and keeping it read-only',
  );
  return { payload: { ...payload, purpose: fallback }, extra, downgraded: true };
}

function fallbackPurpose(kind: EntryKindValue, vehicleId: string | null): EntryPurposeValue {
  if (vehicleId === null) {
    return 'general';
  }
  return kind === 'expense' ? 'cost' : 'other';
}
