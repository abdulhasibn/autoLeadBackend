import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { ListStaffUseCase } from '../application/use-cases/list-staff.use-case';
import type { StaffMemberReadModel } from '../domain/staff.queries';
import { FakeStaffQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const MEMBER: StaffMemberReadModel = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Ada Lovelace',
  phone: '+919876543210',
  email: null,
  showroomId: null,
  roles: ['salesperson'],
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('ListStaffUseCase', () => {
  let useCase: ListStaffUseCase;
  let queries: FakeStaffQueries;

  beforeEach(() => {
    queries = new FakeStaffQueries();
    queries.seed(MEMBER);
    useCase = new ListStaffUseCase(new AdminStaffPolicy(), queries);
  });

  it('returns a page of staff for an admin', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);

    expect(page.total).toBe(1);
    expect(page.items).toEqual([MEMBER]);
  });

  it('rejects a non-admin actor', async () => {
    await expect(
      useCase.execute(
        { page: { limit: 20, offset: 0 } },
        { userId: toUserId(MEMBER.id), roles: ['salesperson'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
