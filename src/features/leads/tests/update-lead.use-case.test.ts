import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import type { UpdateLeadCommand } from '../application/dtos/update-lead-command';
import { UpdateLeadUseCase } from '../application/use-cases/update-lead.use-case';
import { Contact } from '../domain/contact.entity';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeClock, FakeIdGenerator, FakeLeadRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const CONTACT_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_CONTACT_ID = '55555555-5555-4555-8555-555555555555';
const NOW = new Date('2026-10-08T00:00:00.000Z');

function contact(id: string, phone: string, fullName: string): Contact {
  return Contact.create({
    id: toContactId(id),
    fullName,
    phone: Phone.create(phone),
    email: null,
    createdBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function newLead(): Lead {
  return Lead.create({
    id: toLeadId(LEAD_ID),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId(CONTACT_ID),
    vehicleId: null,
    assignedTo: null,
    source: LeadSource.create('walkin'),
    budget: null,
    preferredVehicle: null,
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function command(overrides: Partial<UpdateLeadCommand> = {}): UpdateLeadCommand {
  return {
    leadId: LEAD_ID,
    fullName: 'Rahul S.',
    phone: '+919811122233',
    email: 'rahul@example.com',
    source: 'referral',
    budget: 650000,
    purchaseTimeline: 'this month',
    financeRequired: true,
    currentVehicle: null,
    tradeInRequired: false,
    notes: 'Prefers white',
    ...overrides,
  };
}

describe('UpdateLeadUseCase', () => {
  let useCase: UpdateLeadUseCase;
  let repo: FakeLeadRepository;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    repo.seedLead(newLead());
    repo.seedContact(contact(CONTACT_ID, '+919811122233', 'Rahul Sharma'));
    ids = new FakeIdGenerator();
    useCase = new UpdateLeadUseCase(new LeadManagementPolicy(), repo, new FakeClock(NOW), ids);
  });

  it('replaces the CRM fields and refreshes the same contact', async () => {
    const result = await useCase.execute(command(), ADMIN);

    const lead = repo.leads.get(LEAD_ID);
    expect(lead?.source.value).toBe('referral');
    expect(lead?.budget).toBe(650000);
    expect(lead?.notes).toBe('Prefers white');
    expect(lead?.contactId).toBe(CONTACT_ID);
    expect(repo.writes.at(-1)?.contact?.fullName).toBe('Rahul S.');
    expect(repo.writes.at(-1)?.contact?.email?.value).toBe('rahul@example.com');
    expect(result).toMatchObject({ id: LEAD_ID, contactFullName: 'Rahul S.', source: 'referral' });
  });

  it('moves the lead to the contact that already owns a new phone', async () => {
    repo.seedContact(contact(OTHER_CONTACT_ID, '+919800000001', 'Priya'));

    await useCase.execute(command({ phone: '+919800000001', fullName: 'Priya N' }), ADMIN);

    expect(repo.leads.get(LEAD_ID)?.contactId).toBe(OTHER_CONTACT_ID);
    expect(repo.writes.at(-1)?.contact?.fullName).toBe('Priya N');
  });

  it('creates a contact for a phone nobody has', async () => {
    await useCase.execute(command({ phone: '+919800000002' }), ADMIN);

    expect(repo.leads.get(LEAD_ID)?.contactId).toBe(ids.ids[0]);
    expect(repo.writes.at(-1)?.contact?.phone.value).toBe('+919800000002');
    // The original contact is untouched: other leads may share it.
    expect(repo.contacts.get('+919811122233')?.fullName).toBe('Rahul Sharma');
  });

  it('refuses a closed lead', async () => {
    const lead = newLead();
    lead.changeStatus(LeadStatus.create('lost'), NOW);
    repo.seedLead(lead);

    await expect(useCase.execute(command(), ADMIN)).rejects.toMatchObject({
      code: 'LEAD_CLOSED',
    });
  });

  it("hides another salesperson's lead", async () => {
    await expect(useCase.execute(command(), SALESPERSON)).rejects.toBeInstanceOf(NotFoundError);
  });
});
