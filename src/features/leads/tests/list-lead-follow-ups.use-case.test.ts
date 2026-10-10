import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { LeadId } from '../../../domain/shared/lead-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ListLeadFollowUpsUseCase } from '../application/use-cases/list-lead-follow-ups.use-case';
import type {
  FollowUpListScope,
  FollowUpReadModel,
  IFollowUpQueries,
} from '../domain/follow-up.queries';
import { FakeLeadQueries, leadReadModel } from './fakes';

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
const PAGE = { limit: 20, offset: 0 };

function entry(status: FollowUpReadModel['status']): FollowUpReadModel {
  return {
    id: `f-${status}`,
    leadId: LEAD_ID,
    taskType: 'call',
    scheduledAt: '2026-10-05T10:00:00.000Z',
    notes: null,
    status,
    outcome: status === 'completed' ? 'reached' : null,
    completionNotes: null,
    completedAt: status === 'completed' ? '2026-10-05T11:00:00.000Z' : null,
    completedBy: status === 'completed' ? ADMIN.userId : null,
    completedByName: status === 'completed' ? 'Asha Admin' : null,
    cancelledAt: null,
    cancelledBy: null,
    cancelledByName: null,
    assignedTo: ADMIN.userId,
    assignedToName: 'Asha Admin',
    createdBy: ADMIN.userId,
    createdByName: 'Asha Admin',
    createdAt: '2026-10-03T00:00:00.000Z',
  };
}

class FakeFollowUps implements IFollowUpQueries {
  readonly entries = [entry('open'), entry('completed')];

  async listByLead(
    leadId: LeadId,
    scope: FollowUpListScope,
    page: Pagination,
  ): Promise<Page<FollowUpReadModel>> {
    const items = this.entries.filter(
      (item) =>
        item.leadId === leadId &&
        (scope === 'all' || (scope === 'open') === (item.status === 'open')),
    );
    return toPage(items, items.length, page);
  }
}

function useCaseWith(assignedTo: string | null): ListLeadFollowUpsUseCase {
  const leads = new FakeLeadQueries();
  leads.seed(leadReadModel({ id: LEAD_ID, assignedTo }));
  return new ListLeadFollowUpsUseCase(new LeadManagementPolicy(), leads, new FakeFollowUps());
}

describe('ListLeadFollowUpsUseCase', () => {
  it('passes the scope to the query', async () => {
    const open = await useCaseWith(null).execute(LEAD_ID, 'open', PAGE, ADMIN);
    expect(open.items.map((item) => item.status)).toEqual(['open']);
    const closed = await useCaseWith(null).execute(LEAD_ID, 'closed', PAGE, ADMIN);
    expect(closed.items.map((item) => item.status)).toEqual(['completed']);
  });

  it("lets a salesperson read their own lead's follow-ups", async () => {
    const page = await useCaseWith(SALESPERSON.userId).execute(LEAD_ID, 'all', PAGE, SALESPERSON);
    expect(page.total).toBe(2);
  });

  it("hides another salesperson's lead", async () => {
    await expect(
      useCaseWith(null).execute(LEAD_ID, 'all', PAGE, SALESPERSON),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
