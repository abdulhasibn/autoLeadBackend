import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { GetLeadUseCase } from '../application/use-cases/get-lead.use-case';
import type { LeadReadModel } from '../domain/lead.queries';
import { FakeLeadQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const LEAD: LeadReadModel = {
  id: '77777777-7777-4777-8777-777777777777',
  showroomId: 'b0000000-0000-4000-8000-000000000001',
  vehicleId: null,
  linkedVehicle: null,
  assignedTo: null,
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
  createdBy: ADMIN.userId,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
};

describe('GetLeadUseCase', () => {
  let useCase: GetLeadUseCase;

  beforeEach(() => {
    const queries = new FakeLeadQueries();
    queries.seed(LEAD);
    useCase = new GetLeadUseCase(new LeadManagementPolicy(), queries);
  });

  it('returns a lead', async () => {
    const result = await useCase.execute(LEAD.id, ADMIN);
    expect(result.contactPhone).toBe('+919811122233');
  });

  it('throws when missing', async () => {
    await expect(
      useCase.execute('55555555-5555-4555-8555-555555555555', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('shows a salesperson a lead assigned to them', async () => {
    const queries = new FakeLeadQueries();
    queries.seed({ ...LEAD, assignedTo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    const scoped = new GetLeadUseCase(new LeadManagementPolicy(), queries);
    const result = await scoped.execute(LEAD.id, {
      userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      roles: ['salesperson'],
      showroomId: null,
    });
    expect(result.id).toBe(LEAD.id);
  });

  it('hides a lead assigned to someone else from a salesperson', async () => {
    await expect(
      useCase.execute(LEAD.id, {
        userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
