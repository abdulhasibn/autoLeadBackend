import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** Read side of ILinkedLeads: active-lead counts per vehicle. Implemented by the leads feature. */
export interface ILinkedLeadCounts {
  /** One lookup for the whole batch; vehicles with no active lead are absent. */
  countActiveByVehicles(vehicleIds: readonly VehicleId[]): Promise<ReadonlyMap<VehicleId, number>>;
}
