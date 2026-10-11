import type { LogoutCommand } from '../dtos/logout-command';
import type { IAuthProvider } from '../ports/auth.port';

/**
 * Ends the caller's session (`local`) or all of their sessions (`global`).
 * The refresh tokens of ended sessions stop working at once.
 */
export class LogoutUseCase {
  constructor(private readonly authProvider: IAuthProvider) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.authProvider.signOut(command.accessToken, command.scope);
  }
}
