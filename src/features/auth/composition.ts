import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Logger } from '../../shared/logging/logger.port';
import { AuthenticateActorUseCase } from './application/use-cases/authenticate-actor.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import {
  InvalidCredentialsError,
  SupabaseAuthAdapter,
} from './infrastructure/supabase-auth.adapter';
import { AuthRateLimitedError } from './infrastructure/supabase-auth-errors';
import { SupabaseAuthQueries } from './infrastructure/supabase-auth.queries';
import { SupabasePasswordCredentials } from './infrastructure/supabase-password-credentials.adapter';
import { ChangePasswordController } from './presentation/controllers/change-password.controller';
import { ForgotPasswordController } from './presentation/controllers/forgot-password.controller';
import { LogoutController } from './presentation/controllers/logout.controller';
import { MeController } from './presentation/controllers/me.controller';
import { LoginController } from './presentation/controllers/login.controller';
import { RefreshSessionController } from './presentation/controllers/refresh-session.controller';
import { ResetPasswordController } from './presentation/controllers/reset-password.controller';
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
 * @param infraClient - Service-role Supabase client (data queries, Auth admin).
 * @param anonClient  - Anon-key Supabase client (Auth operations).
 * @param logger      - Logs reset emails that were not sent.
 */
export function composeAuth(
  infraClient: SupabaseClient<Database>,
  anonClient: SupabaseClient<Database>,
  logger: Logger,
): AuthComposition {
  const authAdapter = new SupabaseAuthAdapter(anonClient);
  const passwordCredentials = new SupabasePasswordCredentials(anonClient, infraClient, logger);
  const authQueries = new SupabaseAuthQueries(infraClient);

  const loginUseCase = new LoginUseCase(authAdapter);
  const refreshSessionUseCase = new RefreshSessionUseCase(authAdapter);
  const getMeUseCase = new GetMeUseCase(authQueries);
  const authenticateActor = new AuthenticateActorUseCase(authAdapter, authQueries);
  const logoutUseCase = new LogoutUseCase(authAdapter);
  const changePasswordUseCase = new ChangePasswordUseCase(passwordCredentials, authAdapter);
  const requestPasswordResetUseCase = new RequestPasswordResetUseCase(passwordCredentials);
  const resetPasswordUseCase = new ResetPasswordUseCase(passwordCredentials, authAdapter);

  const bearerMiddleware = createBearerMiddleware(authenticateActor);

  const router = createAuthRouter({
    bearerMiddleware,
    loginController: new LoginController(loginUseCase),
    refreshSessionController: new RefreshSessionController(refreshSessionUseCase),
    meController: new MeController(getMeUseCase),
    logoutController: new LogoutController(logoutUseCase),
    changePasswordController: new ChangePasswordController(changePasswordUseCase),
    forgotPasswordController: new ForgotPasswordController(requestPasswordResetUseCase),
    resetPasswordController: new ResetPasswordController(resetPasswordUseCase),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof InvalidCredentialsError) {
      return { status: 401, code: err.code, message: err.message };
    }
    if (err instanceof AuthRateLimitedError) {
      return { status: 429, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper, bearerMiddleware };
}
