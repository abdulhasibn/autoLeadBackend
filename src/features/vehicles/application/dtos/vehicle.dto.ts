import type { VehicleReadModel } from '../../domain/vehicle.queries';
import type { Vehicle } from '../../domain/vehicle.entity';

export type VehicleDto = VehicleReadModel;

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
    acquisitionType: vehicle.acquisitionType.value,
    submittedBy: vehicle.submittedBy,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}
