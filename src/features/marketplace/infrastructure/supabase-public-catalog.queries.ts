import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  IPublicCatalogQueries,
  PublicMakeReadModel,
  PublicModelReadModel,
  PublicVariantReadModel,
} from '../domain/public-catalog.queries';

// A dealership catalog is far below this; it only bounds a runaway read.
const LIMIT = 1000;

export class SupabasePublicCatalogQueries implements IPublicCatalogQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listMakes(): Promise<readonly PublicMakeReadModel[]> {
    const { data, error } = await this.db
      .from('makes')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .limit(LIMIT);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list makes: ${error.message}`);
    }
    return data;
  }

  async listModels(makeId: string): Promise<readonly PublicModelReadModel[]> {
    const { data, error } = await this.db
      .from('models')
      .select('id, name')
      .eq('make_id', makeId)
      .is('deleted_at', null)
      .order('name')
      .limit(LIMIT);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list models: ${error.message}`);
    }
    return data;
  }

  async listVariants(modelId: string): Promise<readonly PublicVariantReadModel[]> {
    const { data, error } = await this.db
      .from('variants')
      .select('id, name, fuel_type, transmission')
      .eq('model_id', modelId)
      .is('deleted_at', null)
      .order('name')
      .limit(LIMIT);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list variants: ${error.message}`);
    }
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      fuelType: row.fuel_type,
      transmission: row.transmission,
    }));
  }
}
