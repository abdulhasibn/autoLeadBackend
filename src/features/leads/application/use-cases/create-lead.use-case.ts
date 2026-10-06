import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { resolveShowroomId } from '../../../../domain/shared/resolve-showroom';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { CreateLeadCommand } from '../dtos/create-lead-command';
import type { LeadDto } from '../dtos/lead.dto';
import { toLeadDto } from '../dtos/lead.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { requireLinkableVehicle } from '../services/require-linkable-vehicle';
import { resolvePreferredCatalog } from '../services/resolve-preferred-catalog';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';
import { Contact } from '../../domain/contact.entity';
import { toContactId } from '../../domain/contact-id';
import { Budget } from '../../domain/budget.value-object';
import { Lead } from '../../domain/lead.entity';
import { LeadSource } from '../../domain/lead-source.value-object';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { ILinkableVehicleLookup } from '../../domain/linkable-vehicle.port';
import type { ICatalogLineageLookup } from '../../domain/catalog-lineage.port';

export class CreateLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicles: ILinkableVehicleLookup,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly catalog: ICatalogLineageLookup,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateLeadCommand, ctx: AuthenticatedContext): Promise<LeadDto> {
    this.policy.requireStaff(ctx);
    const showroomId = resolveShowroomId(ctx, command.showroomId);

    const vehicleId = command.vehicleId === null ? null : toVehicleId(command.vehicleId);
    if (vehicleId !== null) {
      await requireLinkableVehicle(this.vehicles, vehicleId);
    }
    const preferredCatalog = await resolvePreferredCatalog(this.catalog, {
      makeId: command.preferredMakeId,
      modelId: command.preferredModelId,
      variantId: command.preferredVariantId,
    });

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
      showroomId,
      contactId: contact.id,
      vehicleId,
      assignedTo: this.policy.initialAssignee(ctx),
      source: LeadSource.create(command.source),
      budget: command.budget === null ? null : Budget.create(command.budget).value,
      preferredVehicle: command.preferredVehicle,
      preferredCatalog,
      purchaseTimeline: command.purchaseTimeline,
      financeRequired: command.financeRequired,
      currentVehicle: command.currentVehicle,
      tradeInRequired: command.tradeInRequired,
      notes: command.notes,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.save(lead, { actorId: ctx.userId, contact });
    if (vehicleId !== null) {
      await this.vehicleLinks.refresh(vehicleId, ctx.userId);
    }
    return toLeadDto(lead, contact);
  }
}
