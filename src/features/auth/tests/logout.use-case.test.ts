import { describe, expect, it } from 'vitest';

import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { type AuthCall, FakeAuthProvider } from './fakes';

describe('LogoutUseCase', () => {
  it.each(['local', 'global'] as const)('signs out with scope %s', async (scope) => {
    const calls: AuthCall[] = [];
    const useCase = new LogoutUseCase(new FakeAuthProvider(calls));

    await useCase.execute({ accessToken: 'token-a', scope });

    expect(calls).toEqual([{ kind: 'signOut', accessToken: 'token-a', scope }]);
  });
});
