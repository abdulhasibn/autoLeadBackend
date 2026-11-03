import type { IPublicVehicleQueries } from '../../domain/public-vehicle.queries';
import type { PublicFilterOptionsDto } from '../dtos/public-vehicle.dto';

/** Filter choices drawn from what is actually in stock, so no filter is a dead end. */
export class GetPublicFilterOptionsUseCase {
  constructor(private readonly queries: IPublicVehicleQueries) {}

  async execute(): Promise<PublicFilterOptionsDto> {
    const vehicles = await this.queries.listAll();

    const makes = new Map<string, { name: string; models: Map<string, string> }>();
    for (const vehicle of vehicles) {
      const make = makes.get(vehicle.makeId) ?? { name: vehicle.make, models: new Map() };
      make.models.set(vehicle.modelId, vehicle.model);
      makes.set(vehicle.makeId, make);
    }

    const prices = vehicles.flatMap((v) => (v.listedPrice === null ? [] : [v.listedPrice]));
    const years = vehicles.map((v) => v.year);

    return {
      makes: [...makes.entries()]
        .map(([id, make]) => ({
          id,
          name: make.name,
          models: [...make.models.entries()]
            .map(([modelId, name]) => ({ id: modelId, name }))
            .sort(byName),
        }))
        .sort(byName),
      bodyTypes: distinct(vehicles.flatMap((v) => v.bodyTypes)),
      fuelTypes: distinct(vehicles.map((v) => v.fuelType)),
      transmissions: distinct(vehicles.map((v) => v.transmission)),
      priceRange: range(prices),
      yearRange: range(years),
    };
  }
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))].sort();
}

function range(values: readonly number[]): { min: number; max: number } | null {
  return values.length === 0 ? null : { min: Math.min(...values), max: Math.max(...values) };
}
