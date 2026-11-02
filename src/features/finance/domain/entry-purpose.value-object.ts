import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { EntryKindValue } from './entry-kind.value-object';

export const ENTRY_PURPOSES = ['purchase', 'cost', 'sale', 'other', 'general'] as const;

export type EntryPurposeValue = (typeof ENTRY_PURPOSES)[number];

const ALLOWED: Readonly<Record<EntryKindValue, readonly EntryPurposeValue[]>> = {
  expense: ['purchase', 'cost'],
  income: ['sale', 'other'],
};

/**
 * What a car-linked entry does to the car's numbers (ADR-0015):
 * - expense `purchase` settles the purchase rate; `cost` adds to landing cost
 * - income `sale` settles the finalised price; `other` is anything else
 * - an entry with no car is always `general`
 */
export class EntryPurpose {
  private constructor(readonly value: EntryPurposeValue) {}

  static parse(input: string): EntryPurposeValue {
    if (!(ENTRY_PURPOSES as readonly string[]).includes(input)) {
      throw new Error(`purpose must be one of: ${ENTRY_PURPOSES.join(', ')}`);
    }
    return input as EntryPurposeValue;
  }

  static defaultFor(kind: EntryKindValue, linkedToVehicle: boolean): EntryPurpose {
    if (!linkedToVehicle) {
      return new EntryPurpose('general');
    }
    return new EntryPurpose(kind === 'expense' ? 'cost' : 'sale');
  }

  /** Throws INVALID_ENTRY_PURPOSE when the purpose doesn't fit the kind and link. */
  static of(
    kind: EntryKindValue,
    linkedToVehicle: boolean,
    value: EntryPurposeValue,
  ): EntryPurpose {
    const allowed: readonly EntryPurposeValue[] = linkedToVehicle ? ALLOWED[kind] : ['general'];
    if (!allowed.includes(value)) {
      throw new BusinessRuleViolationError(
        'INVALID_ENTRY_PURPOSE',
        linkedToVehicle
          ? `A car-linked ${kind} can only have purpose ${allowed.join(' or ')}`
          : 'An entry with no car always has purpose general',
      );
    }
    return new EntryPurpose(value);
  }
}
