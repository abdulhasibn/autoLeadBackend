import { beforeEach, describe, expect, it } from 'vitest';

import { type ShowroomId, toShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { UserProfileDto } from '../application/dtos/user-profile.dto';
import type { ITokenVerifier } from '../application/ports/token-verifier.port';
import type { ActorGrants, IAuthQueries } from '../application/queries/auth.queries';
import { AuthenticateActorUseCase } from '../application/use-cases/authenticate-actor.use-case';

class FakeTokenVerifier implements ITokenVerifier {
  nextUserId: UserId | null = toUserId('user-1');
  claimed: UserId | null = toUserId('user-1');
  /** When set, verify() waits for this before answering. */
  gate: Promise<void> | null = null;

  async verify(): Promise<UserId | null> {
    if (this.gate !== null) {
      await this.gate;
    }
    return this.nextUserId;
  }

  claimedSubject(): UserId | null {
    return this.claimed;
  }
}

class FakeAuthQueries implements IAuthQueries {
  roles: ReadonlyArray<string> = ['admin'];
  showroomId: ShowroomId | null = toShowroomId('showroom-1');
  failWith: Error | null = null;
  readonly lookups: UserId[] = [];

  async findProfile(): Promise<UserProfileDto | null> {
    return null;
  }

  async findActor(userId: UserId): Promise<ActorGrants> {
    this.lookups.push(userId);
    if (this.failWith !== null) {
      throw this.failWith;
    }
    return { roles: this.roles, showroomId: this.showroomId };
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

  it('returns userId, live roles and home showroom when the token is valid', async () => {
    const ctx = await useCase.execute('token');

    expect(ctx).toEqual({
      userId: toUserId('user-1'),
      roles: ['admin'],
      showroomId: toShowroomId('showroom-1'),
    });
    expect(queries.lookups).toEqual([toUserId('user-1')]);
  });

  it('starts the roles lookup before verification finishes', async () => {
    let release!: () => void;
    tokenVerifier.gate = new Promise((resolve) => {
      release = resolve;
    });

    const pending = useCase.execute('token');
    await Promise.resolve();

    expect(queries.lookups).toEqual([toUserId('user-1')]);
    release();
    await expect(pending).resolves.toMatchObject({ roles: ['admin'] });
  });

  it('returns null when the token is invalid', async () => {
    tokenVerifier.nextUserId = null;

    await expect(useCase.execute('bad')).resolves.toBeNull();
  });

  it('returns null for an invalid token even when the early lookup fails', async () => {
    tokenVerifier.nextUserId = null;
    queries.failWith = new Error('db down');

    await expect(useCase.execute('bad')).resolves.toBeNull();
  });

  it('surfaces a lookup failure for a valid token', async () => {
    queries.failWith = new Error('db down');

    await expect(useCase.execute('token')).rejects.toThrow('db down');
  });

  it('looks roles up again under the verified id when the claimed id differs', async () => {
    tokenVerifier.claimed = toUserId('someone-else');

    const ctx = await useCase.execute('token');

    expect(ctx?.userId).toBe(toUserId('user-1'));
    expect(queries.lookups).toEqual([toUserId('someone-else'), toUserId('user-1')]);
  });

  it('verifies first and then looks up roles when the token cannot be decoded', async () => {
    tokenVerifier.claimed = null;

    const ctx = await useCase.execute('opaque');

    expect(ctx?.roles).toEqual(['admin']);
    expect(queries.lookups).toEqual([toUserId('user-1')]);
  });

  it('returns an empty role list when the user has no live grants', async () => {
    queries.roles = [];
    queries.showroomId = null;

    const ctx = await useCase.execute('token');

    expect(ctx).toEqual({
      userId: toUserId('user-1'),
      roles: [],
      showroomId: null,
    });
  });
});
