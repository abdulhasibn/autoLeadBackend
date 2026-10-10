import { BodyType, type BodyTypeValue } from '../../../domain/shared/body-type.value-object';
import { FuelType, type FuelTypeValue } from '../../../domain/shared/fuel-type.value-object';
import {
  Transmission,
  type TransmissionValue,
} from '../../../domain/shared/transmission.value-object';
import { PreferredCatalog } from './preferred-catalog.value-object';

export const PREFERRED_YEAR_MIN = 1950;
export const PREFERRED_YEAR_MAX = 2100;
const MAX_COLOURS = 20;
const MAX_COLOUR_LENGTH = 40;

export interface LeadPreferenceProps {
  readonly catalog: PreferredCatalog;
  readonly colours: readonly string[];
  readonly fuelTypes: readonly string[];
  readonly transmissions: readonly string[];
  readonly bodyTypes: readonly string[];
  readonly yearMin: number | null;
  readonly yearMax: number | null;
  readonly kmMax: number | null;
  readonly maxOwners: number | null;
}

/**
 * What a buyer wants, in the same terms a vehicle is recorded in. Every part is
 * optional: an empty list or null means "any". Lists are deduped and colours
 * are lower-cased so they compare with a vehicle's free-text colour.
 */
export class LeadPreference {
  private constructor(
    readonly catalog: PreferredCatalog,
    readonly colours: readonly string[],
    readonly fuelTypes: readonly FuelTypeValue[],
    readonly transmissions: readonly TransmissionValue[],
    readonly bodyTypes: readonly BodyTypeValue[],
    readonly yearMin: number | null,
    readonly yearMax: number | null,
    readonly kmMax: number | null,
    readonly maxOwners: number | null,
  ) {}

  static none(): LeadPreference {
    return new LeadPreference(PreferredCatalog.none(), [], [], [], [], null, null, null, null);
  }

  static create(props: LeadPreferenceProps): LeadPreference {
    const colours = dedupe(props.colours.map(normalizeColour).filter((c) => c.length > 0));
    if (colours.length > MAX_COLOURS) {
      throw new Error(`At most ${MAX_COLOURS} preferred colours are allowed`);
    }
    if (colours.some((c) => c.length > MAX_COLOUR_LENGTH)) {
      throw new Error(`A preferred colour must be at most ${MAX_COLOUR_LENGTH} characters`);
    }
    requireYear('Preferred minimum year', props.yearMin);
    requireYear('Preferred maximum year', props.yearMax);
    if (props.yearMin !== null && props.yearMax !== null && props.yearMin > props.yearMax) {
      throw new Error('Preferred minimum year cannot be after the maximum year');
    }
    requireNonNegativeInteger('Preferred maximum km', props.kmMax);
    requireNonNegativeInteger('Preferred maximum previous owners', props.maxOwners);

    return new LeadPreference(
      props.catalog,
      colours,
      dedupe(props.fuelTypes.map((value) => FuelType.create(value).value)),
      dedupe(props.transmissions.map((value) => Transmission.create(value).value)),
      dedupe(props.bodyTypes.map((value) => BodyType.create(value).value)),
      props.yearMin,
      props.yearMax,
      props.kmMax,
      props.maxOwners,
    );
  }

  get isEmpty(): boolean {
    return (
      this.catalog.isEmpty &&
      this.colours.length === 0 &&
      this.fuelTypes.length === 0 &&
      this.transmissions.length === 0 &&
      this.bodyTypes.length === 0 &&
      this.yearMin === null &&
      this.yearMax === null &&
      this.kmMax === null &&
      this.maxOwners === null
    );
  }

  /** Same catalog choice with the rest of this preference kept. */
  withCatalog(catalog: PreferredCatalog): LeadPreference {
    return new LeadPreference(
      catalog,
      this.colours,
      this.fuelTypes,
      this.transmissions,
      this.bodyTypes,
      this.yearMin,
      this.yearMax,
      this.kmMax,
      this.maxOwners,
    );
  }

  equals(other: LeadPreference): boolean {
    return (
      this.catalog.equals(other.catalog) &&
      sameSet(this.colours, other.colours) &&
      sameSet(this.fuelTypes, other.fuelTypes) &&
      sameSet(this.transmissions, other.transmissions) &&
      sameSet(this.bodyTypes, other.bodyTypes) &&
      this.yearMin === other.yearMin &&
      this.yearMax === other.yearMax &&
      this.kmMax === other.kmMax &&
      this.maxOwners === other.maxOwners
    );
  }
}

export function normalizeColour(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function requireYear(label: string, value: number | null): void {
  if (value === null) {
    return;
  }
  if (!Number.isInteger(value) || value < PREFERRED_YEAR_MIN || value > PREFERRED_YEAR_MAX) {
    throw new Error(
      `${label} must be a whole year between ${PREFERRED_YEAR_MIN} and ${PREFERRED_YEAR_MAX}`,
    );
  }
}

function requireNonNegativeInteger(label: string, value: number | null): void {
  if (value === null) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number`);
  }
}
