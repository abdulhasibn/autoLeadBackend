import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { ILiveVariantLookup } from '../domain/live-variant.port';
import type { VariantId } from '../domain/variant-id';

export class SupabaseLiveVariantLookup implements ILiveVariantLookup {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async isLive(variantId: VariantId): Promise<boolean> {
    const { data, error } = await this.db
      .from('variants')
      .select('id')
      .eq('id', variantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load variant: ${error.message}`);
    }

    return data !== null;
  }
}
