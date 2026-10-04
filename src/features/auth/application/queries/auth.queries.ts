import type { ShowroomId } from '../../../../domain/shared/showroom-id';
import type { UserId } from '../../../../domain/shared/user-id';
import type { UserProfileDto } from '../dtos/user-profile.dto';

/**
 * Query interface for auth-scoped profile reads.
 * Command repos and query interfaces are kept separate (logical CQRS — ADR-0001).
 */
export interface IAuthQueries {
  /**
   * Returns the public profile of the authenticated user, or null when the
   * user record has not been provisioned yet (e.g. first sign-in before
   * the profile row exists).
   */
  findProfile(userId: UserId): Promise<UserProfileDto | null>;

  /**
   * Live role names and home showroom for a user who is not soft-deleted.
   * Roles are empty when the profile is missing, deactivated, or has no grants.
   */
  findActor(userId: UserId): Promise<ActorGrants>;
}

export interface ActorGrants {
  readonly roles: ReadonlyArray<string>;
  readonly showroomId: ShowroomId | null;
}
