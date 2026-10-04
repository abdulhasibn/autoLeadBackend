import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { ITokenVerifier } from '../ports/token-verifier.port';
import type { IAuthQueries } from '../queries/auth.queries';

/**
 * Resolves the request actor: JWT proves identity; live roles come from
 * public.user_roles (not app_metadata).
 */
export class AuthenticateActorUseCase {
  constructor(
    private readonly tokenVerifier: ITokenVerifier,
    private readonly authQueries: IAuthQueries,
  ) {}

  async execute(accessToken: string): Promise<AuthenticatedContext | null> {
    const userId = await this.tokenVerifier.verify(accessToken);
    if (userId === null) {
      return null;
    }

    const { roles, showroomId } = await this.authQueries.findActor(userId);
    return { userId, roles, showroomId };
  }
}
