import { BodyType } from '../../../domain/shared/body-type.value-object';
import type { ValueCount, ZeroResultSearch } from './insights.queries';

export const BUDGET_BANDS = ['<4L', '4-6L', '6-8L', '8-12L', '12L+'] as const;

export type BudgetBand = (typeof BUDGET_BANDS)[number];

const LAKH = 100_000;

/** Inclusive upper bound of each band in rupees; "under ₹6L" is a 4–6L search. */
const BAND_CEILINGS: readonly [BudgetBand, number][] = [
  ['<4L', 4 * LAKH],
  ['4-6L', 6 * LAKH],
  ['6-8L', 8 * LAKH],
  ['8-12L', 12 * LAKH],
];

export function budgetBandOf(price: number): BudgetBand {
  for (const [band, ceiling] of BAND_CEILINGS) {
    if (price <= ceiling) return band;
  }
  return '12L+';
}

/** Body types grouped the way a dealer talks about stock. */
const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  crossover: 'Crossover',
  muv: 'MUV / MPV',
  mpv: 'MUV / MPV',
  coupe: 'Coupe',
  convertible: 'Convertible',
  sports: 'Sports',
  'pick-up': 'Pick-up',
};

export const UNKNOWN_SEGMENT = 'Other';

/**
 * Segment label of a catalog body type cell. A cell listing two types
 * ("crossover, suv") counts as SUV when SUV is one of them, else the first.
 */
export function segmentOf(bodyType: string | null): string {
  const types = BodyType.parseCatalogList(bodyType);
  const type = types.includes('suv') ? 'suv' : types[0];
  return type === undefined ? UNKNOWN_SEGMENT : (SEGMENT_LABELS[type] ?? UNKNOWN_SEGMENT);
}

/** Demand and stock shares further apart than this many points are a gap. */
export const SEGMENT_GAP_POINTS = 10;

/**
 * Whole percentages that add up to 100 (largest remainder), keyed like
 * `counts`. All zeros when nothing was counted.
 */
export function wholePercentages<K>(counts: ReadonlyMap<K, number>): Map<K, number> {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const result = new Map<K, number>();
  if (total === 0) {
    for (const key of counts.keys()) result.set(key, 0);
    return result;
  }
  const exact = [...counts].map(([key, n]) => ({ key, exact: (n / total) * 100 }));
  for (const { key, exact: value } of exact) result.set(key, Math.floor(value));
  let left = 100 - [...result.values()].reduce((sum, n) => sum + n, 0);
  const byRemainder = [...exact].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
  );
  for (const { key } of byRemainder) {
    if (left <= 0) break;
    result.set(key, (result.get(key) ?? 0) + 1);
    left -= 1;
  }
  return result;
}

/** Sums counts by a derived key, preserving first-seen order. */
export function groupCounts<T, K>(
  rows: readonly ValueCount<T>[],
  keyOf: (value: T) => K,
): Map<K, number> {
  const grouped = new Map<K, number>();
  for (const row of rows) {
    const key = keyOf(row.value);
    grouped.set(key, (grouped.get(key) ?? 0) + row.count);
  }
  return grouped;
}

/** Share (0–100, whole) of budget searches capped below `price`; null without searches. */
export function shareOfSearchesBelow(
  searchPrices: readonly ValueCount<number>[],
  price: number | null,
): number | null {
  if (price === null) return null;
  const total = searchPrices.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  const below = searchPrices.filter((row) => row.value < price).reduce((s, r) => s + r.count, 0);
  return Math.round((below / total) * 100);
}

/** "₹6L", "₹6.5L" — budgets are written in lakh. */
export function lakhLabel(price: number): string {
  const lakh = Math.round((price / LAKH) * 10) / 10;
  return `₹${Number.isInteger(lakh) ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * A readable name for a search the site had no car for, e.g.
 * "Diesel Brezza", "Automatic under ₹6L", "Creta under ₹10L".
 */
export function zeroResultLabel(search: ZeroResultSearch): string {
  const subject =
    search.model ?? search.make ?? (search.bodyType === null ? null : segmentOf(search.bodyType));
  const words = [
    search.fuelType === null ? null : capitalise(search.fuelType),
    search.transmission === null ? null : capitalise(search.transmission),
    subject === UNKNOWN_SEGMENT ? null : subject,
  ].filter((word): word is string => word !== null && word !== '');
  const budget = search.priceMax === null ? null : `under ${lakhLabel(search.priceMax)}`;
  if (words.length === 0) {
    return budget === null ? 'Any car' : `Any car ${budget}`;
  }
  return budget === null ? words.join(' ') : `${words.join(' ')} ${budget}`;
}
