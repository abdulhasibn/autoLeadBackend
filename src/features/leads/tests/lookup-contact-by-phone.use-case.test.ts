import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { LookupContactByPhoneUseCase } from '../application/use-cases/lookup-contact-by-phone.use-case';
import { Contact } from '../domain/contact.entity';
import { toContactId } from '../domain/contact-id';
import { FakeLeadRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
};

describe('LookupContactByPhoneUseCase', () => {
  let repo: FakeLeadRepository;
  let useCase: LookupContactByPhoneUseCase;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    useCase = new LookupContactByPhoneUseCase(new LeadManagementPolicy(), repo);
    repo.seedContact(
      Contact.create({
        id: toContactId('aaaaaaaa-1111-4111-8111-aaaaaaaa1111'),
        fullName: 'Priya Shah',
        phone: Phone.create('+919811122233'),
        email: null,
        createdBy: ADMIN.userId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
  });

  it('names the contact that owns the phone, in any common shape', async () => {
    const result = await useCase.execute('98111 22233', ADMIN);
    expect(result).toEqual({
      exists: true,
      contact: { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaa1111', fullName: 'Priya Shah' },
    });
  });

  it('returns null for a phone nobody has', async () => {
    expect(await useCase.execute('+919800000009', ADMIN)).toEqual({ exists: false, contact: null });
  });

  it('tells a salesperson the number is taken, without naming the contact', async () => {
    expect(await useCase.execute('+919811122233', SALES)).toEqual({ exists: true, contact: null });
  });
});
