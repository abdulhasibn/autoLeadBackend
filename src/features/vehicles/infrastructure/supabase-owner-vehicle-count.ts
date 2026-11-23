import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { OwnerId } from '../../../domain/shared/owner-id';
import type { Database } from '../../../infrastructure/supabase/database.types';

/** Counts an owner's cars still open or linked to a lead (dropped and sold ones don't count). */
export class SupabaseOwnerVehicleCount {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async countOpenOrLinked(ownerId: OwnerId): Promise<number> {
    const { count, error } = await this.db
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .in('status', ['open', 'linked'])
      .is('deleted_at', null);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count owner vehicles: ${error.message}`);
    }
    return count ?? 0;
  }
}
