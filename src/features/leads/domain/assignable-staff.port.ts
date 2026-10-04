import type { UserId } from '../../../domain/shared/user-id';

/** True when the user is live and holds a role that can own leads. */
export interface IAssignableStaffLookup {
  isAssignable(userId: UserId): Promise<boolean>;
}
