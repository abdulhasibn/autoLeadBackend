import type { Logger } from '../../../../shared/logging/logger.port';
import type {
  IPendingPushRepository,
  IPushDeviceRepository,
  IPushSender,
  PushMessage,
} from '../../domain/push.ports';

const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

export interface DispatchResult {
  readonly notifications: number;
  readonly pushes: number;
}

/**
 * Sends every due, unread notification to all of its recipient's enabled
 * devices (a staff member can be signed in on several phones). Called by the
 * database trigger and by the minute sweep, never by an end user.
 */
export class DispatchPendingPushesUseCase {
  constructor(
    private readonly pending: IPendingPushRepository,
    private readonly devices: IPushDeviceRepository,
    private readonly sender: IPushSender,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<DispatchResult> {
    let notifications = 0;
    let pushes = 0;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const claimed = await this.pending.claim(BATCH_SIZE);
      if (claimed.length === 0) break;
      notifications += claimed.length;

      const userIds = [...new Set(claimed.map((item) => item.userId))];
      const tokensByUser = await this.devices.findEnabledTokens(userIds);

      const messages: PushMessage[] = claimed.flatMap((item) =>
        (tokensByUser.get(item.userId) ?? []).map((token) => ({
          to: token,
          title: item.title,
          body: item.body,
          data: {
            notificationId: item.id,
            type: item.type,
            entityType: item.entityType,
            entityId: item.entityId,
          },
        })),
      );
      pushes += messages.length;

      if (messages.length > 0) {
        try {
          const report = await this.sender.send(messages);
          if (report.invalidTokens.length > 0) {
            await this.devices.removeTokens(report.invalidTokens);
          }
        } catch (err) {
          // The notification is already in the inbox; a failed push is logged, not retried.
          this.logger.error({ err, count: messages.length }, 'Failed to send push notifications');
        }
      }

      if (claimed.length < BATCH_SIZE) break;
    }

    return { notifications, pushes };
  }
}
