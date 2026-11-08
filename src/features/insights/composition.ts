import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { Clock } from '../../shared/clock/clock';
import type { IInsightsQueries } from './domain/insights.queries';
import { InsightsPolicy } from './application/policies/insights.policy';
import { GetDemandInsightsUseCase } from './application/use-cases/get-demand-insights.use-case';
import { GetLeadJourneyUseCase } from './application/use-cases/get-lead-journey.use-case';
import { GetTrafficInsightsUseCase } from './application/use-cases/get-traffic-insights.use-case';
import { GetVehicleInsightDetailUseCase } from './application/use-cases/get-vehicle-insight-detail.use-case';
import { GetVehicleInsightsUseCase } from './application/use-cases/get-vehicle-insights.use-case';
import { SupabaseInsightsQueries } from './infrastructure/supabase-insights.queries';
import { GetDemandInsightsController } from './presentation/controllers/get-demand-insights.controller';
import { GetLeadJourneyController } from './presentation/controllers/get-lead-journey.controller';
import { GetTrafficInsightsController } from './presentation/controllers/get-traffic-insights.controller';
import { GetVehicleInsightDetailController } from './presentation/controllers/get-vehicle-insight-detail.controller';
import { GetVehicleInsightsController } from './presentation/controllers/get-vehicle-insights.controller';
import { createInsightsRouter } from './presentation/insights.routes';

export interface InsightsComposition {
  readonly router: ReturnType<typeof createInsightsRouter>;
}

export interface InsightsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly timeZone: string;
}

/** Wires the routes around any queries implementation (tests pass a fake). */
export function createInsightsRouterWith(
  queries: IInsightsQueries,
  deps: InsightsCompositionDeps,
): ReturnType<typeof createInsightsRouter> {
  const policy = new InsightsPolicy();
  const settings = { timeZone: deps.timeZone };
  return createInsightsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    getTrafficInsightsController: new GetTrafficInsightsController(
      new GetTrafficInsightsUseCase(policy, queries, deps.clock, settings),
    ),
    getVehicleInsightsController: new GetVehicleInsightsController(
      new GetVehicleInsightsUseCase(policy, queries, deps.clock, settings),
    ),
    getVehicleInsightDetailController: new GetVehicleInsightDetailController(
      new GetVehicleInsightDetailUseCase(policy, queries, deps.clock, settings),
    ),
    getDemandInsightsController: new GetDemandInsightsController(
      new GetDemandInsightsUseCase(policy, queries, deps.clock, settings),
    ),
    getLeadJourneyController: new GetLeadJourneyController(
      new GetLeadJourneyUseCase(policy, queries),
    ),
  });
}

/**
 * Constructs and wires the admin Insights reads (ADR-0016 read side).
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeInsights(
  infraClient: SupabaseClient<Database>,
  deps: InsightsCompositionDeps,
): InsightsComposition {
  return { router: createInsightsRouterWith(new SupabaseInsightsQueries(infraClient), deps) };
}
