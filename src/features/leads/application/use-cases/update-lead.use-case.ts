import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { Phone } from '../../../../domain/shared/phone.value-object';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { type LeadDto, toLeadDto } from '../dtos/lead.dto';
import type { UpdateLeadCommand } from '../dtos/update-lead-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { Budget } from '../../domain/budget.value-object';
import { Contact } from '../../domain/contact.entity';
import { type ContactId, toContactId } from '../../domain/contact-id';
import { LeadSource } from '../../domain/lead-source.value-object';
import type { ILeadRepository } from '../../domain/lead.repository';

/**
 * Corrects an open lead's CRM fields. Contacts are keyed by phone, so a new
 * phone moves the lead to that phone's contact (creating it when needed)
 * rather than rewriting a contact other leads may share. Like create, the
 * response carries no embeds (linkedVehicle, names); GET /leads/:id has them.
 */
export class UpdateLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: UpdateLeadCommand, ctx: AuthenticatedContext): Promise<LeadDto> {
    this.policy.requireStaff(ctx);

    const leadId = toLeadId(command.leadId);
    const lead = await this.repo.findById(leadId);
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const now = this.clock.now();
    const phone = Phone.create(command.phone);
    const email = command.email === null ? null : Email.create(command.email);
    let contact = await this.resolveContact(lead.contactId, phone);
    if (contact === null) {
      contact = Contact.create({
        id: toContactId(this.ids.generate()),
        fullName: command.fullName,
        phone,
        email,
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      contact.refreshProfile(command.fullName, email, now);
    }

    lead.updateDetails(
      {
        contactId: contact.id,
        source: LeadSource.create(command.source),
        budget: command.budget === null ? null : Budget.create(command.budget).value,
        purchaseTimeline: command.purchaseTimeline,
        financeRequired: command.financeRequired,
        currentVehicle: command.currentVehicle,
        tradeInRequired: command.tradeInRequired,
        notes: command.notes,
      },
      now,
    );
    await this.repo.save(lead, { actorId: ctx.userId, contact });
    return toLeadDto(lead, contact);
  }

  /** The live contact for this phone: the lead's own, another existing one, or null for a new one. */
  private async resolveContact(currentId: ContactId, phone: Phone): Promise<Contact | null> {
    const current = await this.repo.findContactById(currentId);
    if (current !== null && current.phone.value === phone.value) {
      return current;
    }
    return this.repo.findLiveContactByPhone(phone);
  }
}
