import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError } from '../../../domain/errors/conflict.error';
import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';
import { CreateOwnerUseCase } from '../application/use-cases/create-owner.use-case';
import { FakeClock, FakeIdGenerator, FakeOwnerRepository } from './fakes';

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

const COMMAND = {
  fullName: 'Priya Shah',
  phone: '+919876543210',
  email: 'priya@example.com',
  address: '12 MG Road',
  city: 'Bengaluru',
  preferredContactMethod: 'whatsapp',
  altPhone: '+919876543211',
  idInfo: null,
  notes: null,
};

describe('CreateOwnerUseCase', () => {
  let useCase: CreateOwnerUseCase;
  let repo: FakeOwnerRepository;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakeOwnerRepository();
    ids = new FakeIdGenerator();
    useCase = new CreateOwnerUseCase(
      new OwnerManagementPolicy(),
      repo,
      new FakeClock(new Date('2026-09-14T00:00:00.000Z')),
      ids,
    );
  });

  it('creates an owner when the actor is an admin', async () => {
    const result = await useCase.execute(COMMAND, ADMIN);

    expect(result).toMatchObject({
      id: ids.nextId,
      fullName: 'Priya Shah',
      phone: '+919876543210',
      email: 'priya@example.com',
      city: 'Bengaluru',
      preferredContactMethod: 'whatsapp',
      createdBy: ADMIN.userId,
    });
    expect(repo.store.has(ids.nextId)).toBe(true);
  });

  it('creates an owner when the actor is a salesperson', async () => {
    const result = await useCase.execute(COMMAND, SALES);
    expect(result.createdBy).toBe(SALES.userId);
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(COMMAND, { userId: toUserId('cccc'), roles: ['buyer'], showroomId: null }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(repo.store.size).toBe(0);
  });

  it('throws when the phone is not E.164', async () => {
    await expect(useCase.execute({ ...COMMAND, phone: '9876543210' }, ADMIN)).rejects.toThrow(
      'E.164',
    );
  });

  it('throws when the email is invalid', async () => {
    await expect(useCase.execute({ ...COMMAND, email: 'not-an-email' }, ADMIN)).rejects.toThrow(
      'valid email',
    );
  });

  it('rethrows a phone conflict from persistence', async () => {
    repo.saveError = new ConflictError('Owner with this phone already exists');
    await expect(useCase.execute(COMMAND, ADMIN)).rejects.toBeInstanceOf(ConflictError);
  });
});
