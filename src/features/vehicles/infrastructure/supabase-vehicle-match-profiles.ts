import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { BodyType } from '../../../domain/shared/body-type.value-object';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  IVehicleMatchProfiles,
  VehicleMatchProfile,
} from '../domain/vehicle-match-profile.queries';

const MATCH_PROFILE_COLUMNS = [
  'id, showroom_id, status, variant_id, year, registration_number, km_driven, colour',
  'fuel_type, transmission, num_previous_owners',
  'variants ( name, body_type, models ( id, name, makes ( id, name ) ) )',
  'vehicle_financials ( listed_price )',
].join(', ');

interface FinancialsEmbed {
  readonly listed_price: number | null;
}

interface MatchProfileRow {
  readonly id: string;
  readonly showroom_id: string;
  readonly status: string;
  readonly variant_id: string;
  readonly year: number;
  readonly registration_number: string;
  readonly km_driven: number;
  readonly colour: string;
  readonly fuel_type: string;
  readonly transmission: string;
  readonly num_previous_owners: number;
  readonly variants: {
    readonly name: string;
    readonly body_type: string | null;
    readonly models: {
      readonly id: string;
      readonly name: string;
      readonly makes: { readonly id: string; readonly name: string } | null;
    } | null;
  } | null;
  // One-to-one embeds come back as an object; tolerate a list too.
  readonly vehicle_financials: FinancialsEmbed | FinancialsEmbed[] | null;
}

export class SupabaseVehicleMatchProfiles implements IVehicleMatchProfiles {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findForMatching(vehicleId: VehicleId): Promise<VehicleMatchProfile | null> {
    const { data, error } = await this.db
      .from('vehicles')
      .select(MATCH_PROFILE_COLUMNS)
      .eq('id', vehicleId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle for matching: ${error.message}`);
    }
    if (data === null) {
      return null;
    }
    return toMatchProfile(data as unknown as MatchProfileRow);
  }
}

function toMatchProfile(row: MatchProfileRow): VehicleMatchProfile {
  const model = row.variants?.models ?? null;
  const financials = Array.isArray(row.vehicle_financials)
    ? (row.vehicle_financials[0] ?? null)
    : row.vehicle_financials;
  const listedPrice = financials?.listed_price ?? null;

  return {
    id: toVehicleId(row.id),
    showroomId: row.showroom_id,
    status: row.status,
    makeId: model?.makes?.id ?? null,
    makeName: model?.makes?.name ?? null,
    modelId: model?.id ?? null,
    modelName: model?.name ?? null,
    variantId: row.variant_id,
    variantName: row.variants?.name ?? null,
    year: row.year,
    registrationNumber: row.registration_number,
    kmDriven: row.km_driven,
    colour: row.colour,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    bodyTypes: BodyType.parseCatalogList(row.variants?.body_type ?? null),
    numPreviousOwners: row.num_previous_owners,
    // numeric columns can arrive as strings
    listedPrice: listedPrice === null ? null : Number(listedPrice),
  };
}
