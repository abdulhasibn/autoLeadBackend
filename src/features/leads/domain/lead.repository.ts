import type { LeadId } from '../../../domain/shared/lead-id';
import type { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Contact } from './contact.entity';
import type { ContactId } from './contact-id';
import type { FollowUp, ScheduledFollowUp } from './follow-up.entity';
import type { FollowUpId } from './follow-up-id';
import type { Lead } from './lead.entity';

/**
 * Command-side persistence for leads, contacts, and follow-ups.
 * Listing lives on ILeadQueries.
 */
export interface ILeadRepository {
  findById(id: LeadId): Promise<Lead | null>;
  /** Live leads whose status keeps the vehicle `linked`. */
  findActiveByVehicle(vehicleId: VehicleId): Promise<Lead[]>;
  findContactById(id: ContactId): Promise<Contact | null>;
  findLiveContactByPhone(phone: Phone): Promise<Contact | null>;
  save(lead: Lead, write: LeadWrite): Promise<void>;
  scheduleFollowUp(followUp: ScheduledFollowUp): Promise<void>;
  /** A follow-up by id, open or closed; its due reminder may be absent. */
  findFollowUpById(id: FollowUpId): Promise<FollowUp | null>;
  /**
   * Closes the follow-up, marks its reminder read and schedules `next` (with
   * its reminder) in one transaction. Throws ConflictError if it was no
   * longer open.
   */
  completeFollowUp(followUp: FollowUp, next: ScheduledFollowUp | null): Promise<void>;
  /** Soft-deletes the follow-up and marks its reminder read. */
  cancelFollowUp(followUp: FollowUp): Promise<void>;
}

export interface LeadWrite {
  /** Recorded on status history and audit rows. */
  readonly actorId: UserId;
  /** Upserted in the same transaction when the lead introduces or refreshes a contact. */
  readonly contact?: Contact;
  readonly statusNotes?: string | null;
}
