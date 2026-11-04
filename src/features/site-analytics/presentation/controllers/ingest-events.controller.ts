import type { RequestHandler } from 'express';

import { hashClientIp } from '../../../../presentation/http/client-ip-hash';
import type { Logger } from '../../../../shared/logging/logger.port';
import type { IngestEventsUseCase } from '../../application/use-cases/ingest-events.use-case';
import type { VisitorId, WebSessionId } from '../../domain/web-event-ingest.port';
import { ingestEventsBodySchema } from '../schemas/site-events.schemas';

const CITY_HEADER = 'x-vercel-ip-city';

function parseBody(body: unknown): unknown {
  // sendBeacon posts JSON as text/plain so the request stays CORS-simple.
  if (typeof body !== 'string') {
    return body;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function cityOf(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === undefined || raw === '') {
    return null;
  }
  // Vercel URL-encodes the city ("S%C3%A3o%20Paulo").
  try {
    return decodeURIComponent(raw).slice(0, 80);
  } catch {
    return null;
  }
}

/**
 * Website analytics beacons. Always `204`: the browser ignores the answer, and
 * telling a client why a batch was dropped only helps someone probing it.
 */
export class IngestEventsController {
  constructor(
    private readonly ingestEvents: IngestEventsUseCase,
    private readonly ipHashKey: string,
    private readonly logger: Logger,
  ) {}

  handle(): RequestHandler {
    return async (req, res) => {
      const parsed = ingestEventsBodySchema.safeParse(parseBody(req.body));
      if (parsed.success) {
        const body = parsed.data;
        try {
          await this.ingestEvents.execute({
            visitorId: body.visitorId as VisitorId,
            sessionId: body.sessionId as WebSessionId,
            touch: body.touch,
            events: body.events,
            userAgent: req.get('user-agent'),
            city: cityOf(req.headers[CITY_HEADER]),
            ipHash: hashClientIp(req, this.ipHashKey),
          });
        } catch (err) {
          this.logger.warn({ err }, 'Dropped website events batch');
        }
      }
      res.status(204).end();
    };
  }
}
