import type { Response } from 'express';

/** Insights are aggregates over minutes-old data: a short private cache is safe. */
export function sendInsights(res: Response, body: unknown): void {
  res.set('Cache-Control', 'private, max-age=60');
  res.status(200).json(body);
}
