import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import type { Database, Json } from '../../../infrastructure/supabase/database.types';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import type {
  ITestDriveIntake,
  ShowroomLocation,
  TestDriveIntakeInput,
  TestDriveIntakeResult,
} from '../domain/test-drive-intake.port';

// Raised by submit_public_test_drive when a limit is hit.
const RATE_LIMITED_SQLSTATE = 'P0429';

interface IntakeRow {
  readonly leadId: string;
  readonly outcome: 'created' | 'updated';
  readonly vehicleAvailable: boolean;
  readonly linkedVehicleId: string | null;
  readonly showroom: ShowroomLocation | null;
}

export class SupabaseTestDriveIntake implements ITestDriveIntake {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async submit(input: TestDriveIntakeInput): Promise<TestDriveIntakeResult> {
    const { data, error } = await this.db.rpc('submit_public_test_drive', {
      p_vehicle_id: input.vehicleId,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_ip_hash: input.ipHash,
      // Omitted rather than null when absent, so the call matches older DBs too.
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
    });

    if (error !== null) {
      if (error.code === RATE_LIMITED_SQLSTATE) {
        throw new PublicRateLimitedError();
      }
      throw new DatabaseUnavailableError(`Failed to record test-drive request: ${error.message}`);
    }

    const row = data as unknown as IntakeRow;
    return {
      leadId: row.leadId,
      outcome: row.outcome,
      vehicleAvailable: row.vehicleAvailable,
      linkedVehicleId: row.linkedVehicleId === null ? null : toVehicleId(row.linkedVehicleId),
      showroom: row.showroom,
    };
  }
}
