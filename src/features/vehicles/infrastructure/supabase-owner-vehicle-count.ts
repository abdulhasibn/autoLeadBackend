import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { OwnerId } from '../../../domain/shared/owner-id';
import type { Database } from '../../../infrastructure/supabase/database.types';

/** Counts an owner's live cars that aren't sold, for the owners feature. */
export class SupabaseOwnerVehicleCount {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async countUnsold(ownerId: OwnerId): Promise<number> {
    const { count, error } = await this.db
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .neq('status', 'sold')
      .is('deleted_at', null);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count owner vehicles: ${error.message}`);
    }
    return count ?? 0;
  }
}
