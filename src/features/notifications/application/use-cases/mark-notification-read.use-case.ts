import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toNotificationId } from '../../../../domain/shared/notification-id';
import type { NotificationInboxPolicy } from '../policies/notification-inbox.policy';
import type { INotificationRepository } from '../../domain/notification.repository';

export class MarkNotificationReadUseCase {
  constructor(
    private readonly policy: NotificationInboxPolicy,
    private readonly repo: INotificationRepository,
  ) {}

  async execute(notificationIdRaw: string, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireAdmin(ctx);

    const marked = await this.repo.markRead(toNotificationId(notificationIdRaw), ctx.userId);
    if (!marked) {
      throw new NotFoundError(`Notification not found for id ${notificationIdRaw}`);
    }
  }
}
