import type { DealTermsInput } from '../services/deal-terms-input';
import type { EntryKindValue } from '../../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';

export interface CreateFinanceEntryCommand {
  readonly sessionToken: string | null;
  readonly kind: EntryKindValue;
  /** Paise. */
  readonly amountPaise: number;
  /** YYYY-MM-DD */
  readonly entryDate: string;
  readonly tagIds: readonly string[];
  readonly vehicleId: string | null;
  readonly purpose: EntryPurposeValue | null;
  /** The buyer a `sale` / `refund` entry belongs to (BE-77 §4.2); ignored on other purposes. */
  readonly leadId?: string | null;
  readonly party: string | null;
  readonly note: string | null;
  readonly showroomId: string | null;
  /**
   * Terms for a car with no deal yet, saved with a payment to the seller.
   * Ignored when the car already has terms.
   */
  readonly deal?: DealTermsInput | null;
  /** Save even if the seller ends up paid above what they're owed. */
  readonly keepOverpayment?: boolean;
}
