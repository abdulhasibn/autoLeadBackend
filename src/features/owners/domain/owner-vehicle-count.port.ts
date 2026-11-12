import type { OwnerId } from '../../../domain/shared/owner-id';

/**
 * How many of an owner's cars are still unsold (open, linked or dropped),
 * read from the vehicles feature (ADR-0006). An owner can't be deactivated
 * while any are.
 */
export interface IOwnerVehicleCount {
  countUnsold(ownerId: OwnerId): Promise<number>;
}
