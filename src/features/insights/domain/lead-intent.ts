export type LeadIntent = 'high' | 'medium' | 'low';

export interface IntentInput {
  readonly visits: number;
  readonly viewsOfThisCar: number;
  readonly galleryOpens: number;
}

/**
 * How seriously a website lead was shopping before enquiring. Coming back
 * several times or studying the car closely beats a single quick look.
 */
export function leadIntent(input: IntentInput): LeadIntent {
  if (input.visits >= 3 || input.viewsOfThisCar >= 4 || input.galleryOpens >= 3) return 'high';
  if (input.visits >= 2 || input.viewsOfThisCar >= 2 || input.galleryOpens >= 1) return 'medium';
  return 'low';
}
