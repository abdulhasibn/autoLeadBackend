import type { VehicleReadModel } from '../../domain/vehicle.queries';
import type { Vehicle } from '../../domain/vehicle.entity';

export interface VehicleDto extends VehicleReadModel {
  /** Signed URL of the cover (`front`) photo; null when the vehicle has none. */
  readonly frontImageUrl: string | null;
  readonly frontImageUrlExpiresAt: string | null;
  /** Active leads (new / not_now / booking_confirmed) linked to this vehicle. */
  readonly linkedLeadCount: number;
}

export function toVehicleDto(vehicle: Vehicle): VehicleDto {
  return {
    id: vehicle.id,
    showroomId: vehicle.showroomId,
    ownerId: vehicle.ownerId,
    variantId: vehicle.variantId,
    makeName: null,
    modelName: null,
    variantName: null,
    year: vehicle.year.value,
    registrationNumber: vehicle.registrationNumber.value,
    fuelType: vehicle.fuelType.value,
    transmission: vehicle.transmission.value,
    kmDriven: vehicle.kmDriven.value,
    numPreviousOwners: vehicle.numPreviousOwners.value,
    colour: vehicle.colour,
    insuranceValidUntil:
      vehicle.insuranceValidUntil === null ? null : vehicle.insuranceValidUntil.value,
    rcStatus: vehicle.rcStatus,
    serviceHistory: vehicle.serviceHistory,
    accidentHistory: vehicle.accidentHistory,
    loanStatus: vehicle.loanStatus,
    location: vehicle.location,
    description: vehicle.description,
    status: vehicle.status.value,
    soldLeadId: vehicle.soldLeadId,
    acquisitionType: vehicle.acquisitionType.value,
    submittedBy: vehicle.submittedBy,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    frontImageUrl: null,
    frontImageUrlExpiresAt: null,
    linkedLeadCount: 0,
  };
}
