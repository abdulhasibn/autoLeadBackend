import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { UserProfileDto } from '../dtos/user-profile.dto';
import type { IAuthQueries } from '../queries/auth.queries';

/**
 * Returns the profile of the currently authenticated user.
 * The actor's identity is established by the bearer middleware before this runs.
 */
export class GetMeUseCase {
  constructor(private readonly authQueries: IAuthQueries) {}

  async execute(ctx: AuthenticatedContext): Promise<UserProfileDto> {
    const profile = await this.authQueries.findProfile(ctx.userId);

    if (profile === null) {
      throw new NotFoundError(`User profile not found for id ${ctx.userId}`);
    }

    // Roles and home showroom were loaded when the actor was resolved.
    return { ...profile, roles: ctx.roles, showroomId: ctx.showroomId };
  }
}
