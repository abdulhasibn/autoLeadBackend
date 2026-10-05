import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { AssignLeadUseCase } from '../application/use-cases/assign-lead.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../../../domain/shared/lead-id';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeAssignableStaffLookup, FakeClock, FakeLeadRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALES_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-10-03T00:00:00.000Z');

function seed(status: string): Lead {
  return Lead.reconstitute({
    id: toLeadId(LEAD_ID),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId: null,
    assignedTo: null,
    source: LeadSource.create('phone'),
    status: LeadStatus.create(status),
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
    deletedAt: null,
  });
}

describe('AssignLeadUseCase', () => {
  let repo: FakeLeadRepository;
  let staff: FakeAssignableStaffLookup;
  let useCase: AssignLeadUseCase;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    repo.seedLead(seed('new'));
    staff = new FakeAssignableStaffLookup();
    staff.assignable.add(SALES_ID);
    useCase = new AssignLeadUseCase(new LeadManagementPolicy(), repo, staff, new FakeClock(NOW));
  });

  it('assigns a lead to a salesperson and records the admin as actor', async () => {
    const result = await useCase.execute({ leadId: LEAD_ID, assignedTo: SALES_ID }, ADMIN);
    expect(result).toEqual({ id: LEAD_ID, assignedTo: SALES_ID });
    expect(repo.writes).toEqual([{ actorId: ADMIN.userId }]);
    expect((await repo.findById(toLeadId(LEAD_ID)))?.hasAssigneeChanged).toBe(true);
  });

  it('skips the write when the assignee is unchanged', async () => {
    await useCase.execute({ leadId: LEAD_ID, assignedTo: null }, ADMIN);
    expect(repo.writes).toHaveLength(0);
  });

  it('rejects an assignee who is not active staff', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, assignedTo: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
        ADMIN,
      ),
    ).rejects.toMatchObject({ code: 'ASSIGNEE_NOT_ELIGIBLE' });
  });

  it('refuses to reassign a closed lead', async () => {
    repo.seedLead(seed('lost'));
    await expect(
      useCase.execute({ leadId: LEAD_ID, assignedTo: SALES_ID }, ADMIN),
    ).rejects.toMatchObject({ code: 'LEAD_CLOSED' });
  });

  it('reports an unknown lead', async () => {
    await expect(
      useCase.execute({ leadId: '99999999-9999-4999-8999-999999999999', assignedTo: null }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is admin-only', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, assignedTo: SALES_ID },
        { userId: toUserId(SALES_ID), roles: ['salesperson'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
