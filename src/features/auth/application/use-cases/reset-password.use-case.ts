import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';
import { ResetCode } from '../../domain/reset-code.value-object';
import type { ResetPasswordCommand } from '../dtos/reset-password-command';
import type { IAuthProvider } from '../ports/auth.port';
import type { IPasswordCredentials } from '../ports/password-credentials.port';

/**
 * Sets a new password with an emailed reset code, then ends every session of
 * the user (including any held by whoever knew the old password).
 * The user signs in again afterwards.
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly credentials: IPasswordCredentials,
    private readonly authProvider: IAuthProvider,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const email = Email.create(command.email);
    const code = ResetCode.create(command.code);
    const newPassword = Password.create(command.newPassword);

    const redeemed = await this.credentials.redeemResetCode(email.value, code.value);
    if (redeemed === null) {
      throw new BusinessRuleViolationError(
        'INVALID_RESET_CODE',
        'Reset code is invalid or has expired',
      );
    }

    await this.credentials.setPassword(redeemed.userId, newPassword.value);
    await this.authProvider.signOut(redeemed.accessToken, 'global');
  }
}
