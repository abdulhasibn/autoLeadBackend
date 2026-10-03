import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { UserProfileDto } from '../application/dtos/user-profile.dto';
import type { IAuthQueries } from '../application/queries/auth.queries';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import type { UserId } from '../../../domain/shared/user-id';

// ── Fake ──────────────────────────────────────────────────────────────────────

class FakeAuthQueries implements IAuthQueries {
  private store = new Map<string, UserProfileDto>();

  seed(profile: UserProfileDto): void {
    this.store.set(profile.id, profile);
  }

  async findProfile(userId: UserId): Promise<UserProfileDto | null> {
    return this.store.get(userId) ?? null;
  }

  async findLiveRoles(): Promise<ReadonlyArray<string>> {
    return [];
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const PROFILE: UserProfileDto = {
  id: 'user-1',
  fullName: 'Alice Smith',
  phone: '+919876543210',
  email: 'alice@example.com',
  avatarUrl: null,
  roles: [],
};

const CTX: AuthenticatedContext = {
  userId: toUserId('user-1'),
  roles: ['salesperson'],
};

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;
  let fakeQueries: FakeAuthQueries;

  beforeEach(() => {
    fakeQueries = new FakeAuthQueries();
    useCase = new GetMeUseCase(fakeQueries);
  });

  it('returns the user profile with roles from the authenticated context', async () => {
    fakeQueries.seed(PROFILE);

    const result = await useCase.execute(CTX);

    expect(result).toEqual({
      ...PROFILE,
      roles: ['salesperson'],
    });
  });

  it('throws NotFoundError when the profile row does not exist', async () => {
    await expect(useCase.execute(CTX)).rejects.toBeInstanceOf(NotFoundError);
  });
});
