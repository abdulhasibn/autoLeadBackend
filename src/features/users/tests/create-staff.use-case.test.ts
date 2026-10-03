import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { UniqueViolationError } from '../../../domain/errors/unique-violation.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';
import { CreateStaffUseCase } from '../application/use-cases/create-staff.use-case';
import { FakeAuthUserProvisioner, FakeClock, FakeUserRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
};

const COMMAND = {
  fullName: 'Grace Hopper',
  phone: '+919876543210',
  email: 'grace@example.com',
  password: 'secret12',
  showroomId: null,
  roles: ['salesperson'],
};

describe('CreateStaffUseCase', () => {
  let useCase: CreateStaffUseCase;
  let repo: FakeUserRepository;
  let provisioner: FakeAuthUserProvisioner;
  let clock: FakeClock;

  beforeEach(() => {
    repo = new FakeUserRepository();
    provisioner = new FakeAuthUserProvisioner();
    clock = new FakeClock(new Date('2026-09-10T00:00:00.000Z'));
    useCase = new CreateStaffUseCase(new AdminStaffPolicy(), repo, provisioner, clock);
  });

  it('creates a staff user when the actor is an admin', async () => {
    const result = await useCase.execute(COMMAND, ADMIN);

    expect(result).toMatchObject({
      id: provisioner.nextId,
      fullName: 'Grace Hopper',
      phone: '+919876543210',
      email: 'grace@example.com',
      roles: ['salesperson'],
    });
    expect(provisioner.provisioned).toEqual([{ email: 'grace@example.com', password: 'secret12' }]);
    expect(repo.store.has(provisioner.nextId)).toBe(true);
  });

  it('rejects a non-admin actor', async () => {
    await expect(useCase.execute(COMMAND, SALES)).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(provisioner.provisioned).toHaveLength(0);
  });

  it('throws when the phone is not E.164', async () => {
    await expect(useCase.execute({ ...COMMAND, phone: '9876543210' }, ADMIN)).rejects.toThrow(
      'E.164',
    );
    expect(provisioner.provisioned).toHaveLength(0);
  });

  it('throws when the email is invalid', async () => {
    await expect(useCase.execute({ ...COMMAND, email: 'not-an-email' }, ADMIN)).rejects.toThrow(
      'valid email',
    );
    expect(provisioner.provisioned).toHaveLength(0);
  });

  it('throws when the password is shorter than 8 characters', async () => {
    await expect(useCase.execute({ ...COMMAND, password: 'short' }, ADMIN)).rejects.toThrow(
      'at least 8 characters',
    );
    expect(provisioner.provisioned).toHaveLength(0);
  });

  it('deletes the provisioned auth user when save fails', async () => {
    repo.saveError = new UniqueViolationError();

    await expect(useCase.execute(COMMAND, ADMIN)).rejects.toBeInstanceOf(UniqueViolationError);
    expect(provisioner.deleted).toEqual([provisioner.nextId]);
  });
});
