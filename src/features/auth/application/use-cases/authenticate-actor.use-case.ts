import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { ITokenVerifier } from '../ports/token-verifier.port';
import type { ActorGrants, IAuthQueries } from '../queries/auth.queries';

/**
 * Resolves the request actor: JWT proves identity; live roles come from
 * public.user_roles (not app_metadata).
 *
 * Token verification and the roles lookup are separate network round trips,
 * so they run at the same time: the roles lookup starts from the user id the
 * token claims, and its result is used only once verification confirms that
 * same id. A token that fails verification gets null, whatever the lookup did.
 */
export class AuthenticateActorUseCase {
  constructor(
    private readonly tokenVerifier: ITokenVerifier,
    private readonly authQueries: IAuthQueries,
  ) {}

  async execute(accessToken: string): Promise<AuthenticatedContext | null> {
    const claimedUserId = this.tokenVerifier.claimedSubject(accessToken);
    let prefetchedGrants: Promise<ActorGrants> | null = null;
    if (claimedUserId !== null) {
      prefetchedGrants = this.authQueries.findActor(claimedUserId);
      // Verification may fail first; the lookup's own failure is then moot.
      prefetchedGrants.catch(() => undefined);
    }

    const userId = await this.tokenVerifier.verify(accessToken);
    if (userId === null) {
      return null;
    }

    const { roles, showroomId } =
      prefetchedGrants !== null && claimedUserId === userId
        ? await prefetchedGrants
        : await this.authQueries.findActor(userId);
    return { userId, roles, showroomId };
  }
}
