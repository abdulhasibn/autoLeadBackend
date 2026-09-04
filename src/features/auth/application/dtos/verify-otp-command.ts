export interface VerifyOtpCommand {
  /** E.164 phone number. */
  readonly phone: string;
  /** 6-digit one-time password from the SMS. */
  readonly token: string;
}
