import type { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { Contact } from './contact.entity';
import type { FollowUp } from './follow-up.entity';
import type { Lead } from './lead.entity';
import type { LeadId } from './lead-id';

/**
 * Command-side persistence for leads, contacts, and follow-ups.
 * Listing lives on ILeadQueries.
 */
export interface ILeadRepository {
  findById(id: LeadId): Promise<Lead | null>;
  findLiveContactByPhone(phone: Phone): Promise<Contact | null>;
  save(lead: Lead, write: LeadWrite): Promise<void>;
  scheduleFollowUp(followUp: FollowUp): Promise<void>;
}

export interface LeadWrite {
  /** Recorded on status history and audit rows. */
  readonly actorId: UserId;
  /** Upserted in the same transaction when the lead introduces or refreshes a contact. */
  readonly contact?: Contact;
  readonly statusNotes?: string | null;
}
