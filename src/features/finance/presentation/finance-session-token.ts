import type { Request } from 'express';

export const FINANCE_SESSION_HEADER = 'x-finance-session';

/** The finance session token sent with the request, or null when absent. */
export function readFinanceSessionToken(req: Pick<Request, 'header'>): string | null {
  const token = req.header(FINANCE_SESSION_HEADER)?.trim();
  return token === undefined || token.length === 0 ? null : token;
}
