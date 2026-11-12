import type { Logger } from '../../../shared/logging/logger.port';
import type { IPushSender, PushMessage, PushSendReport } from '../domain/push.ports';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const CHUNK_SIZE = 100;

interface ExpoTicket {
  readonly status: 'ok' | 'error';
  readonly details?: { readonly error?: string };
}

/** Sends through the Expo push service, which fans out to APNs and FCM. */
export class ExpoPushSender implements IPushSender {
  constructor(
    private readonly accessToken: string | null,
    private readonly logger: Logger,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(messages: readonly PushMessage[]): Promise<PushSendReport> {
    const invalidTokens: string[] = [];

    for (let start = 0; start < messages.length; start += CHUNK_SIZE) {
      const chunk = messages.slice(start, start + CHUNK_SIZE);
      const response = await this.fetchFn(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken === null ? {} : { Authorization: `Bearer ${this.accessToken}` }),
        },
        body: JSON.stringify(
          chunk.map((message) => ({
            to: message.to,
            title: message.title,
            body: message.body ?? undefined,
            data: message.data,
            sound: 'default',
            priority: 'high',
          })),
        ),
      });

      if (!response.ok) {
        throw new Error(`Expo push service answered ${response.status}`);
      }

      const payload = (await response.json()) as { data?: readonly ExpoTicket[] };
      (payload.data ?? []).forEach((ticket, index) => {
        if (ticket.status !== 'error') return;
        const token = chunk[index]?.to;
        if (ticket.details?.error === 'DeviceNotRegistered' && token !== undefined) {
          invalidTokens.push(token);
        } else {
          this.logger.warn({ error: ticket.details?.error }, 'Expo rejected a push');
        }
      });
    }

    return { invalidTokens };
  }
}
