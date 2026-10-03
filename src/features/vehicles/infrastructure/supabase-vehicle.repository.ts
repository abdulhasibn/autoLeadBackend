import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Vehicle } from '../domain/vehicle.entity';
import type { IVehicleRepository } from '../domain/vehicle.repository';
import { translateVehicleWriteError } from './translate-vehicle-write-error';
import { toVehicle, type VehicleRow } from './vehicle.mapper';

const VEHICLE_COLUMNS =
  'id, showroom_id, owner_id, variant_id, year, registration_number, fuel_type, transmission, km_driven, num_previous_owners, colour, insurance_valid_until, rc_status, service_history, accident_history, loan_status, location, description, status, acquisition_type, submitted_by, created_at, updated_at, deleted_at';

export class SupabaseVehicleRepository implements IVehicleRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: VehicleId): Promise<Vehicle | null> {
    const { data, error } = await this.db
      .from('vehicles')
      .select(VEHICLE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toVehicle(data as VehicleRow);
  }

  async isLive(id: VehicleId): Promise<boolean> {
    const vehicle = await this.findById(id);
    return vehicle !== null;
  }

  async save(vehicle: Vehicle): Promise<void> {
    const { error } = await this.db.rpc('save_vehicle', {
      p_id: vehicle.id,
      p_showroom_id: vehicle.showroomId,
      p_owner_id: vehicle.ownerId,
      p_variant_id: vehicle.variantId,
      p_year: vehicle.year.value,
      p_registration_number: vehicle.registrationNumber.value,
      p_fuel_type: vehicle.fuelType.value,
      p_transmission: vehicle.transmission.value,
      p_km_driven: vehicle.kmDriven.value,
      p_num_previous_owners: vehicle.numPreviousOwners.value,
      p_colour: vehicle.colour,
      p_insurance_valid_until:
        vehicle.insuranceValidUntil === null ? null : vehicle.insuranceValidUntil.value,
      p_rc_status: vehicle.rcStatus,
      p_service_history: vehicle.serviceHistory,
      p_accident_history: vehicle.accidentHistory,
      p_loan_status: vehicle.loanStatus,
      p_location: vehicle.location,
      p_description: vehicle.description,
      p_status: vehicle.status.value,
      p_acquisition_type: vehicle.acquisitionType.value,
      p_submitted_by: vehicle.submittedBy,
      p_deleted_at: vehicle.deletedAt === null ? null : vehicle.deletedAt.toISOString(),
      p_actor_id: vehicle.submittedBy,
    });

    if (error !== null) {
      translateVehicleWriteError(error, 'Failed to save vehicle');
    }
  }
}
