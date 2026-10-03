import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IActiveShowroomLookup } from '../domain/active-showroom.port';
import type { ShowroomId } from '../../../domain/shared/showroom-id';

export class SupabaseActiveShowroomLookup implements IActiveShowroomLookup {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async isActive(showroomId: ShowroomId): Promise<boolean> {
    const { data, error } = await this.db
      .from('showrooms')
      .select('id')
      .eq('id', showroomId)
      .eq('is_active', true)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load showroom: ${error.message}`);
    }

    return data !== null;
  }
}
