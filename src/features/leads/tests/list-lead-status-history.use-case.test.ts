import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { LeadId } from '../../../domain/shared/lead-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ListLeadStatusHistoryUseCase } from '../application/use-cases/list-lead-status-history.use-case';
import type {
  ILeadStatusHistoryQueries,
  LeadStatusHistoryReadModel,
} from '../domain/lead-status-history.queries';
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

const ENTRY: LeadStatusHistoryReadModel = {
  id: 'h1',
  leadId: LEAD_ID,
  fromStatus: 'new',
  toStatus: 'not_now',
  changedBy: ADMIN.userId,
  changedByName: 'Asha Admin',
  notes: 'Call back after Diwali',
  changedAt: '2026-10-05T00:00:00.000Z',
};

class FakeHistory implements ILeadStatusHistoryQueries {
  async listByLead(leadId: LeadId, page: Pagination): Promise<Page<LeadStatusHistoryReadModel>> {
    const items = [ENTRY].filter((entry) => entry.leadId === leadId);
    return toPage(items, items.length, page);
  }
}

function useCaseWith(assignedTo: string | null): ListLeadStatusHistoryUseCase {
  const leads = new FakeLeadQueries();
  leads.seed(leadReadModel({ id: LEAD_ID, assignedTo }));
  return new ListLeadStatusHistoryUseCase(new LeadManagementPolicy(), leads, new FakeHistory());
}

describe('ListLeadStatusHistoryUseCase', () => {
  it('returns the lead history page', async () => {
    const page = await useCaseWith(null).execute(LEAD_ID, PAGE, ADMIN);
    expect(page.items).toEqual([ENTRY]);
  });

  it("lets a salesperson read their own lead's history", async () => {
    const page = await useCaseWith(SALESPERSON.userId).execute(LEAD_ID, PAGE, SALESPERSON);
    expect(page.total).toBe(1);
  });

  it("hides another salesperson's lead", async () => {
    await expect(useCaseWith(null).execute(LEAD_ID, PAGE, SALESPERSON)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('404s an unknown lead', async () => {
    await expect(
      useCaseWith(null).execute('99999999-9999-4999-8999-999999999999', PAGE, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
