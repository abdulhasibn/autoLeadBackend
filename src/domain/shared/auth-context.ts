import type { UserId } from './user-id';

/**
 * The authenticated actor attached to every authorised request.
 * `userId` comes from the JWT; `roles` are live grants from public.user_roles.
 * Lives in domain/shared so any feature's use case can depend on it
 * without creating cross-feature coupling.
 */
export interface AuthenticatedContext {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<string>;
}
