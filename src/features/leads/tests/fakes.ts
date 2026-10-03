import type { Phone } from '../../../domain/shared/phone.value-object';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { Contact } from '../domain/contact.entity';
import type { FollowUp } from '../domain/follow-up.entity';
import type { Lead } from '../domain/lead.entity';
import type { LeadId } from '../domain/lead-id';
import type { ILeadQueries, LeadListCriteria, LeadReadModel } from '../domain/lead.queries';
import type { ILeadRepository } from '../domain/lead.repository';
import type { ILiveVehicleLookup } from '../domain/live-vehicle.port';

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

  seedLead(lead: Lead): void {
    this.leads.set(lead.id, lead);
  }

  seedContact(contact: Contact): void {
    this.contacts.set(contact.phone.value, contact);
  }

  async findById(id: LeadId): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async findLiveContactByPhone(phone: Phone): Promise<Contact | null> {
    return this.contacts.get(phone.value) ?? null;
  }

  async save(lead: Lead, contact: Contact | null, _statusNotes: string | null): Promise<void> {
    this.leads.set(lead.id, lead);
    if (contact !== null) {
      this.contacts.set(contact.phone.value, contact);
    }
  }

  async scheduleFollowUp(followUp: FollowUp): Promise<void> {
    this.followUps.push(followUp);
  }
}

export class FakeLiveVehicleLookup implements ILiveVehicleLookup {
  live = new Set<string>();

  seed(vehicleId: VehicleId): void {
    this.live.add(vehicleId);
  }

  async isLive(vehicleId: VehicleId): Promise<boolean> {
    return this.live.has(vehicleId);
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
      return true;
    });
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async getLead(id: LeadId): Promise<LeadReadModel | null> {
    return this.leads.find((lead) => lead.id === id) ?? null;
  }
}
