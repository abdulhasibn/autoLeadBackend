import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { SupabaseClient } from '@supabase/supabase-js';

import { JSON_BODY_LIMIT } from '../config/constants';
import type { AppConfig } from '../config/environment';
import { createLogger } from '../infrastructure/logging/logger';
import { createRequestLoggerMiddleware } from '../infrastructure/logging/request-logger.middleware';
import type { Database } from '../infrastructure/supabase/database.types';
import {
  createSupabaseAuthClient,
  createSupabaseInfraClient,
} from '../infrastructure/supabase/supabase-client';
import { createErrorHandlerMiddleware } from '../presentation/http/errors/error-handler.middleware';
import { createServerTimingMiddleware } from '../presentation/http/middleware/server-timing.middleware';
import { notFoundMiddleware } from '../presentation/http/middleware/not-found.middleware';
import type { Logger } from '../shared/logging/logger.port';
import { createRouter } from './routes';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly supabaseClient: SupabaseClient<Database>;
  readonly app: Express;
}

/**
 * The composition root (architecture.md §11). This is the only module allowed
 * to construct concrete implementations from every layer and wire them
 * together.
 */
export function composeApp(config: AppConfig): AppDependencies {
  const logger = createLogger(config);
  const supabaseClient = createSupabaseInfraClient(config);
  const _authClient = createSupabaseAuthClient(config);
  void _authClient;

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createServerTimingMiddleware());
  app.use(createRequestLoggerMiddleware(logger));

  app.use(createRouter());

  app.use(notFoundMiddleware);
  app.use(createErrorHandlerMiddleware(logger, []));

  return { config, logger, supabaseClient, app };
}
