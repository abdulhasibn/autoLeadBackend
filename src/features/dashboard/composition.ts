import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { DashboardPolicy } from './application/policies/dashboard.policy';
import { GetDashboardUseCase } from './application/use-cases/get-dashboard.use-case';
import { SupabaseDashboardQueries } from './infrastructure/supabase-dashboard.queries';
import { GetDashboardController } from './presentation/controllers/get-dashboard.controller';
import { createDashboardRouter } from './presentation/dashboard.routes';

export interface DashboardComposition {
  readonly router: ReturnType<typeof createDashboardRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface DashboardCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly timeZone: string;
}

/**
 * Constructs and wires the admin dashboard.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeDashboard(
  infraClient: SupabaseClient<Database>,
  deps: DashboardCompositionDeps,
): DashboardComposition {
  const router = createDashboardRouter({
    bearerMiddleware: deps.bearerMiddleware,
    getDashboardController: new GetDashboardController(
      new GetDashboardUseCase(
        new DashboardPolicy(),
        new SupabaseDashboardQueries(infraClient),
        deps.clock,
        { timeZone: deps.timeZone },
      ),
    ),
  });

  const errorMapper: ErrorMapper = () => null;

  return { router, errorMapper };
}
