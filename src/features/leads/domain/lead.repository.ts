import type { Phone } from '../../../domain/shared/phone.value-object';
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
  save(lead: Lead, contact: Contact | null, statusNotes: string | null): Promise<void>;
  scheduleFollowUp(followUp: FollowUp): Promise<void>;
}
