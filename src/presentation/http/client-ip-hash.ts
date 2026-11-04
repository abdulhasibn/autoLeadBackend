import { createHmac } from 'node:crypto';

import type { Request } from 'express';

/**
 * Keyed hash of the caller's IP, so stored rate-limit and analytics keys
 * cannot be reversed to an address.
 */
export function hashClientIp(req: Request, key: string): string {
  return createHmac('sha256', key)
    .update(req.ip ?? 'unknown')
    .digest('hex');
}
