import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';
import type { AuthSessionDto } from '../dtos/auth-session.dto';
import type { LoginCommand } from '../dtos/login-command';
import type { IAuthProvider } from '../ports/auth.port';

/**
 * Signs in with email + password and returns session credentials.
 */
export class LoginUseCase {
  constructor(private readonly authProvider: IAuthProvider) {}

  async execute(command: LoginCommand): Promise<AuthSessionDto> {
    const email = Email.create(command.email);
    const password = Password.create(command.password);
    const session = await this.authProvider.signIn(email.value, password.value);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
