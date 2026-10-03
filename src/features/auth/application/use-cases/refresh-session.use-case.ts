import type { AuthSessionDto } from '../dtos/auth-session.dto';
import type { RefreshSessionCommand } from '../dtos/refresh-session-command';
import type { IAuthProvider } from '../ports/auth.port';

/**
 * Exchanges a refresh token for a new session.
 */
export class RefreshSessionUseCase {
  constructor(private readonly authProvider: IAuthProvider) {}

  async execute(command: RefreshSessionCommand): Promise<AuthSessionDto> {
    const session = await this.authProvider.refresh(command.refreshToken);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
