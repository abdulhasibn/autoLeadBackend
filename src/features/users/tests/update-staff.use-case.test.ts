import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { UpdateStaffUseCase } from '../application/use-cases/update-staff.use-case';
import { StaffRole } from '../domain/staff-role.value-object';
import { StaffUser } from '../domain/staff-user.entity';
import { FakeAuthUserProvisioner, FakeUserRepository } from './fakes';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

function seedSalesperson(): StaffUser {
  return StaffUser.create({
    id: toUserId(USER_ID),
    fullName: 'Ada Lovelace',
    phone: Phone.create('+919876543210'),
    email: 'ada@example.com',
    showroomId: null,
    roles: [StaffRole.salesperson()],
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

describe('UpdateStaffUseCase', () => {
  let useCase: UpdateStaffUseCase;
  let repo: FakeUserRepository;
  let provisioner: FakeAuthUserProvisioner;

  beforeEach(() => {
    repo = new FakeUserRepository();
    provisioner = new FakeAuthUserProvisioner();
    useCase = new UpdateStaffUseCase(new AdminStaffPolicy(), repo, provisioner);
  });

  it('updates the profile without touching auth when the email is unchanged', async () => {
    repo.seed(seedSalesperson());

    const result = await useCase.execute(
      {
        userId: USER_ID,
        fullName: 'Ada L.',
        phone: '+919876543211',
        email: 'ADA@example.com',
        showroomId: null,
      },
      ADMIN,
    );

    expect(result.fullName).toBe('Ada L.');
    expect(result.phone).toBe('+919876543211');
    expect(result.email).toBe('ada@example.com');
    expect(provisioner.updatedEmails).toHaveLength(0);
  });

  it('updates the auth email when the address changes', async () => {
    repo.seed(seedSalesperson());

    await useCase.execute(
      {
        userId: USER_ID,
        fullName: 'Ada Lovelace',
        phone: '+919876543210',
        email: 'ada.l@example.com',
        showroomId: null,
      },
      ADMIN,
    );

    expect(provisioner.updatedEmails).toEqual([{ id: USER_ID, email: 'ada.l@example.com' }]);
  });

  it('throws NotFoundError when the staff user does not exist', async () => {
    await expect(
      useCase.execute(
        {
          userId: USER_ID,
          fullName: 'Ada',
          phone: '+919876543210',
          email: 'ada@example.com',
          showroomId: null,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a non-admin actor', async () => {
    await expect(
      useCase.execute(
        {
          userId: USER_ID,
          fullName: 'Ada',
          phone: '+919876543210',
          email: 'ada@example.com',
          showroomId: null,
        },
        { userId: toUserId(USER_ID), roles: ['salesperson'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
