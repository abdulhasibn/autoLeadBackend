import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';
import { GetOwnerUseCase } from '../application/use-cases/get-owner.use-case';
import type { OwnerReadModel } from '../domain/owner.queries';
import { FakeOwnerQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
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

describe('GetOwnerUseCase', () => {
  let useCase: GetOwnerUseCase;
  let queries: FakeOwnerQueries;

  beforeEach(() => {
    queries = new FakeOwnerQueries();
    useCase = new GetOwnerUseCase(new OwnerManagementPolicy(), queries);
  });

  it('returns the owner for an admin', async () => {
    queries.seed(MEMBER);

    await expect(useCase.execute(MEMBER.id, ADMIN)).resolves.toEqual(MEMBER);
  });

  it('throws NotFoundError when the owner does not exist', async () => {
    await expect(useCase.execute(MEMBER.id, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(MEMBER.id, {
        userId: toUserId(MEMBER.id),
        roles: ['buyer'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
