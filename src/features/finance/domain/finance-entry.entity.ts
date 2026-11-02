import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { EntryKindValue } from './entry-kind.value-object';
import { EntryPurpose, type EntryPurposeValue } from './entry-purpose.value-object';
import type { FinanceEntryId } from './finance-entry-id';
import type { FinanceTagId } from './finance-tag-id';
import type { Money } from './money.value-object';

export const MAX_TAGS_PER_ENTRY = 10;
export const MAX_PARTY_LENGTH = 120;
export const MAX_NOTE_LENGTH = 1000;

export interface FinanceEntryProps {
  readonly id: FinanceEntryId;
  readonly kind: EntryKindValue;
  readonly amount: Money;
  readonly entryDate: CalendarDate;
  readonly purpose: EntryPurposeValue;
  readonly tagIds: readonly FinanceTagId[];
  readonly vehicleId: VehicleId | null;
  readonly showroomId: ShowroomId;
  readonly party: string | null;
  readonly note: string | null;
  readonly recordedBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * One money movement in the ledger (ADR-0015): income or expense, optionally
 * linked to a car. A car-linked entry belongs to the car's showroom and its
 * purpose follows the car link; see EntryPurpose.
 */
export class FinanceEntry {
  private constructor(private props: FinanceEntryProps) {}

  static create(input: {
    id: FinanceEntryId;
    kind: EntryKindValue;
    amount: Money;
    entryDate: CalendarDate;
    purpose: EntryPurposeValue | null;
    tagIds: readonly FinanceTagId[];
    vehicleId: VehicleId | null;
    showroomId: ShowroomId;
    party: string | null;
    note: string | null;
    recordedBy: UserId;
    now: Date;
  }): FinanceEntry {
    const linked = input.vehicleId !== null;
    return new FinanceEntry({
      id: input.id,
      kind: input.kind,
      amount: requirePositive(input.amount),
      entryDate: input.entryDate,
      purpose: resolvePurpose(input.kind, linked, input.purpose),
      tagIds: normalizeTags(input.tagIds),
      vehicleId: input.vehicleId,
      showroomId: input.showroomId,
      party: normalizeText(input.party, MAX_PARTY_LENGTH, 'party'),
      note: normalizeText(input.note, MAX_NOTE_LENGTH, 'note'),
      recordedBy: input.recordedBy,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
    });
  }

  static reconstitute(props: FinanceEntryProps): FinanceEntry {
    return new FinanceEntry(props);
  }

  get id(): FinanceEntryId {
    return this.props.id;
  }
  get kind(): EntryKindValue {
    return this.props.kind;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get entryDate(): CalendarDate {
    return this.props.entryDate;
  }
  get purpose(): EntryPurposeValue {
    return this.props.purpose;
  }
  get tagIds(): readonly FinanceTagId[] {
    return this.props.tagIds;
  }
  get vehicleId(): VehicleId | null {
    return this.props.vehicleId;
  }
  get showroomId(): ShowroomId {
    return this.props.showroomId;
  }
  get party(): string | null {
    return this.props.party;
  }
  get note(): string | null {
    return this.props.note;
  }
  get recordedBy(): UserId {
    return this.props.recordedBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  changeAmount(amount: Money, now: Date): void {
    this.update({ amount: requirePositive(amount) }, now);
  }

  changeDate(entryDate: CalendarDate, now: Date): void {
    this.update({ entryDate }, now);
  }

  retag(tagIds: readonly FinanceTagId[], now: Date): void {
    this.update({ tagIds: normalizeTags(tagIds) }, now);
  }

  changeParty(party: string | null, now: Date): void {
    this.update({ party: normalizeText(party, MAX_PARTY_LENGTH, 'party') }, now);
  }

  changeNote(note: string | null, now: Date): void {
    this.update({ note: normalizeText(note, MAX_NOTE_LENGTH, 'note') }, now);
  }

  /**
   * Links to a car (or moves to another), taking its showroom. The purpose
   * resets to the default for a car-linked entry unless one is given.
   */
  linkToVehicle(
    vehicleId: VehicleId,
    showroomId: ShowroomId,
    purpose: EntryPurposeValue | null,
    now: Date,
  ): void {
    const changedCar = vehicleId !== this.props.vehicleId;
    const next =
      purpose ??
      (changedCar ? EntryPurpose.defaultFor(this.props.kind, true).value : this.props.purpose);
    this.update(
      { vehicleId, showroomId, purpose: resolvePurpose(this.props.kind, true, next) },
      now,
    );
  }

  /** Removes the car link; the entry becomes a business entry in `showroomId`. */
  unlink(showroomId: ShowroomId, now: Date): void {
    this.update({ vehicleId: null, showroomId, purpose: 'general' }, now);
  }

  changePurpose(purpose: EntryPurposeValue, now: Date): void {
    this.update(
      { purpose: resolvePurpose(this.props.kind, this.props.vehicleId !== null, purpose) },
      now,
    );
  }

  /** Only a business entry chooses its showroom; a car-linked one follows the car. */
  moveToShowroom(showroomId: ShowroomId, now: Date): void {
    if (showroomId === this.props.showroomId) {
      return;
    }
    if (this.props.vehicleId !== null) {
      throw new BusinessRuleViolationError(
        'ENTRY_SHOWROOM_FOLLOWS_VEHICLE',
        "A car-linked entry belongs to the car's showroom",
      );
    }
    this.update({ showroomId }, now);
  }

  softDelete(now: Date): void {
    if (this.props.deletedAt === null) {
      this.update({ deletedAt: now }, now);
    }
  }

  private update(patch: Partial<FinanceEntryProps>, now: Date): void {
    this.props = { ...this.props, ...patch, updatedAt: now };
  }
}

function resolvePurpose(
  kind: EntryKindValue,
  linked: boolean,
  purpose: EntryPurposeValue | null,
): EntryPurposeValue {
  return purpose === null
    ? EntryPurpose.defaultFor(kind, linked).value
    : EntryPurpose.of(kind, linked, purpose).value;
}

function requirePositive(amount: Money): Money {
  if (amount.paise <= 0) {
    throw new BusinessRuleViolationError('INVALID_AMOUNT', 'Amount must be greater than zero');
  }
  return amount;
}

function normalizeTags(tagIds: readonly FinanceTagId[]): readonly FinanceTagId[] {
  const unique = [...new Set(tagIds)];
  if (unique.length > MAX_TAGS_PER_ENTRY) {
    throw new BusinessRuleViolationError(
      'TOO_MANY_TAGS',
      `An entry can have at most ${MAX_TAGS_PER_ENTRY} tags`,
    );
  }
  return unique;
}

function normalizeText(value: string | null, max: number, field: string): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > max) {
    throw new BusinessRuleViolationError(
      'TEXT_TOO_LONG',
      `${field} can be at most ${max} characters`,
    );
  }
  return trimmed;
}
