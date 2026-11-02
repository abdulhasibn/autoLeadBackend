import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** The car facts finance needs. Read from the vehicles data, never amounts. */
export interface FinanceVehicleFacts {
  readonly id: VehicleId;
  readonly showroomId: ShowroomId;
  /** "Make Model · REG" for lists. */
  readonly label: string;
}

/**
 * Feature-local view of cars (ADR-0006): finance never imports the vehicles
 * feature.
 */
export interface IFinanceVehicleLookup {
  /** A live car an entry can be linked to; null when missing or deleted. */
  findLinkable(id: VehicleId): Promise<FinanceVehicleFacts | null>;
  /** Labels for entries already linked, including cars deleted since. */
  findMany(ids: readonly VehicleId[]): Promise<readonly FinanceVehicleFacts[]>;
}
