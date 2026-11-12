import type { LeadId } from '../../../domain/shared/lead-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** The CRM facts a quote shows about the person quoted. Plain CRM data, never amounts. */
export interface FinanceLeadFacts {
  readonly id: LeadId;
  /** The lead's contact (or registered buyer) name; null when neither is found. */
  readonly name: string | null;
  readonly phone: string | null;
  readonly deleted: boolean;
}

/**
 * Feature-local view of leads (ADR-0006): finance never imports the leads
 * feature. Includes deleted leads so old quotes keep their names.
 */
export interface IFinanceLeadLookup {
  findMany(ids: readonly LeadId[]): Promise<readonly FinanceLeadFacts[]>;
  /** Live leads linked to the car with their booking confirmed: who a sale can close against. */
  listBookedForVehicle(vehicleId: VehicleId): Promise<readonly FinanceLeadFacts[]>;
}
