import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { LastAdminProtectedError } from '../application/errors/last-admin-protected.error';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { ReplaceStaffRolesUseCase } from '../application/use-cases/replace-staff-roles.use-case';
import { StaffRole } from '../domain/staff-role.value-object';
import { StaffUser } from '../domain/staff-user.entity';
import { FakeUserRepository } from './fakes';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

function seedAdminTarget(): StaffUser {
  return StaffUser.create({
    id: toUserId(TARGET_ID),
    fullName: 'Last Admin',
    phone: Phone.create('+919876543210'),
    email: null,
    showroomId: null,
    roles: [StaffRole.admin()],
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

describe('ReplaceStaffRolesUseCase', () => {
  let useCase: ReplaceStaffRolesUseCase;
  let repo: FakeUserRepository;

  beforeEach(() => {
    repo = new FakeUserRepository();
    useCase = new ReplaceStaffRolesUseCase(new AdminStaffPolicy(), repo);
  });

  it('replaces roles when another admin remains', async () => {
    repo.seed(seedAdminTarget());
    repo.roleCountOverride = new Map([['admin', 2]]);

    const result = await useCase.execute({ userId: TARGET_ID, roles: ['salesperson'] }, ADMIN);

    expect(result.roles).toEqual(['salesperson']);
  });

  it('refuses to drop the last remaining admin', async () => {
    repo.seed(seedAdminTarget());
    repo.roleCountOverride = new Map([['admin', 1]]);

    await expect(
      useCase.execute({ userId: TARGET_ID, roles: ['salesperson'] }, ADMIN),
    ).rejects.toBeInstanceOf(LastAdminProtectedError);
  });

  it('throws NotFoundError when the staff user does not exist', async () => {
    await expect(
      useCase.execute({ userId: TARGET_ID, roles: ['salesperson'] }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a non-admin actor', async () => {
    await expect(
      useCase.execute(
        { userId: TARGET_ID, roles: ['admin'] },
        { userId: toUserId(TARGET_ID), roles: ['salesperson'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
