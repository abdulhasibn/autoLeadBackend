import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';
import { UpdateOwnerUseCase } from '../application/use-cases/update-owner.use-case';
import { Owner } from '../domain/owner.entity';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { FakeClock, FakeOwnerRepository } from './fakes';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

function seedOwner(): Owner {
  return Owner.create({
    id: toOwnerId(OWNER_ID),
    fullName: 'Priya Shah',
    phone: Phone.create('+919876543210'),
    email: 'priya@example.com',
    address: '12 MG Road',
    city: 'Bengaluru',
    preferredContactMethod: 'whatsapp',
    altPhone: null,
    idInfo: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

describe('UpdateOwnerUseCase', () => {
  let useCase: UpdateOwnerUseCase;
  let repo: FakeOwnerRepository;

  beforeEach(() => {
    repo = new FakeOwnerRepository();
    useCase = new UpdateOwnerUseCase(
      new OwnerManagementPolicy(),
      repo,
      new FakeClock(new Date('2026-09-14T12:00:00.000Z')),
    );
  });

  it('updates the owner profile', async () => {
    repo.seed(seedOwner());

    const result = await useCase.execute(
      {
        ownerId: OWNER_ID,
        fullName: 'Priya S.',
        phone: '+919876543219',
        email: 'priya.s@example.com',
        address: null,
        city: 'Mumbai',
        preferredContactMethod: 'phone',
        altPhone: null,
        idInfo: null,
        notes: 'updated',
      },
      ADMIN,
    );

    expect(result.fullName).toBe('Priya S.');
    expect(result.phone).toBe('+919876543219');
    expect(result.city).toBe('Mumbai');
    expect(result.preferredContactMethod).toBe('phone');
    expect(result.updatedAt).toBe('2026-09-14T12:00:00.000Z');
  });

  it('throws NotFoundError when the owner does not exist', async () => {
    await expect(
      useCase.execute(
        {
          ownerId: OWNER_ID,
          fullName: 'Priya',
          phone: '+919876543210',
          email: null,
          address: null,
          city: null,
          preferredContactMethod: null,
          altPhone: null,
          idInfo: null,
          notes: null,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a buyer', async () => {
    repo.seed(seedOwner());
    await expect(
      useCase.execute(
        {
          ownerId: OWNER_ID,
          fullName: 'Priya',
          phone: '+919876543210',
          email: null,
          address: null,
          city: null,
          preferredContactMethod: null,
          altPhone: null,
          idInfo: null,
          notes: null,
        },
        { userId: toUserId(OWNER_ID), roles: ['buyer'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
