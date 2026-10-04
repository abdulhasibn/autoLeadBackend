import type { ShowroomId } from './showroom-id';
import type { UserId } from './user-id';

/**
 * The authenticated actor attached to every authorised request.
 * `userId` comes from the JWT; `roles` are live grants from public.user_roles
 * and `showroomId` is the actor's home showroom from public.users (null when
 * unset). Lives in domain/shared so any feature's use case can depend on it
 * without creating cross-feature coupling.
 */
export interface AuthenticatedContext {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<string>;
  readonly showroomId: ShowroomId | null;
}
