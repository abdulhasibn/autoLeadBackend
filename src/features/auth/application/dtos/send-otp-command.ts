export interface SendOtpCommand {
  /** E.164 phone number, already validated by the Zod schema. */
  readonly phone: string;
}
