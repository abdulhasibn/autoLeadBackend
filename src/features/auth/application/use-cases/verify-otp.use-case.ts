import { Phone } from '../../domain/phone.value-object';
import type { OtpSessionDto } from '../dtos/otp-session.dto';
import type { VerifyOtpCommand } from '../dtos/verify-otp-command';
import type { IAuthProvider } from '../ports/auth.port';

/**
 * Verifies the OTP and returns session credentials on success.
 * Propagates provider errors (invalid/expired token) to the caller.
 */
export class VerifyOtpUseCase {
  constructor(private readonly authProvider: IAuthProvider) {}

  async execute(command: VerifyOtpCommand): Promise<OtpSessionDto> {
    // Domain validation: Phone VO ensures the number is E.164.
    const phone = Phone.create(command.phone);

    const session = await this.authProvider.verifyOtp(phone.value, command.token);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
