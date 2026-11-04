import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { Logger } from '../../shared/logging/logger.port';
import { IngestEventsUseCase } from './application/use-cases/ingest-events.use-case';
import { classifyTouch, referrerHost, type Channel, type RawTouch } from './domain/traffic-channel';
import { SupabaseWebEventIngest } from './infrastructure/supabase-web-event-ingest';
import { IngestEventsController } from './presentation/controllers/ingest-events.controller';
import { createSiteAnalyticsRouter } from './presentation/site-analytics.routes';

export interface SiteAnalyticsComposition {
  readonly router: ReturnType<typeof createSiteAnalyticsRouter>;
  /** Exposed so other features (marketplace lead attribution) classify the same way. */
  readonly touchClassifier: {
    classify(touch: RawTouch): { channel: Channel; referrerHost: string | null };
  };
}

export interface SiteAnalyticsCompositionDeps {
  readonly allowedOrigins: readonly string[];
  readonly ipHashKey: string;
  readonly logger: Logger;
}

/**
 * Constructs and wires website analytics capture (ADR-0016).
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeSiteAnalytics(
  infraClient: SupabaseClient<Database>,
  deps: SiteAnalyticsCompositionDeps,
): SiteAnalyticsComposition {
  const router = createSiteAnalyticsRouter({
    allowedOrigins: deps.allowedOrigins,
    ingestEventsController: new IngestEventsController(
      new IngestEventsUseCase(new SupabaseWebEventIngest(infraClient)),
      deps.ipHashKey,
      deps.logger,
    ),
  });

  return {
    router,
    touchClassifier: {
      classify: (touch) => ({
        channel: classifyTouch(touch),
        referrerHost: referrerHost(touch.referrer),
      }),
    },
  };
}
