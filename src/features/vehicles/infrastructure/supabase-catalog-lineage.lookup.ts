import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { ICatalogLineage } from '../domain/catalog-lineage.port';

interface VariantLineageRow {
  readonly model_id: string;
  readonly models: { readonly make_id: string } | null;
}

interface ModelLineageRow {
  readonly make_id: string;
}

export class SupabaseCatalogLineageLookup implements ICatalogLineage {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async variantLineage(
    variantId: string,
  ): Promise<{ readonly makeId: string; readonly modelId: string } | null> {
    // `!inner` plus the embedded deleted_at filters drop the row when any
    // parent is soft-deleted.
    const { data, error } = await this.db
      .from('variants')
      .select('model_id, models!inner ( make_id, makes!inner ( id ) )')
      .eq('id', variantId)
      .is('deleted_at', null)
      .is('models.deleted_at', null)
      .is('models.makes.deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load variant lineage: ${error.message}`);
    }
    const row = data as unknown as VariantLineageRow | null;
    if (row === null || row.models === null) {
      return null;
    }
    return { makeId: row.models.make_id, modelId: row.model_id };
  }

  async modelLineage(modelId: string): Promise<{ readonly makeId: string } | null> {
    const { data, error } = await this.db
      .from('models')
      .select('make_id, makes!inner ( id )')
      .eq('id', modelId)
      .is('deleted_at', null)
      .is('makes.deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load model lineage: ${error.message}`);
    }
    const row = data as unknown as ModelLineageRow | null;
    return row === null ? null : { makeId: row.make_id };
  }

  async isLiveMake(makeId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('makes')
      .select('id')
      .eq('id', makeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load make: ${error.message}`);
    }
    return data !== null;
  }
}
