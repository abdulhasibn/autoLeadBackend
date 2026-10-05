import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { ILinkableVehicleLookup } from '../../domain/linkable-vehicle.port';

export async function requireLinkableVehicle(
  vehicles: ILinkableVehicleLookup,
  vehicleId: VehicleId,
): Promise<void> {
  const linkability = await vehicles.linkability(vehicleId);
  if (linkability === 'not_found') {
    throw new NotFoundError(`Vehicle not found for id ${vehicleId}`);
  }
  if (linkability === 'unavailable') {
    throw new BusinessRuleViolationError(
      'VEHICLE_NOT_LINKABLE',
      'Only open or linked vehicles can be linked to a lead',
    );
  }
}
