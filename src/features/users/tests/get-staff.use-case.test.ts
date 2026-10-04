import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { GetStaffUseCase } from '../application/use-cases/get-staff.use-case';
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

describe('GetStaffUseCase', () => {
  let useCase: GetStaffUseCase;
  let queries: FakeStaffQueries;

  beforeEach(() => {
    queries = new FakeStaffQueries();
    useCase = new GetStaffUseCase(new AdminStaffPolicy(), queries);
  });

  it('returns the staff member for an admin', async () => {
    queries.seed(MEMBER);

    await expect(useCase.execute(MEMBER.id, ADMIN)).resolves.toEqual(MEMBER);
  });

  it('throws NotFoundError when the staff member does not exist', async () => {
    await expect(useCase.execute(MEMBER.id, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a non-admin actor', async () => {
    await expect(
      useCase.execute(MEMBER.id, {
        userId: toUserId(MEMBER.id),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
