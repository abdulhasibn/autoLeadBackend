import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ListLeadsUseCase } from '../application/use-cases/list-leads.use-case';
import type { LeadReadModel } from '../domain/lead.queries';
import { EMPTY_PREFERENCE_EXTRAS, FakeLeadQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD: LeadReadModel = {
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
  ...EMPTY_PREFERENCE_EXTRAS,
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

describe('ListLeadsUseCase', () => {
  let useCase: ListLeadsUseCase;

  beforeEach(() => {
    const queries = new FakeLeadQueries();
    queries.seed(LEAD);
    queries.seed({ ...LEAD, id: '88888888-8888-4888-8888-888888888888', assignedTo: SALES.userId });
    useCase = new ListLeadsUseCase(new LeadManagementPolicy(), queries);
  });

  it('returns a page of leads', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.total).toBe(2);
    expect(page.items[0]?.contactFullName).toBe('Rahul Sharma');
  });

  it('lets an admin filter by assignee', async () => {
    const page = await useCase.execute(
      { assignedTo: SALES.userId, page: { limit: 20, offset: 0 } },
      ADMIN,
    );
    expect(page.items.map((lead) => lead.id)).toEqual(['88888888-8888-4888-8888-888888888888']);
  });

  it('shows a salesperson only their own leads, whatever filter they send', async () => {
    const page = await useCase.execute(
      { assignedTo: ADMIN.userId, page: { limit: 20, offset: 0 } },
      SALES,
    );
    expect(page.items.map((lead) => lead.assignedTo)).toEqual([SALES.userId]);
  });

  it('filters by preferred model', async () => {
    const queries = new FakeLeadQueries();
    queries.seed(LEAD);
    queries.seed({
      ...LEAD,
      id: '99999999-9999-4999-8999-999999999999',
      preferredMakeId: 'c0000000-0000-4000-8000-000000000001',
      preferredModelId: 'c0000000-0000-4000-8000-000000000002',
    });
    const filtered = new ListLeadsUseCase(new LeadManagementPolicy(), queries);

    const page = await filtered.execute(
      { preferredModelId: 'c0000000-0000-4000-8000-000000000002', page: { limit: 20, offset: 0 } },
      ADMIN,
    );

    expect(page.items.map((lead) => lead.id)).toEqual(['99999999-9999-4999-8999-999999999999']);
  });
});
