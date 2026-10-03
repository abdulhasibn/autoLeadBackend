import { beforeEach, describe, expect, it } from 'vitest';

import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { UserProfileDto } from '../application/dtos/user-profile.dto';
import type { ITokenVerifier } from '../application/ports/token-verifier.port';
import type { IAuthQueries } from '../application/queries/auth.queries';
import { AuthenticateActorUseCase } from '../application/use-cases/authenticate-actor.use-case';

class FakeTokenVerifier implements ITokenVerifier {
  nextUserId: UserId | null = toUserId('user-1');

  async verify(): Promise<UserId | null> {
    return this.nextUserId;
  }
}

class FakeAuthQueries implements IAuthQueries {
  roles: ReadonlyArray<string> = ['admin'];

  async findProfile(): Promise<UserProfileDto | null> {
    return null;
  }

  async findLiveRoles(): Promise<ReadonlyArray<string>> {
    return this.roles;
  }
}

describe('AuthenticateActorUseCase', () => {
  let useCase: AuthenticateActorUseCase;
  let tokenVerifier: FakeTokenVerifier;
  let queries: FakeAuthQueries;

  beforeEach(() => {
    tokenVerifier = new FakeTokenVerifier();
    queries = new FakeAuthQueries();
    useCase = new AuthenticateActorUseCase(tokenVerifier, queries);
  });

  it('returns userId and live roles when the token is valid', async () => {
    const ctx = await useCase.execute('token');

    expect(ctx).toEqual({
      userId: toUserId('user-1'),
      roles: ['admin'],
    });
  });

  it('returns null when the token is invalid', async () => {
    tokenVerifier.nextUserId = null;

    await expect(useCase.execute('bad')).resolves.toBeNull();
  });

  it('returns an empty role list when the user has no live grants', async () => {
    queries.roles = [];

    const ctx = await useCase.execute('token');

    expect(ctx).toEqual({
      userId: toUserId('user-1'),
      roles: [],
    });
  });
});
