/** `part / whole` rounded to 4 places (fractions, like the dashboard); null for an empty whole. */
export function rate(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 10_000) / 10_000;
}
