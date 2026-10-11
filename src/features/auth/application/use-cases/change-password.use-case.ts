import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { Password } from '../../../../domain/shared/password.value-object';
import type { ChangePasswordCommand } from '../dtos/change-password-command';
import type { IAuthProvider } from '../ports/auth.port';
import type { IPasswordCredentials } from '../ports/password-credentials.port';

/**
 * Changes the signed-in user's password after checking the current one.
 * Every other session is ended; the caller's session stays signed in.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly credentials: IPasswordCredentials,
    private readonly authProvider: IAuthProvider,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const newPassword = Password.create(command.newPassword);
    if (newPassword.value === command.currentPassword) {
      throw new BusinessRuleViolationError(
        'PASSWORD_UNCHANGED',
        'New password must be different from the current password',
      );
    }

    const userId = command.actor.userId;
    const isCurrent = await this.credentials.verifyPassword(userId, command.currentPassword);
    if (!isCurrent) {
      throw new BusinessRuleViolationError(
        'INVALID_CURRENT_PASSWORD',
        'Current password is incorrect',
      );
    }

    await this.credentials.setPassword(userId, newPassword.value);
    await this.authProvider.signOut(command.accessToken, 'others');
  }
}
