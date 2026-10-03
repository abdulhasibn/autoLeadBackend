import type { OwnerId } from '../../../domain/shared/owner-id';

/**
 * Vehicles-local check that an owner is live. Wired from the owners
 * repository at the composition root.
 */
export interface IRegisteredOwnerLookup {
  isLive(ownerId: OwnerId): Promise<boolean>;
}
