import type { Page, Pagination } from '../../../shared/pagination/pagination';

/**
 * A Listed vehicle as an anonymous visitor may see it (ADR-0010). Read from
 * `public_vehicle_list`, which carries only these columns: no plate, owner,
 * documents, RC or loan state, and no price other than the listed one.
 */
export interface PublicVehicleReadModel {
  readonly id: string;
  readonly makeId: string;
  readonly modelId: string;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly bodyTypes: readonly string[];
  readonly year: number;
  readonly fuelType: string;
  readonly transmission: string;
  readonly kmDriven: number;
  readonly previousOwners: number;
  readonly colour: string | null;
  readonly description: string | null;
  readonly listedPrice: number | null;
  /** `sold` for a car sold within the public window (90 days); it stays visible, not bookable. */
  readonly status: 'available' | 'sold';
  /** ISO date (`YYYY-MM-DD`); set only when `status` is `sold`. */
  readonly soldOn: string | null;
}

export type PublicVehicleSort = 'newest' | 'price_asc' | 'price_desc' | 'km_asc';

export interface PublicVehicleCriteria {
  readonly makeId?: string;
  readonly modelId?: string;
  readonly bodyTypes?: readonly string[];
  readonly fuelTypes?: readonly string[];
  readonly transmissions?: readonly string[];
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly yearMin?: number;
  readonly kmMax?: number;
  readonly sort: PublicVehicleSort;
}

export interface PublicVehiclePhoto {
  readonly storagePath: string;
  readonly category: string;
}

/** A Listed vehicle with its cover photo: the first `front` photo, else the first photo. */
export interface PublicVehicleListing {
  readonly vehicle: PublicVehicleReadModel;
  readonly coverPath: string | null;
}

/** A Listed vehicle with every photo, in display order. */
export interface PublicVehicleWithPhotos {
  readonly vehicle: PublicVehicleReadModel;
  readonly photos: readonly PublicVehiclePhoto[];
}

/**
 * Photos come back with their vehicle in one read: each Supabase call is a
 * network round trip, and these routes sit on the website's critical path.
 */
export interface IPublicVehicleQueries {
  list(criteria: PublicVehicleCriteria, page: Pagination): Promise<Page<PublicVehicleListing>>;
  get(id: string): Promise<PublicVehicleWithPhotos | null>;
  /** Every available vehicle (sold ones excluded), unpaginated: the source of the filter options. */
  listAll(): Promise<readonly PublicVehicleReadModel[]>;
}
