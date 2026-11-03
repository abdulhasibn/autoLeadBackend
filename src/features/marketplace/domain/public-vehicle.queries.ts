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

export interface IPublicVehicleQueries {
  list(criteria: PublicVehicleCriteria, page: Pagination): Promise<Page<PublicVehicleReadModel>>;
  get(id: string): Promise<PublicVehicleReadModel | null>;
  /** Every Listed vehicle, unpaginated: the source of the filter options. */
  listAll(): Promise<readonly PublicVehicleReadModel[]>;
  /** Cover photo per vehicle: the first `front` photo, else the first photo. */
  coverPaths(vehicleIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  photos(vehicleId: string): Promise<readonly PublicVehiclePhoto[]>;
}
