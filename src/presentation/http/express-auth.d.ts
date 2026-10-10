import type { AuthenticatedContext } from '../../domain/shared/auth-context';

/**
 * Extend Express Request with the authenticated context injected by the
 * bearer middleware. The field is optional so unauthenticated routes compile
 * without a guard; protected routes should call `requireAuth` to narrow the type.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
      /** The raw bearer token behind `auth`; set by the bearer middleware. */
      accessToken?: string;
    }
  }
}

export {};
