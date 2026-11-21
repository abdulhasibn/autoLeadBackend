import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IPublicVehicleQueries,
  PublicVehicleCriteria,
  PublicVehicleListing,
  PublicVehicleReadModel,
  PublicVehicleWithPhotos,
} from '../domain/public-vehicle.queries';

// `public_vehicle_list` already limits rows to Listed, live vehicles and
// columns to the public whitelist; never read `vehicles` or `vehicle_list` here.
const COLUMNS =
  'id, make_id, model_id, make_name, model_name, variant_name, body_types, year, fuel_type, transmission, km_driven, num_previous_owners, colour, description, listed_price';

type Row = Omit<
  Database['public']['Views']['public_vehicle_list']['Row'],
  'created_at' | 'public_status' | 'sold_on'
>;

// Photos are embedded so each route is one read plus one signing call, not a
// read per table. PostgREST infers vehicle_media -> public_vehicle_list from
// the view's `v.id`, but the generated types list no relationship for views,
// so the embedded shapes are declared here via `overrideTypes`.
const MEDIA_ORDER = [
  ['sort_order', true],
  ['uploaded_at', true],
] as const;

// Two one-row embeds pick the cover in the database: the first `front` photo,
// else the first photo. Only storage paths travel, never whole galleries.
const LIST_COLUMNS = `${COLUMNS}, front:vehicle_media(storage_path), first:vehicle_media(storage_path)`;
interface CoverEmbeds {
  front: { storage_path: string }[];
  first: { storage_path: string }[];
}

const DETAIL_COLUMNS = `${COLUMNS}, vehicle_media(storage_path, category)`;
interface PhotoEmbed {
  vehicle_media: { storage_path: string; category: string | null }[];
}

// Bounds the filter-options scan; a single dealership is far below it.
const LIST_ALL_LIMIT = 1000;

export class SupabasePublicVehicleQueries implements IPublicVehicleQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(
    criteria: PublicVehicleCriteria,
    page: Pagination,
  ): Promise<Page<PublicVehicleListing>> {
    let query = this.db
      .from('public_vehicle_list')
      .select(LIST_COLUMNS, { count: 'exact' })
      .eq('front.category', 'front')
      .limit(1, { referencedTable: 'front' })
      .limit(1, { referencedTable: 'first' });
    for (const [column, ascending] of MEDIA_ORDER) {
      query = query
        .order(column, { ascending, referencedTable: 'front' })
        .order(column, { ascending, referencedTable: 'first' });
    }

    if (criteria.makeId !== undefined) {
      query = query.eq('make_id', criteria.makeId);
    }
    if (criteria.modelId !== undefined) {
      query = query.eq('model_id', criteria.modelId);
    }
    if (criteria.bodyTypes !== undefined) {
      query = query.overlaps('body_types', [...criteria.bodyTypes]);
    }
    if (criteria.fuelTypes !== undefined) {
      query = query.in('fuel_type', [...criteria.fuelTypes]);
    }
    if (criteria.transmissions !== undefined) {
      query = query.in('transmission', [...criteria.transmissions]);
    }
    if (criteria.priceMin !== undefined) {
      query = query.gte('listed_price', criteria.priceMin);
    }
    if (criteria.priceMax !== undefined) {
      query = query.lte('listed_price', criteria.priceMax);
    }
    if (criteria.yearMin !== undefined) {
      query = query.gte('year', criteria.yearMin);
    }
    if (criteria.kmMax !== undefined) {
      query = query.lte('km_driven', criteria.kmMax);
    }

    switch (criteria.sort) {
      case 'price_asc':
        query = query.order('listed_price', { ascending: true, nullsFirst: false });
        break;
      case 'price_desc':
        query = query.order('listed_price', { ascending: false, nullsFirst: false });
        break;
      case 'km_asc':
        query = query.order('km_driven', { ascending: true });
        break;
      case 'newest':
        break;
    }
    query = query.order('created_at', { ascending: false }).order('id', { ascending: true });

    const { data, error, count } = await query
      .range(page.offset, page.offset + page.limit - 1)
      .overrideTypes<CoverEmbeds[]>();

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list public vehicles: ${error.message}`);
    }

    const items = (data ?? []).flatMap((row) =>
      toReadModel(row).map((vehicle) => ({
        vehicle,
        coverPath: row.front[0]?.storage_path ?? row.first[0]?.storage_path ?? null,
      })),
    );
    return toPage(items, count ?? items.length, page);
  }

  async get(id: string): Promise<PublicVehicleWithPhotos | null> {
    let query = this.db.from('public_vehicle_list').select(DETAIL_COLUMNS).eq('id', id);
    for (const [column, ascending] of MEDIA_ORDER) {
      query = query.order(column, { ascending, referencedTable: 'vehicle_media' });
    }
    const { data, error } = await query.maybeSingle().overrideTypes<PhotoEmbed>();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load public vehicle: ${error.message}`);
    }
    const vehicle = data === null ? undefined : toReadModel(data)[0];
    if (data === null || vehicle === undefined) {
      return null;
    }
    return {
      vehicle,
      photos: data.vehicle_media.map((row) => ({
        storagePath: row.storage_path,
        category: row.category ?? 'other',
      })),
    };
  }

  async listAll(): Promise<readonly PublicVehicleReadModel[]> {
    const { data, error } = await this.db
      .from('public_vehicle_list')
      .select(COLUMNS)
      .limit(LIST_ALL_LIMIT);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list public vehicles: ${error.message}`);
    }
    return (data ?? []).flatMap((row) => toReadModel(row));
  }
}

/** View columns are all nullable in the generated types; drop rows missing a required one. */
function toReadModel(row: Row): PublicVehicleReadModel[] {
  if (
    row.id === null ||
    row.make_id === null ||
    row.model_id === null ||
    row.make_name === null ||
    row.model_name === null ||
    row.variant_name === null ||
    row.year === null ||
    row.fuel_type === null ||
    row.transmission === null ||
    row.km_driven === null
  ) {
    return [];
  }
  return [
    {
      id: row.id,
      makeId: row.make_id,
      modelId: row.model_id,
      make: row.make_name,
      model: row.model_name,
      variant: row.variant_name,
      bodyTypes: row.body_types ?? [],
      year: row.year,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      kmDriven: row.km_driven,
      previousOwners: row.num_previous_owners ?? 0,
      colour: row.colour,
      description: row.description,
      listedPrice: row.listed_price === null ? null : Number(row.listed_price),
    },
  ];
}
