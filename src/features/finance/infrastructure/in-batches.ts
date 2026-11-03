/** PostgREST puts `in (…)` filters in the URL; keep id lists short enough for it. */
export const MAX_IDS_PER_REQUEST = 100;

export function inBatches<T>(items: readonly T[], size = MAX_IDS_PER_REQUEST): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
