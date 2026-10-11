import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { type AuthCall, FakeAuthProvider, FakePasswordCredentials } from './fakes';

const USER_ID = toUserId('11111111-1111-4111-8111-111111111111');
const ACTOR: AuthenticatedContext = { userId: USER_ID, roles: ['salesperson'], showroomId: null };

describe('ChangePasswordUseCase', () => {
  let calls: AuthCall[];
  let credentials: FakePasswordCredentials;
  let useCase: ChangePasswordUseCase;

  beforeEach(() => {
    calls = [];
    credentials = new FakePasswordCredentials(calls);
    useCase = new ChangePasswordUseCase(credentials, new FakeAuthProvider(calls));
  });

  it('sets the new password, then ends every other session', async () => {
    await useCase.execute({
      actor: ACTOR,
      accessToken: 'token-a',
      currentPassword: 'old-secret-1',
      newPassword: 'new-secret-1',
    });

    expect(calls).toEqual([
      { kind: 'verifyPassword', userId: USER_ID, password: 'old-secret-1' },
      { kind: 'setPassword', userId: USER_ID, password: 'new-secret-1' },
      { kind: 'signOut', accessToken: 'token-a', scope: 'others' },
    ]);
  });

  it('rejects a wrong current password without changing anything', async () => {
    const attempt = useCase.execute({
      actor: ACTOR,
      accessToken: 'token-a',
      currentPassword: 'wrong-guess',
      newPassword: 'new-secret-1',
    });

    await expect(attempt).rejects.toBeInstanceOf(BusinessRuleViolationError);
    await expect(attempt).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    expect(calls.map((c) => c.kind)).toEqual(['verifyPassword']);
  });

  it('rejects a new password equal to the current one', async () => {
    await expect(
      useCase.execute({
        actor: ACTOR,
        accessToken: 'token-a',
        currentPassword: 'old-secret-1',
        newPassword: 'old-secret-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_UNCHANGED' });
    expect(calls).toEqual([]);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    await expect(
      useCase.execute({
        actor: ACTOR,
        accessToken: 'token-a',
        currentPassword: 'old-secret-1',
        newPassword: 'short',
      }),
    ).rejects.toThrow('at least 8 characters');
    expect(calls).toEqual([]);
  });
});
