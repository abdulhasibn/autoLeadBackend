export interface ResetPasswordCommand {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
}
