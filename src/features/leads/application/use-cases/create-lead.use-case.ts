import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { CreateLeadCommand } from '../dtos/create-lead-command';
import type { LeadDto } from '../dtos/lead.dto';
import { toLeadDto } from '../dtos/lead.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { Contact } from '../../domain/contact.entity';
import { toContactId } from '../../domain/contact-id';
import { Budget } from '../../domain/budget.value-object';
import { Lead } from '../../domain/lead.entity';
import { toLeadId } from '../../domain/lead-id';
import { LeadSource } from '../../domain/lead-source.value-object';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { ILiveVehicleLookup } from '../../domain/live-vehicle.port';

export class CreateLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicles: ILiveVehicleLookup,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateLeadCommand, ctx: AuthenticatedContext): Promise<LeadDto> {
    this.policy.requireAdmin(ctx);

    const vehicleId = command.vehicleId === null ? null : toVehicleId(command.vehicleId);
    if (vehicleId !== null && !(await this.vehicles.isLive(vehicleId))) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    const now = this.clock.now();
    const phone = Phone.create(command.phone);
    const email = command.email === null ? null : Email.create(command.email);

    let contact = await this.repo.findLiveContactByPhone(phone);
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

    const lead = Lead.create({
      id: toLeadId(this.ids.generate()),
      showroomId: toShowroomId(command.showroomId),
      contactId: contact.id,
      vehicleId,
      source: LeadSource.create(command.source),
      budget: command.budget === null ? null : Budget.create(command.budget).value,
      preferredVehicle: command.preferredVehicle,
      purchaseTimeline: command.purchaseTimeline,
      financeRequired: command.financeRequired,
      currentVehicle: command.currentVehicle,
      tradeInRequired: command.tradeInRequired,
      notes: command.notes,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.save(lead, contact, null);
    return toLeadDto(lead, contact);
  }
}
