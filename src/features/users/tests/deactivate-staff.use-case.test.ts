import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { LastAdminProtectedError } from '../application/errors/last-admin-protected.error';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { DeactivateStaffUseCase } from '../application/use-cases/deactivate-staff.use-case';
import { StaffRole } from '../domain/staff-role.value-object';
import { StaffUser } from '../domain/staff-user.entity';
import { FakeAuthUserProvisioner, FakeClock, FakeUserRepository } from './fakes';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const ADMIN: AuthenticatedContext = {
  userId: toUserId(ADMIN_ID),
  roles: ['admin'],
};

function seedStaff(id: string, roles: StaffRole[]): StaffUser {
  return StaffUser.create({
    id: toUserId(id),
    fullName: 'Staff Member',
    phone: Phone.create('+919876543210'),
    email: null,
    showroomId: null,
    roles,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

describe('DeactivateStaffUseCase', () => {
  let useCase: DeactivateStaffUseCase;
  let repo: FakeUserRepository;
  let provisioner: FakeAuthUserProvisioner;

  beforeEach(() => {
    repo = new FakeUserRepository();
    provisioner = new FakeAuthUserProvisioner();
    useCase = new DeactivateStaffUseCase(
      new AdminStaffPolicy(),
      repo,
      provisioner,
      new FakeClock(new Date('2026-09-10T12:00:00.000Z')),
    );
  });

  it('soft-deactivates a salesperson and disables their auth login', async () => {
    repo.seed(seedStaff(TARGET_ID, [StaffRole.salesperson()]));

    await useCase.execute(TARGET_ID, ADMIN);

    const stored = repo.store.get(TARGET_ID);
    expect(stored?.isDeactivated).toBe(true);
    expect(provisioner.disabled).toEqual([TARGET_ID]);
  });

  it('refuses to deactivate the acting admin', async () => {
    await expect(useCase.execute(ADMIN_ID, ADMIN)).rejects.toBeInstanceOf(LastAdminProtectedError);
    expect(provisioner.disabled).toHaveLength(0);
  });

  it('refuses to deactivate the last remaining admin', async () => {
    repo.seed(seedStaff(TARGET_ID, [StaffRole.admin()]));
    repo.roleCountOverride = new Map([['admin', 1]]);

    await expect(useCase.execute(TARGET_ID, ADMIN)).rejects.toBeInstanceOf(LastAdminProtectedError);
  });

  it('throws NotFoundError when the staff user does not exist', async () => {
    await expect(useCase.execute(TARGET_ID, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a non-admin actor', async () => {
    await expect(
      useCase.execute(TARGET_ID, { userId: toUserId(TARGET_ID), roles: ['salesperson'] }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
