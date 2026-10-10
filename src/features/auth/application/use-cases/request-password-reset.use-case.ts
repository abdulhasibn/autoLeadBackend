import { Email } from '../../../../domain/shared/email.value-object';
import type { RequestPasswordResetCommand } from '../dtos/request-password-reset-command';
import type { IPasswordCredentials } from '../ports/password-credentials.port';

/**
 * Emails a password reset code. Completes the same way whether or not an
 * account exists, so the response can't be used to find accounts.
 */
export class RequestPasswordResetUseCase {
  constructor(private readonly credentials: IPasswordCredentials) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = Email.create(command.email);
    await this.credentials.sendResetCode(email.value);
  }
}
