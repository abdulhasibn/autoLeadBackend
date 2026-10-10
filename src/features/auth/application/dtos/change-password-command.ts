import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

export interface ChangePasswordCommand {
  readonly actor: AuthenticatedContext;
  /** The caller's session, kept alive while every other session is ended. */
  readonly accessToken: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}
