import type { DealTermsInput } from '../services/deal-terms-input';
import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';

/** Omitted fields stay as they are. */
export interface UpdateFinanceEntryCommand {
  readonly sessionToken: string | null;
  readonly entryId: string;
  readonly amountPaise?: number;
  readonly entryDate?: string;
  readonly tagIds?: readonly string[];
  /** A car id links or moves the entry; null unlinks it. */
  readonly vehicleId?: string | null;
  readonly purpose?: EntryPurposeValue;
  /** Puts a `sale` / `refund` entry on a lead; null takes it off (BE-77 §4.2). */
  readonly leadId?: string | null;
  /** With a move to another car: keep the entry's lead and purpose (§4.3). */
  readonly keepLead?: boolean;
  readonly party?: string | null;
  readonly note?: string | null;
  readonly showroomId?: string;
  /**
   * Terms for a car with no deal yet, saved with a payment to the seller.
   * Ignored when the car already has terms.
   */
  readonly deal?: DealTermsInput | null;
  /** Save even if the seller ends up paid above what they're owed. */
  readonly keepOverpayment?: boolean;
}
