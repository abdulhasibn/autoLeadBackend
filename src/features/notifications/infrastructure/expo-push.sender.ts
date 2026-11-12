import type { Logger } from '../../../shared/logging/logger.port';
import type { IPushSender, PushMessage, PushSendReport } from '../domain/push.ports';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const CHUNK_SIZE = 100;

/**
 * The slice of `fetch` this adapter uses. Declared here because the project
 * has no DOM lib, so the global `Response` type is not available to every
 * type-check (Vercel's build failed on it).
 */
interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<FetchResponseLike>;

interface ExpoTicket {
  readonly status: 'ok' | 'error';
  readonly details?: { readonly error?: string };
}

/** Sends through the Expo push service, which fans out to APNs and FCM. */
export class ExpoPushSender implements IPushSender {
  constructor(
    private readonly accessToken: string | null,
    private readonly logger: Logger,
    private readonly fetchFn: FetchLike = (globalThis as unknown as { fetch: FetchLike }).fetch,
  ) {}

  async send(messages: readonly PushMessage[]): Promise<PushSendReport> {
    const invalidTokens: string[] = [];

    for (let start = 0; start < messages.length; start += CHUNK_SIZE) {
      const chunk = messages.slice(start, start + CHUNK_SIZE);
      try {
        invalidTokens.push(...(await this.sendChunk(chunk)));
      } catch (err) {
        // One failed chunk must not drop the chunks after it, nor the dead
        // tokens already found.
        this.logger.error({ err, count: chunk.length }, 'Failed to send a push chunk');
      }
    }

    return { invalidTokens };
  }

  /** Sends up to one request's worth of messages; returns the tokens Expo says are dead. */
  private async sendChunk(chunk: readonly PushMessage[]): Promise<string[]> {
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
    const invalid: string[] = [];
    (payload.data ?? []).forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      const token = chunk[index]?.to;
      if (ticket.details?.error === 'DeviceNotRegistered' && token !== undefined) {
        invalid.push(token);
      } else {
        this.logger.warn({ error: ticket.details?.error }, 'Expo rejected a push');
      }
    });
    return invalid;
  }
}
