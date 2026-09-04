import { Phone } from '../../domain/phone.value-object';
import type { SendOtpCommand } from '../dtos/send-otp-command';
import type { IAuthProvider } from '../ports/auth.port';

/**
 * Sends a one-time password to the given phone number.
 * Validates the phone as a domain value object before delegating to the provider.
 */
export class SendOtpUseCase {
  constructor(private readonly authProvider: IAuthProvider) {}

  async execute(command: SendOtpCommand): Promise<void> {
    // Domain validation: Phone VO rejects non-E.164 numbers at this boundary.
    const phone = Phone.create(command.phone);
    await this.authProvider.sendOtp(phone.value);
  }
}
