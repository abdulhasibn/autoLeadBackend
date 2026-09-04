import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { SendOtpUseCase } from './application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import {
  OtpVerificationError,
  SupabaseAuthAdapter,
} from './infrastructure/supabase-auth.adapter';
import { SupabaseAuthQueries } from './infrastructure/supabase-auth.queries';
import { MeController } from './presentation/controllers/me.controller';
import { SendOtpController } from './presentation/controllers/send-otp.controller';
import { VerifyOtpController } from './presentation/controllers/verify-otp.controller';
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
  // Infrastructure
  const authAdapter = new SupabaseAuthAdapter(anonClient);
  const authQueries = new SupabaseAuthQueries(infraClient);

  // Use cases
  const sendOtpUseCase = new SendOtpUseCase(authAdapter);
  const verifyOtpUseCase = new VerifyOtpUseCase(authAdapter);
  const getMeUseCase = new GetMeUseCase(authQueries);

  // Presentation
  const bearerMiddleware = createBearerMiddleware(authAdapter);
  const sendOtpController = new SendOtpController(sendOtpUseCase);
  const verifyOtpController = new VerifyOtpController(verifyOtpUseCase);
  const meController = new MeController(getMeUseCase);

  const router = createAuthRouter({
    bearerMiddleware,
    sendOtpController,
    verifyOtpController,
    meController,
  });

  // Feature-scoped error mapper: OtpVerificationError → 401
  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof OtpVerificationError) {
      return { status: 401, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper, bearerMiddleware };
}
