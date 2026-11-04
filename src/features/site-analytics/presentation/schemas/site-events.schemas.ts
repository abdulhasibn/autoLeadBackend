import { z } from 'zod';

import { visitorTouchSchema } from '../../../../presentation/validation/visitor-touch.schemas';
import { WEB_EVENT_TYPES } from '../../domain/web-event-ingest.port';

export const MAX_EVENTS_PER_BATCH = 20;
const MAX_PROPS = 12;

const eventSchema = z.object({
  type: z.enum(WEB_EVENT_TYPES),
  at: z.iso.datetime({ offset: true }),
  path: z.string().max(300),
  vehicleId: z.string().uuid().optional(),
  props: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .refine((props) => Object.keys(props).length <= MAX_PROPS, {
      message: `props allows at most ${MAX_PROPS} keys`,
    })
    .optional(),
});

/** `POST /public/events` body, §2.1 of the analytics contract. */
export const ingestEventsBodySchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  touch: visitorTouchSchema,
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
