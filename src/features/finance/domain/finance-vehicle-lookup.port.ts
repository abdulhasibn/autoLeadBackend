import type { LeadId } from '../../../domain/shared/lead-id';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** The car facts finance needs. Read from the vehicles data, never amounts. */
export interface FinanceVehicleFacts {
  readonly id: VehicleId;
  readonly showroomId: ShowroomId;
  /** "Make Model · REG" for lists. */
  readonly label: string;
  /** Car status (`open`, `linked`, `dropped`, `sold`). */
  readonly status: string;
  readonly deleted: boolean;
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
  /** Live cars with status `sold` whose sale price hasn't been recorded in finance. */
  listSoldWithoutSale(): Promise<readonly SoldVehicleFacts[]>;
}

export interface SoldVehicleFacts extends FinanceVehicleFacts {
  readonly soldLeadId: LeadId | null;
}
