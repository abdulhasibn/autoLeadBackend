import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';
import { ListOwnersUseCase } from '../application/use-cases/list-owners.use-case';
import type { OwnerReadModel } from '../domain/owner.queries';
import { FakeOwnerQueries } from './fakes';

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

const MEMBER: OwnerReadModel = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: null,
  fullName: 'Priya Shah',
  phone: '+919876543210',
  email: null,
  address: null,
  city: 'Bengaluru',
  preferredContactMethod: 'whatsapp',
  altPhone: null,
  idInfo: null,
  notes: null,
  createdBy: ADMIN.userId,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('ListOwnersUseCase', () => {
  let useCase: ListOwnersUseCase;
  let queries: FakeOwnerQueries;

  beforeEach(() => {
    queries = new FakeOwnerQueries();
    queries.seed(MEMBER);
    useCase = new ListOwnersUseCase(new OwnerManagementPolicy(), queries);
  });

  it('returns a page of owners for an admin', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);

    expect(page.total).toBe(1);
    expect(page.items).toEqual([MEMBER]);
  });

  it('returns a page of owners for a salesperson', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, SALES);
    expect(page.total).toBe(1);
  });

  it('filters by city', async () => {
    const page = await useCase.execute(
      { city: 'Bengaluru', page: { limit: 20, offset: 0 } },
      ADMIN,
    );
    expect(page.total).toBe(1);

    const empty = await useCase.execute({ city: 'Mumbai', page: { limit: 20, offset: 0 } }, ADMIN);
    expect(empty.total).toBe(0);
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(
        { page: { limit: 20, offset: 0 } },
        { userId: toUserId(MEMBER.id), roles: ['buyer'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
