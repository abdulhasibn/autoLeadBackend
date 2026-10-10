import type { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { Contact } from '../domain/contact.entity';
import type { ContactId } from '../domain/contact-id';
import type { FollowUp } from '../domain/follow-up.entity';
import type { Lead } from '../domain/lead.entity';
import { ACTIVE_LEAD_STATUSES } from '../domain/lead-status.value-object';
import type { ILeadQueries, LeadListCriteria, LeadReadModel } from '../domain/lead.queries';
import type { IAssignableStaffLookup } from '../domain/assignable-staff.port';
import type { ICatalogLineageLookup } from '../domain/catalog-lineage.port';
import type { ILeadRepository, LeadWrite } from '../domain/lead.repository';
import type { ILinkableVehicleLookup, VehicleLinkability } from '../domain/linkable-vehicle.port';
import type { IVehicleLinkSync } from '../domain/vehicle-link-sync.port';
import type { IVehicleSale } from '../domain/vehicle-sale.port';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class FakeIdGenerator implements IdGenerator {
  ids = [
    '66666666-6666-4666-8666-666666666666',
    '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888',
    '99999999-9999-4999-8999-999999999999',
  ];
  private index = 0;

  generate(): string {
    const id = this.ids[this.index] ?? this.ids[this.ids.length - 1];
    this.index += 1;
    return id as string;
  }
}

export class FakeLeadRepository implements ILeadRepository {
  readonly leads = new Map<string, Lead>();
  readonly contacts = new Map<string, Contact>();
  readonly followUps: FollowUp[] = [];
  readonly writes: LeadWrite[] = [];
  failNextSave = false;

  seedLead(lead: Lead): void {
    this.leads.set(lead.id, lead);
  }

  seedContact(contact: Contact): void {
    this.contacts.set(contact.phone.value, contact);
  }

  async findById(id: LeadId): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async findActiveByVehicle(vehicleId: VehicleId): Promise<Lead[]> {
    return [...this.leads.values()].filter(
      (lead) => lead.vehicleId === vehicleId && lead.status.isActive() && lead.deletedAt === null,
    );
  }

  async findContactById(id: ContactId): Promise<Contact | null> {
    return [...this.contacts.values()].find((contact) => contact.id === id) ?? null;
  }

  async findLiveContactByPhone(phone: Phone): Promise<Contact | null> {
    return this.contacts.get(phone.value) ?? null;
  }

  async save(lead: Lead, write: LeadWrite): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('save failed');
    }
    this.writes.push(write);
    this.leads.set(lead.id, lead);
    if (write.contact !== undefined) {
      this.contacts.set(write.contact.phone.value, write.contact);
    }
  }

  async scheduleFollowUp(followUp: FollowUp): Promise<void> {
    this.followUps.push(followUp);
  }
}

export class FakeLeadQueries implements ILeadQueries {
  readonly leads: LeadReadModel[] = [];

  seed(lead: LeadReadModel): void {
    this.leads.push(lead);
  }

  async listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>> {
    const filtered = this.leads.filter((lead) => {
      if (criteria.status !== undefined && lead.status !== criteria.status) {
        return false;
      }
      if (criteria.vehicleId !== undefined && lead.vehicleId !== criteria.vehicleId) {
        return false;
      }
      if (criteria.assignedTo !== undefined && lead.assignedTo !== criteria.assignedTo) {
        return false;
      }
      if (
        criteria.preferredMakeId !== undefined &&
        lead.preferredMakeId !== criteria.preferredMakeId
      ) {
        return false;
      }
      if (
        criteria.preferredModelId !== undefined &&
        lead.preferredModelId !== criteria.preferredModelId
      ) {
        return false;
      }
      if (
        criteria.preferredVariantId !== undefined &&
        lead.preferredVariantId !== criteria.preferredVariantId
      ) {
        return false;
      }
      return true;
    });
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async getLead(id: LeadId): Promise<LeadReadModel | null> {
    return this.leads.find((lead) => lead.id === id) ?? null;
  }

  async countActiveByVehicles(
    vehicleIds: readonly VehicleId[],
  ): Promise<ReadonlyMap<VehicleId, number>> {
    const counts = new Map<VehicleId, number>();
    for (const lead of this.leads) {
      const vehicleId = lead.vehicleId as VehicleId | null;
      if (
        vehicleId !== null &&
        vehicleIds.includes(vehicleId) &&
        (ACTIVE_LEAD_STATUSES as readonly string[]).includes(lead.status)
      ) {
        counts.set(vehicleId, (counts.get(vehicleId) ?? 0) + 1);
      }
    }
    return counts;
  }
}

export class FakeAssignableStaffLookup implements IAssignableStaffLookup {
  readonly assignable = new Set<string>();

  async isAssignable(userId: UserId): Promise<boolean> {
    return this.assignable.has(userId);
  }
}

type FakeVehicleStatus = 'open' | 'linked' | 'dropped' | 'sold';

/** Stands in for the vehicles feature behind all three lead-side vehicle ports. */
export class FakeVehicles implements ILinkableVehicleLookup, IVehicleLinkSync, IVehicleSale {
  readonly statuses = new Map<string, FakeVehicleStatus>();
  readonly soldTo = new Map<string, LeadId>();
  saleError: Error | null = null;

  seed(vehicleId: VehicleId, status: FakeVehicleStatus = 'open'): void {
    this.statuses.set(vehicleId, status);
  }

  statusOf(vehicleId: VehicleId): FakeVehicleStatus | undefined {
    return this.statuses.get(vehicleId);
  }

  async linkability(vehicleId: VehicleId): Promise<VehicleLinkability> {
    const status = this.statuses.get(vehicleId);
    if (status === undefined) {
      return 'not_found';
    }
    return status === 'open' || status === 'linked' ? 'linkable' : 'unavailable';
  }

  async syncLinkState(vehicleId: VehicleId, hasActiveLeads: boolean): Promise<void> {
    const status = this.statuses.get(vehicleId);
    if (status === 'open' && hasActiveLeads) {
      this.statuses.set(vehicleId, 'linked');
    } else if (status === 'linked' && !hasActiveLeads) {
      this.statuses.set(vehicleId, 'open');
    }
  }

  async markSold(vehicleId: VehicleId, leadId: LeadId): Promise<void> {
    if (this.saleError !== null) {
      throw this.saleError;
    }
    if (this.soldTo.get(vehicleId) === leadId) {
      return;
    }
    this.statuses.set(vehicleId, 'sold');
    this.soldTo.set(vehicleId, leadId);
  }
}

/** A tiny live catalog: make → model → variant, keyed by id. */
export class FakeCatalogLineage implements ICatalogLineageLookup {
  readonly makes = new Set<string>();
  readonly models = new Map<string, string>();
  readonly variants = new Map<string, string>();

  seed(makeId: string, modelId?: string, variantId?: string): void {
    this.makes.add(makeId);
    if (modelId !== undefined) {
      this.models.set(modelId, makeId);
    }
    if (modelId !== undefined && variantId !== undefined) {
      this.variants.set(variantId, modelId);
    }
  }

  async variantLineage(
    variantId: string,
  ): Promise<{ readonly makeId: string; readonly modelId: string } | null> {
    const modelId = this.variants.get(variantId);
    const makeId = modelId === undefined ? undefined : this.models.get(modelId);
    return modelId === undefined || makeId === undefined ? null : { makeId, modelId };
  }

  async modelLineage(modelId: string): Promise<{ readonly makeId: string } | null> {
    const makeId = this.models.get(modelId);
    return makeId === undefined ? null : { makeId };
  }

  async isLiveMake(makeId: string): Promise<boolean> {
    return this.makes.has(makeId);
  }
}

/** A minimal live lead read model; override what the test cares about. */
export function leadReadModel(overrides: Partial<LeadReadModel> = {}): LeadReadModel {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    showroomId: 'b0000000-0000-4000-8000-000000000001',
    vehicleId: null,
    linkedVehicle: null,
    assignedTo: null,
    assignedToName: null,
    contactId: '66666666-6666-4666-8666-666666666666',
    contactFullName: 'Rahul Sharma',
    contactPhone: '+919811122233',
    contactEmail: null,
    source: 'phone',
    status: 'new',
    budget: null,
    preferredVehicle: null,
    preferredMakeId: null,
    preferredMakeName: null,
    preferredModelId: null,
    preferredModelName: null,
    preferredVariantId: null,
    preferredVariantName: null,
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: null,
    nextFollowUp: null,
    createdBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}
