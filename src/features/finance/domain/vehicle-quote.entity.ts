import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Money } from './money.value-object';
import type { VehicleQuoteId } from './vehicle-quote-id';

export const MAX_QUOTED_TO_LENGTH = 120;
export const MAX_QUOTE_NOTE_LENGTH = 1000;

export interface VehicleQuoteProps {
  readonly id: VehicleQuoteId;
  readonly vehicleId: VehicleId;
  readonly leadId: LeadId | null;
  readonly quotedOn: CalendarDate;
  readonly amount: Money;
  readonly quotedTo: string | null;
  readonly note: string | null;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

/** A price offered to a person for a car; prices change during negotiation. */
export class VehicleQuote {
  private constructor(private props: VehicleQuoteProps) {}

  static create(input: Omit<VehicleQuoteProps, 'deletedAt'>): VehicleQuote {
    if (input.amount.paise <= 0) {
      throw new BusinessRuleViolationError(
        'INVALID_AMOUNT',
        'Quote amount must be greater than zero',
      );
    }
    return new VehicleQuote({
      ...input,
      quotedTo: limitText(input.quotedTo, MAX_QUOTED_TO_LENGTH, 'quotedTo'),
      note: limitText(input.note, MAX_QUOTE_NOTE_LENGTH, 'note'),
      deletedAt: null,
    });
  }

  static reconstitute(props: VehicleQuoteProps): VehicleQuote {
    return new VehicleQuote(props);
  }

  get id(): VehicleQuoteId {
    return this.props.id;
  }
  get vehicleId(): VehicleId {
    return this.props.vehicleId;
  }
  get leadId(): LeadId | null {
    return this.props.leadId;
  }
  get quotedOn(): CalendarDate {
    return this.props.quotedOn;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get quotedTo(): string | null {
    return this.props.quotedTo;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): UserId {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  softDelete(now: Date): void {
    if (this.props.deletedAt === null) {
      this.props = { ...this.props, deletedAt: now };
    }
  }
}

/** Newest first: latest quote date, then latest recorded. */
export function compareQuotesNewestFirst(a: VehicleQuote, b: VehicleQuote): number {
  return (
    b.quotedOn.value.localeCompare(a.quotedOn.value) ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

function limitText(value: string | null, max: number, field: string): string | null {
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
