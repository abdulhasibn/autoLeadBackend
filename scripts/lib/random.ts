/**
 * Seeded PRNG (mulberry32) plus the sampling helpers the seed scripts share.
 * A fixed seed makes runs produce similar-looking data; every helper draws
 * from the same stream, so call order matters for reproducibility.
 */
export interface Random {
  /** Uniform in [0, 1). */
  rand(): number;
  chance(p: number): boolean;
  /** A random element; throws on an empty list. */
  pick<T>(list: readonly T[]): T;
  /** A random element, or undefined for an empty list. */
  maybePick<T>(list: readonly T[]): T | undefined;
  /** Integer in [min, max]. */
  between(min: number, max: number): number;
  /** Picks a value with probability proportional to its weight. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** Up to `count` distinct elements, in random order. */
  sample<T>(list: readonly T[], count: number): T[];
}

export function createRandom(initialSeed: number): Random {
  let seed = initialSeed;

  function rand(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function maybePick<T>(list: readonly T[]): T | undefined {
    return list[Math.floor(rand() * list.length)];
  }

  function pick<T>(list: readonly T[]): T {
    const item = maybePick(list);
    if (item === undefined) {
      throw new Error('pick from an empty list');
    }
    return item;
  }

  function weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const last = entries[entries.length - 1];
    if (last === undefined) {
      throw new Error('weighted pick from an empty list');
    }
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = rand() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r < 0) return value;
    }
    return last[0];
  }

  function sample<T>(list: readonly T[], count: number): T[] {
    const copy = [...list];
    const out: T[] = [];
    while (out.length < count && copy.length > 0) {
      out.push(...copy.splice(Math.floor(rand() * copy.length), 1));
    }
    return out;
  }

  return {
    rand,
    chance: (p) => rand() < p,
    pick,
    maybePick,
    between: (min, max) => min + Math.floor(rand() * (max - min + 1)),
    weighted,
    sample,
  };
}

export const roundTo = (value: number, step: number): number => Math.round(value / step) * step;
