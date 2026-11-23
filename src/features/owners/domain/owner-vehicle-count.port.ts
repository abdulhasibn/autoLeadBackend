import type { OwnerId } from '../../../domain/shared/owner-id';

/**
 * How many of an owner's cars are still open or linked to a lead (dropped and sold ones don't count),
 * read from the vehicles feature (ADR-0006). An owner can't be deactivated
 * while any are.
 */
export interface IOwnerVehicleCount {
  countOpenOrLinked(ownerId: OwnerId): Promise<number>;
}
