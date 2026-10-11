import { beforeEach, describe, expect, it } from 'vitest';

import { toUserId } from '../../../domain/shared/user-id';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import { type AuthCall, FakeAuthProvider, FakePasswordCredentials } from './fakes';

const USER_ID = toUserId('11111111-1111-4111-8111-111111111111');

describe('ResetPasswordUseCase', () => {
  let calls: AuthCall[];
  let credentials: FakePasswordCredentials;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    calls = [];
    credentials = new FakePasswordCredentials(calls);
    useCase = new ResetPasswordUseCase(credentials, new FakeAuthProvider(calls));
  });

  it('redeems the code, sets the password, then ends every session', async () => {
    credentials.redeemable = { userId: USER_ID, accessToken: 'recovery-token' };

    await useCase.execute({
      email: 'Ada@Example.com',
      code: ' 123456 ',
      newPassword: 'new-secret-1',
    });

    expect(calls).toEqual([
      { kind: 'redeemResetCode', email: 'ada@example.com', code: '123456' },
      { kind: 'setPassword', userId: USER_ID, password: 'new-secret-1' },
      { kind: 'signOut', accessToken: 'recovery-token', scope: 'global' },
    ]);
  });

  it('rejects a wrong or expired code without changing anything', async () => {
    await expect(
      useCase.execute({ email: 'ada@example.com', code: '123456', newPassword: 'new-secret-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });
    expect(calls.map((c) => c.kind)).toEqual(['redeemResetCode']);
  });

  it.each(['12345', '1234567', 'abcdef'])('rejects the malformed code %s', async (code) => {
    await expect(
      useCase.execute({ email: 'ada@example.com', code, newPassword: 'new-secret-1' }),
    ).rejects.toThrow('6 digits');
    expect(calls).toEqual([]);
  });

  it('rejects a short new password before spending the code', async () => {
    credentials.redeemable = { userId: USER_ID, accessToken: 'recovery-token' };

    await expect(
      useCase.execute({ email: 'ada@example.com', code: '123456', newPassword: 'short' }),
    ).rejects.toThrow('at least 8 characters');
    expect(calls).toEqual([]);
  });
});
