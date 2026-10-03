import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import { AuthenticateActorUseCase } from './application/use-cases/authenticate-actor.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import {
  InvalidCredentialsError,
  SupabaseAuthAdapter,
} from './infrastructure/supabase-auth.adapter';
import { SupabaseAuthQueries } from './infrastructure/supabase-auth.queries';
import { MeController } from './presentation/controllers/me.controller';
import { LoginController } from './presentation/controllers/login.controller';
import { RefreshSessionController } from './presentation/controllers/refresh-session.controller';
import { createBearerMiddleware } from './presentation/middleware/bearer.middleware';
import { createAuthRouter } from './presentation/auth.routes';

export interface AuthComposition {
  /** Express router to be mounted at /auth by the composition root. */
  readonly router: ReturnType<typeof createAuthRouter>;
  /** Error mapper to be registered with the global error handler. */
  readonly errorMapper: ErrorMapper;
  /** Bearer middleware exported for cross-feature use. */
  readonly bearerMiddleware: RequestHandler;
}

/**
 * Constructs and wires the auth feature.
 * Called exclusively by src/app/composition-root.ts.
 *
 * @param infraClient - Service-role Supabase client (data queries).
 * @param anonClient  - Anon-key Supabase client (Auth operations).
 */
export function composeAuth(
  infraClient: SupabaseClient<Database>,
  anonClient: SupabaseClient<Database>,
): AuthComposition {
  const authAdapter = new SupabaseAuthAdapter(anonClient);
  const authQueries = new SupabaseAuthQueries(infraClient);

  const loginUseCase = new LoginUseCase(authAdapter);
  const refreshSessionUseCase = new RefreshSessionUseCase(authAdapter);
  const getMeUseCase = new GetMeUseCase(authQueries);
  const authenticateActor = new AuthenticateActorUseCase(authAdapter, authQueries);

  const bearerMiddleware = createBearerMiddleware(authenticateActor);
  const loginController = new LoginController(loginUseCase);
  const refreshSessionController = new RefreshSessionController(refreshSessionUseCase);
  const meController = new MeController(getMeUseCase);

  const router = createAuthRouter({
    bearerMiddleware,
    loginController,
    refreshSessionController,
    meController,
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof InvalidCredentialsError) {
      return { status: 401, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper, bearerMiddleware };
}
