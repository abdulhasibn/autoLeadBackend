import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { CreateLeadUseCase } from '../application/use-cases/create-lead.use-case';
import { Contact } from '../domain/contact.entity';
import { toContactId } from '../domain/contact-id';
import { FakeClock, FakeIdGenerator, FakeLeadRepository, FakeLiveVehicleLookup } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const COMMAND = {
  showroomId: 'b0000000-0000-4000-8000-000000000001',
  fullName: 'Rahul Sharma',
  phone: '+919811122233',
  email: null,
  source: 'phone',
  vehicleId: null,
  budget: 800000,
  preferredVehicle: null,
  purchaseTimeline: null,
  financeRequired: null,
  currentVehicle: null,
  tradeInRequired: null,
  notes: 'called the showroom',
};

describe('CreateLeadUseCase', () => {
  let useCase: CreateLeadUseCase;
  let repo: FakeLeadRepository;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    ids = new FakeIdGenerator();
    useCase = new CreateLeadUseCase(
      new LeadManagementPolicy(),
      repo,
      new FakeLiveVehicleLookup(),
      new FakeClock(new Date('2026-10-03T00:00:00.000Z')),
      ids,
    );
  });

  it('creates a walk-in lead and a new contact', async () => {
    const result = await useCase.execute(COMMAND, ADMIN);
    expect(result.status).toBe('new');
    expect(result.contactPhone).toBe('+919811122233');
    expect(result.contactFullName).toBe('Rahul Sharma');
    expect(repo.leads.size).toBe(1);
  });

  it('reuses a live contact with the same phone', async () => {
    repo.seedContact(
      Contact.create({
        id: toContactId('aaaaaaaa-1111-4111-8111-aaaaaaaa1111'),
        fullName: 'Old Name',
        phone: Phone.create('+919811122233'),
        email: null,
        createdBy: ADMIN.userId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const result = await useCase.execute(COMMAND, ADMIN);
    expect(result.contactId).toBe('aaaaaaaa-1111-4111-8111-aaaaaaaa1111');
    expect(result.contactFullName).toBe('Rahul Sharma');
  });

  it('starts an admin lead unassigned', async () => {
    const result = await useCase.execute(COMMAND, ADMIN);
    expect(result.assignedTo).toBeNull();
  });

  it('assigns a salesperson lead to its creator in their home showroom', async () => {
    const result = await useCase.execute(
      { ...COMMAND, showroomId: null },
      {
        userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
        roles: ['salesperson'],
        showroomId: toShowroomId(COMMAND.showroomId),
      },
    );
    expect(result.assignedTo).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(result.showroomId).toBe(COMMAND.showroomId);
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(COMMAND, {
        userId: toUserId('cccc'),
        roles: ['buyer'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
