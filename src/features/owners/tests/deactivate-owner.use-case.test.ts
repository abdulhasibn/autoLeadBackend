import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';
import { DeactivateOwnerUseCase } from '../application/use-cases/deactivate-owner.use-case';
import { Owner } from '../domain/owner.entity';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { FakeClock, FakeOwnerRepository } from './fakes';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const ADMIN: AuthenticatedContext = {
  userId: toUserId(ADMIN_ID),
  roles: ['admin'],
  showroomId: null,
};

function seedOwner(): Owner {
  return Owner.create({
    id: toOwnerId(OWNER_ID),
    fullName: 'Priya Shah',
    phone: Phone.create('+919876543210'),
    email: null,
    address: null,
    city: null,
    preferredContactMethod: null,
    altPhone: null,
    idInfo: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

describe('DeactivateOwnerUseCase', () => {
  let useCase: DeactivateOwnerUseCase;
  let repo: FakeOwnerRepository;

  beforeEach(() => {
    repo = new FakeOwnerRepository();
    useCase = new DeactivateOwnerUseCase(
      new OwnerManagementPolicy(),
      repo,
      new FakeClock(new Date('2026-09-14T12:00:00.000Z')),
    );
  });

  it('soft-deactivates an owner', async () => {
    repo.seed(seedOwner());

    await useCase.execute(OWNER_ID, ADMIN);

    const stored = repo.store.get(OWNER_ID);
    expect(stored?.isDeactivated).toBe(true);
    expect(stored?.deletedAt?.toISOString()).toBe('2026-09-14T12:00:00.000Z');
  });

  it('throws NotFoundError when the owner does not exist', async () => {
    await expect(useCase.execute(OWNER_ID, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a salesperson', async () => {
    repo.seed(seedOwner());
    await expect(
      useCase.execute(OWNER_ID, {
        userId: toUserId(OWNER_ID),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
