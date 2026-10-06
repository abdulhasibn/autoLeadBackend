import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  ICatalogQueries,
  MakeReadModel,
  ModelReadModel,
  VariantReadModel,
} from '../domain/catalog.queries';
import type { MakeId } from '../domain/make-id';
import type { ModelId } from '../domain/model-id';

export class SupabaseCatalogQueries implements ICatalogQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listMakes(page: Pagination): Promise<Page<MakeReadModel>> {
    const { data, error, count } = await this.db
      .from('makes')
      .select('id, name', { count: 'exact' })
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list makes: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({ id: row.id, name: row.name }));
    return toPage(items, count ?? items.length, page);
  }

  async listModels(makeId: MakeId, page: Pagination): Promise<Page<ModelReadModel>> {
    const { data, error, count } = await this.db
      .from('models')
      .select('id, make_id, name', { count: 'exact' })
      .eq('make_id', makeId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list models: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      makeId: row.make_id,
      name: row.name,
    }));
    return toPage(items, count ?? items.length, page);
  }

  async listVariants(modelId: ModelId, page: Pagination): Promise<Page<VariantReadModel>> {
    const { data, error, count } = await this.db
      .from('variants')
      .select('id, model_id, name, fuel_type, transmission, ex_showroom_price', { count: 'exact' })
      .eq('model_id', modelId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list variants: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      modelId: row.model_id,
      name: row.name,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      exShowroomPrice: row.ex_showroom_price,
    }));
    return toPage(items, count ?? items.length, page);
  }
}
