import type { UserId } from '../../../../domain/shared/user-id';

export interface ProvisionAuthUserCommand {
  readonly email: string;
  readonly password: string;
}

/**
 * Provisions and manages the Supabase Auth identity that public.users.id mirrors.
 * Implemented in infrastructure with the service-role Auth admin API.
 * Auth identity is email + password; phone is profile-only.
 */
export interface IAuthUserProvisioner {
  provision(command: ProvisionAuthUserCommand): Promise<UserId>;
  updateEmail(userId: UserId, email: string): Promise<void>;
  disable(userId: UserId): Promise<void>;
  delete(userId: UserId): Promise<void>;
}
