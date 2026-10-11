import type { SignOutScope } from '../ports/auth.port';

export interface LogoutCommand {
  readonly accessToken: string;
  /** `local` ends this device's session; `global` ends every session. */
  readonly scope: Extract<SignOutScope, 'local' | 'global'>;
}
