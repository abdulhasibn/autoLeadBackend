import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../domain/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { Transmission } from '../domain/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import type { VehicleReadModel } from '../domain/vehicle.queries';
import { parseLoanStatus, parseRcStatus, parseServiceHistory } from '../domain/vehicle-details';
import { VehicleStatus } from '../domain/vehicle-status.value-object';
import { VehicleYear } from '../domain/vehicle-year.value-object';

export interface VehicleRow {
  readonly id: string;
  readonly showroom_id: string;
  readonly owner_id: string;
  readonly variant_id: string;
  readonly year: number;
  readonly registration_number: string;
  readonly fuel_type: string;
  readonly transmission: string;
  readonly km_driven: number;
  readonly num_previous_owners: number;
  readonly colour: string;
  readonly insurance_valid_until: string | null;
  readonly rc_status: string | null;
  readonly service_history: string | null;
  readonly accident_history: boolean;
  readonly loan_status: string | null;
  readonly location: string | null;
  readonly description: string | null;
  readonly status: string;
  readonly acquisition_type: string;
  readonly submitted_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface VehicleCatalogEmbed {
  readonly name: string;
  readonly models: {
    readonly name: string;
    readonly makes: { readonly name: string } | null;
  } | null;
}

export interface VehicleListRow extends VehicleRow {
  readonly variants: VehicleCatalogEmbed | null;
}

export function toVehicle(row: VehicleRow): Vehicle {
  return Vehicle.reconstitute({
    id: toVehicleId(row.id),
    showroomId: toShowroomId(row.showroom_id),
    ownerId: toOwnerId(row.owner_id),
    variantId: toVariantId(row.variant_id),
    year: mapVo(row.year, row.id, 'year', (value) => VehicleYear.create(value)),
    registrationNumber: mapVo(row.registration_number, row.id, 'registration_number', (value) =>
      RegistrationNumber.create(value),
    ),
    fuelType: mapVo(row.fuel_type, row.id, 'fuel_type', (value) => FuelType.create(value)),
    transmission: mapVo(row.transmission, row.id, 'transmission', (value) =>
      Transmission.create(value),
    ),
    kmDriven: mapVo(row.km_driven, row.id, 'km_driven', (value) => KilometersDriven.create(value)),
    numPreviousOwners: mapVo(row.num_previous_owners, row.id, 'num_previous_owners', (value) =>
      PreviousOwners.create(value),
    ),
    colour: row.colour,
    insuranceValidUntil:
      row.insurance_valid_until === null
        ? null
        : mapVo(row.insurance_valid_until, row.id, 'insurance_valid_until', (value) =>
            CalendarDate.create(value),
          ),
    rcStatus: mapVo(row.rc_status, row.id, 'rc_status', parseRcStatus),
    serviceHistory: mapVo(row.service_history, row.id, 'service_history', parseServiceHistory),
    accidentHistory: row.accident_history,
    loanStatus: mapVo(row.loan_status, row.id, 'loan_status', parseLoanStatus),
    location: row.location,
    description: row.description,
    status: mapVo(row.status, row.id, 'status', (value) => VehicleStatus.create(value)),
    acquisitionType: mapVo(row.acquisition_type, row.id, 'acquisition_type', (value) =>
      AcquisitionType.create(value),
    ),
    submittedBy: toUserId(row.submitted_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  });
}

export function toVehicleReadModel(row: VehicleListRow): VehicleReadModel | null {
  if (row.deleted_at !== null) {
    return null;
  }

  return {
    id: row.id,
    showroomId: row.showroom_id,
    ownerId: row.owner_id,
    variantId: row.variant_id,
    makeName: row.variants?.models?.makes?.name ?? null,
    modelName: row.variants?.models?.name ?? null,
    variantName: row.variants?.name ?? null,
    year: row.year,
    registrationNumber: row.registration_number,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    kmDriven: row.km_driven,
    numPreviousOwners: row.num_previous_owners,
    colour: row.colour,
    insuranceValidUntil: row.insurance_valid_until,
    rcStatus: row.rc_status,
    serviceHistory: row.service_history,
    accidentHistory: row.accident_history,
    loanStatus: row.loan_status,
    location: row.location,
    description: row.description,
    status: row.status,
    acquisitionType: row.acquisition_type,
    submittedBy: row.submitted_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapVo<T, U>(value: T, vehicleId: string, field: string, create: (input: T) => U): U {
  try {
    return create(value);
  } catch (err) {
    throw new DataIntegrityError(`Vehicle ${vehicleId} has an invalid ${field}`, { cause: err });
  }
}
