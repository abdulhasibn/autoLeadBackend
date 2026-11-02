import type { PublicVehicleReadModel } from '../../domain/public-vehicle.queries';

export interface PublicVehicleSummaryDto {
  readonly id: string;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly bodyType: string | null;
  readonly year: number;
  readonly fuelType: string;
  readonly transmission: string;
  readonly kmDriven: number;
  readonly previousOwners: number;
  readonly colour: string | null;
  readonly listedPrice: number | null;
  readonly coverImageUrl: string | null;
}

export interface PublicVehiclePhotoDto {
  readonly url: string;
  readonly category: string;
}

export interface PublicVehicleDetailDto extends PublicVehicleSummaryDto {
  readonly description: string | null;
  readonly photos: readonly PublicVehiclePhotoDto[];
}

export interface PublicFilterOptionsDto {
  readonly makes: readonly {
    readonly id: string;
    readonly name: string;
    readonly models: readonly { readonly id: string; readonly name: string }[];
  }[];
  readonly bodyTypes: readonly string[];
  readonly fuelTypes: readonly string[];
  readonly transmissions: readonly string[];
  readonly priceRange: { readonly min: number; readonly max: number } | null;
  readonly yearRange: { readonly min: number; readonly max: number } | null;
}

/**
 * Builds the summary field by field, so a column added to the read model never
 * reaches a visitor by accident.
 */
export function toPublicVehicleSummary(
  vehicle: PublicVehicleReadModel,
  coverImageUrl: string | null,
): PublicVehicleSummaryDto {
  return {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant,
    bodyType: vehicle.bodyTypes[0] ?? null,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    kmDriven: vehicle.kmDriven,
    previousOwners: vehicle.previousOwners,
    colour: vehicle.colour,
    listedPrice: vehicle.listedPrice,
    coverImageUrl,
  };
}
