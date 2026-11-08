/**
 * What a car's website demand says about pricing and promotion. A car is
 * judged against the rest of live stock over the same period, so the rules
 * hold whether the site gets 50 or 5,000 visits a month.
 */

export const SIGNAL_CODES = [
  'hot',
  'seen_not_enquired',
  'low_visibility',
  'ageing_cooling',
  'insufficient_data',
  'normal',
] as const;

export type SignalCode = (typeof SIGNAL_CODES)[number];

export interface VehicleSignal {
  readonly code: SignalCode;
  readonly reason: string;
}

/** Fewer views than this and a car's rates are noise. */
export const MIN_VIEWS_FOR_SIGNAL = 30;
/** Matches the dashboard's aged-stock threshold. */
export const AGEING_DAYS = 45;
/** Lead rate at least this multiple of the stock median is hot. */
export const HOT_RATE_FACTOR = 1.5;
/** Lead rate at most this fraction of the stock median is seen-not-enquired. */
export const COLD_RATE_FACTOR = 0.5;
/** Views below this fraction of the stock median are a reach problem. */
export const LOW_VIEWS_FACTOR = 0.5;

const REASONS: Readonly<Record<SignalCode, string>> = {
  hot: 'Strong demand. Hold firm, small or no discount.',
  seen_not_enquired: 'Price may look high, or the photos may be weak.',
  low_visibility: 'Reach problem, not price. Feature it in an ad.',
  ageing_cooling: 'Negotiate flexibly or review the price.',
  insufficient_data: `Fewer than ${MIN_VIEWS_FOR_SIGNAL} views so far. Check back later.`,
  normal: 'Demand in line with similar stock.',
};

export interface SignalInput {
  readonly views: number;
  readonly leadRate: number | null;
  readonly daysInStock: number;
}

/** Medians over the cars that have enough views to be judged. */
export interface StockBaseline {
  readonly medianViews: number;
  readonly medianLeadRate: number;
}

export function stockBaseline(cars: readonly SignalInput[]): StockBaseline {
  const judged = cars.filter((car) => car.views >= MIN_VIEWS_FOR_SIGNAL);
  return {
    medianViews: median(judged.map((car) => car.views)),
    medianLeadRate: median(judged.map((car) => car.leadRate ?? 0)),
  };
}

/**
 * First matching rule wins: too few views → insufficient data; a lead rate
 * well above the stock median with at least median views → hot; listed past
 * the ageing threshold → ageing; far fewer views than the median → low
 * visibility; median views but a lead rate well below the median → seen, not
 * enquired; otherwise normal.
 */
export function vehicleSignal(car: SignalInput, baseline: StockBaseline): VehicleSignal {
  const rate = car.leadRate ?? 0;
  const code = ((): SignalCode => {
    if (car.views < MIN_VIEWS_FOR_SIGNAL) return 'insufficient_data';
    const wellViewed = car.views >= baseline.medianViews;
    if (
      wellViewed &&
      baseline.medianLeadRate > 0 &&
      rate >= baseline.medianLeadRate * HOT_RATE_FACTOR
    ) {
      return 'hot';
    }
    if (car.daysInStock >= AGEING_DAYS) return 'ageing_cooling';
    if (car.views < baseline.medianViews * LOW_VIEWS_FACTOR) return 'low_visibility';
    if (wellViewed && rate <= baseline.medianLeadRate * COLD_RATE_FACTOR)
      return 'seen_not_enquired';
    return 'normal';
  })();
  return { code, reason: REASONS[code] };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
