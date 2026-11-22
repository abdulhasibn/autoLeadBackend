import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database, Json } from '../../../infrastructure/supabase/database.types';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import type {
  IPreferenceIntake,
  PreferenceIntakeInput,
  PreferenceIntakeResult,
} from '../domain/preference-intake.port';
import type { ShowroomLocation } from '../domain/test-drive-intake.port';

// Raised by submit_public_preference_lead when a limit is hit.
const RATE_LIMITED_SQLSTATE = 'P0429';

interface IntakeRow {
  readonly leadId: string;
  readonly outcome: 'created' | 'updated';
  readonly showroom: ShowroomLocation | null;
}

export class SupabasePreferenceIntake implements IPreferenceIntake {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async submit(input: PreferenceIntakeInput): Promise<PreferenceIntakeResult> {
    const { data, error } = await this.db.rpc('submit_public_preference_lead', {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_ip_hash: input.ipHash,
      // Optional arguments are omitted rather than null, so the SQL defaults apply.
      ...(input.attribution === null
        ? {}
        : {
            p_attribution: {
              visitorId: input.attribution.visitorId,
              sessionId: input.attribution.sessionId,
              firstTouch: { ...input.attribution.firstTouch },
              lastTouch: { ...input.attribution.lastTouch },
            } satisfies Json,
          }),
      ...(input.budgetMax === null ? {} : { p_budget_max: input.budgetMax }),
      ...(input.bodyTypes.length === 0 ? {} : { p_body_types: [...input.bodyTypes] }),
      ...(input.fuelTypes.length === 0 ? {} : { p_fuel_types: [...input.fuelTypes] }),
      ...(input.transmissions.length === 0 ? {} : { p_transmissions: [...input.transmissions] }),
      ...(input.make === null ? {} : { p_make: input.make }),
      ...(input.model === null ? {} : { p_model: input.model }),
      ...(input.makeId === null ? {} : { p_make_id: input.makeId }),
      ...(input.modelId === null ? {} : { p_model_id: input.modelId }),
      ...(input.variantId === null ? {} : { p_variant_id: input.variantId }),
      ...(input.referenceVehicleId === null
        ? {}
        : { p_reference_vehicle_id: input.referenceVehicleId }),
    });

    if (error !== null) {
      if (error.code === RATE_LIMITED_SQLSTATE) {
        throw new PublicRateLimitedError();
      }
      throw new DatabaseUnavailableError(`Failed to record preference request: ${error.message}`);
    }

    const row = data as unknown as IntakeRow;
    return { leadId: row.leadId, outcome: row.outcome, showroom: row.showroom };
  }
}
