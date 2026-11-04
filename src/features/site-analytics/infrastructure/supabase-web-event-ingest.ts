import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database, Json } from '../../../infrastructure/supabase/database.types';
import type {
  IWebEventIngest,
  WebEventRecord,
  WebSessionRecord,
} from '../domain/web-event-ingest.port';

export class SupabaseWebEventIngest implements IWebEventIngest {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(
    session: WebSessionRecord,
    events: readonly WebEventRecord[],
    ipHash: string,
  ): Promise<number> {
    const { data, error } = await this.db.rpc('ingest_web_events', {
      p_session: { ...session } satisfies Json,
      p_events: events.map((event) => ({
        type: event.type,
        at: event.occurredAt.toISOString(),
        path: event.path,
        vehicleId: event.vehicleId,
        props: { ...event.props },
      })) satisfies Json,
      p_ip_hash: ipHash,
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to record website events: ${error.message}`);
    }
    return data;
  }
}
