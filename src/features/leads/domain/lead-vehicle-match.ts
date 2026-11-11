import type { BodyTypeValue } from '../../../domain/shared/body-type.value-object';
import { normalizeColour } from './lead-preference.value-object';

/** What a lead wants, as plain values (a LeadPreference plus the budget). */
export interface MatchPreference {
  readonly makeId: string | null;
  readonly modelId: string | null;
  readonly variantId: string | null;
  /** Price ceiling. */
  readonly budget: number | null;
  readonly colours: readonly string[];
  readonly fuelTypes: readonly string[];
  readonly transmissions: readonly string[];
  readonly bodyTypes: readonly string[];
  readonly yearMin: number | null;
  readonly kmMax: number | null;
  readonly maxOwners: number | null;
}

/** What a vehicle offers, as plain values. */
export interface MatchVehicle {
  readonly makeId: string | null;
  readonly modelId: string | null;
  readonly variantId: string;
  readonly listedPrice: number | null;
  readonly colour: string;
  readonly fuelType: string;
  readonly transmission: string;
  readonly bodyTypes: readonly BodyTypeValue[];
  readonly year: number;
  readonly kmDriven: number;
  readonly numPreviousOwners: number;
}

export type MatchCriterion =
  | 'catalog'
  | 'budget'
  | 'year'
  | 'km'
  | 'fuelType'
  | 'transmission'
  | 'bodyType'
  | 'previousOwners'
  | 'colour';

export type MatchOutcome = 'match' | 'partial' | 'miss' | 'unknown';

export interface MatchCriterionResult {
  readonly criterion: MatchCriterion;
  readonly weight: number;
  /** Points earned out of `weight`; 0 for `unknown` (which is left out of the score). */
  readonly earned: number;
  readonly outcome: MatchOutcome;
}

export interface LeadMatch {
  /** 0–100 over the criteria that could be evaluated. */
  readonly score: number;
  readonly evaluatedCriteria: number;
  readonly breakdown: readonly MatchCriterionResult[];
}

/** How much each criterion counts. Weights sum to 100. */
export const MATCH_WEIGHTS: Readonly<Record<MatchCriterion, number>> = {
  catalog: 30,
  budget: 25,
  year: 10,
  km: 10,
  fuelType: 7,
  transmission: 7,
  bodyType: 4,
  previousOwners: 4,
  colour: 3,
};

/** Over budget by this share of the budget earns nothing. */
const BUDGET_TOLERANCE = 0.15;
/** Over the km ceiling by this share of it earns nothing. */
const KM_TOLERANCE = 0.25;
/** This many years outside the window earns nothing. */
const YEAR_TOLERANCE = 3;

/**
 * Scores how well a vehicle fits what a lead asked for. Criteria the lead left
 * blank are skipped; so is budget when the vehicle has no price yet. Near
 * misses (a little over budget, a year outside the window) earn partial credit.
 * Returns null when there was nothing to compare.
 */
export function scoreLeadAgainstVehicle(
  preference: MatchPreference,
  vehicle: MatchVehicle,
): LeadMatch | null {
  const results: MatchCriterionResult[] = [];
  const add = (criterion: MatchCriterion, fraction: number | 'unknown'): void => {
    const weight = MATCH_WEIGHTS[criterion];
    if (fraction === 'unknown') {
      results.push({ criterion, weight, earned: 0, outcome: 'unknown' });
      return;
    }
    const clamped = Math.min(1, Math.max(0, fraction));
    results.push({
      criterion,
      weight,
      earned: round2(weight * clamped),
      outcome: clamped >= 1 ? 'match' : clamped <= 0 ? 'miss' : 'partial',
    });
  };

  if (preference.makeId !== null) {
    add('catalog', catalogFraction(preference, vehicle));
  }
  if (preference.budget !== null) {
    add(
      'budget',
      vehicle.listedPrice === null
        ? 'unknown'
        : budgetFraction(preference.budget, vehicle.listedPrice),
    );
  }
  if (preference.yearMin !== null) {
    add('year', yearFraction(preference.yearMin, vehicle.year));
  }
  if (preference.kmMax !== null) {
    add('km', kmFraction(preference.kmMax, vehicle.kmDriven));
  }
  if (preference.fuelTypes.length > 0) {
    add('fuelType', preference.fuelTypes.includes(vehicle.fuelType) ? 1 : 0);
  }
  if (preference.transmissions.length > 0) {
    add('transmission', preference.transmissions.includes(vehicle.transmission) ? 1 : 0);
  }
  if (preference.bodyTypes.length > 0) {
    add(
      'bodyType',
      vehicle.bodyTypes.length === 0
        ? 'unknown'
        : vehicle.bodyTypes.some((type) => preference.bodyTypes.includes(type))
          ? 1
          : 0,
    );
  }
  if (preference.maxOwners !== null) {
    add('previousOwners', ownersFraction(preference.maxOwners, vehicle.numPreviousOwners));
  }
  if (preference.colours.length > 0) {
    add('colour', colourMatches(preference.colours, vehicle.colour) ? 1 : 0);
  }

  const evaluated = results.filter((result) => result.outcome !== 'unknown');
  if (evaluated.length === 0) {
    return null;
  }
  const possible = evaluated.reduce((sum, result) => sum + result.weight, 0);
  const earned = evaluated.reduce((sum, result) => sum + result.earned, 0);

  return {
    score: Math.round((100 * earned) / possible),
    evaluatedCriteria: evaluated.length,
    breakdown: results,
  };
}

/** A suggestion must rest on at least this many criteria, so one lucky colour is not a 100% fit. */
export const MIN_SUGGESTION_CRITERIA = 2;

/**
 * Whether a match is strong enough to suggest. It must reach the score floor
 * and rest on two criteria, except that getting exactly the car the lead asked
 * for (make, model or variant) is enough on its own: a lead that only says
 * "Ignis" must still see the Ignis that arrives later.
 */
export function isSuggestibleMatch(match: LeadMatch | null, minScore: number): boolean {
  if (match === null || match.score < minScore) return false;
  if (match.evaluatedCriteria >= MIN_SUGGESTION_CRITERIA) return true;
  return match.breakdown.some(
    (result) => result.criterion === 'catalog' && result.outcome === 'match',
  );
}

function catalogFraction(preference: MatchPreference, vehicle: MatchVehicle): number {
  const sameMake = vehicle.makeId !== null && vehicle.makeId === preference.makeId;
  const sameModel = vehicle.modelId !== null && vehicle.modelId === preference.modelId;

  if (preference.variantId !== null) {
    if (vehicle.variantId === preference.variantId) return 1;
    if (sameModel) return 20 / 30;
    return sameMake ? 8 / 30 : 0;
  }
  if (preference.modelId !== null) {
    if (sameModel) return 1;
    return sameMake ? 10 / 30 : 0;
  }
  return sameMake ? 1 : 0;
}

function budgetFraction(budget: number, price: number): number {
  if (price <= budget) return 1;
  if (budget <= 0) return 0;
  const over = (price - budget) / budget;
  return 1 - over / BUDGET_TOLERANCE;
}

function yearFraction(min: number, year: number): number {
  const below = year < min ? min - year : 0;
  return 1 - below / YEAR_TOLERANCE;
}

function kmFraction(kmMax: number, kmDriven: number): number {
  if (kmDriven <= kmMax) return 1;
  if (kmMax <= 0) return 0;
  const over = (kmDriven - kmMax) / kmMax;
  return 1 - over / KM_TOLERANCE;
}

function ownersFraction(maxOwners: number, owners: number): number {
  if (owners <= maxOwners) return 1;
  return owners === maxOwners + 1 ? 0.5 : 0;
}

/** "Pearl White" matches a preferred "white"; vehicles record colour as free text. */
function colourMatches(preferred: readonly string[], vehicleColour: string): boolean {
  const padded = ` ${normalizeColour(vehicleColour)} `;
  return preferred.some((wanted) => padded.includes(` ${wanted} `));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
