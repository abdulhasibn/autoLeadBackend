import { describe, expect, it } from 'vitest';

import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { type AuthCall, FakePasswordCredentials } from './fakes';

describe('RequestPasswordResetUseCase', () => {
  it('sends the code to the normalised email', async () => {
    const calls: AuthCall[] = [];
    const useCase = new RequestPasswordResetUseCase(new FakePasswordCredentials(calls));

    await useCase.execute({ email: '  Ada@Example.COM ' });

    expect(calls).toEqual([{ kind: 'sendResetCode', email: 'ada@example.com' }]);
  });

  it('rejects an invalid email', async () => {
    const calls: AuthCall[] = [];
    const useCase = new RequestPasswordResetUseCase(new FakePasswordCredentials(calls));

    await expect(useCase.execute({ email: 'nope' })).rejects.toThrow('valid email');
    expect(calls).toEqual([]);
  });
});
