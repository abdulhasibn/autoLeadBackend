import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { Pagination } from '../../../../shared/pagination/pagination';
import type { NotificationPageDto } from '../dtos/notification-page.dto';
import type { NotificationInboxPolicy } from '../policies/notification-inbox.policy';
import type { INotificationQueries } from '../../domain/notification.queries';

export interface ListNotificationsQuery {
  readonly isRead?: boolean;
  readonly page: Pagination;
}

export class ListNotificationsUseCase {
  constructor(
    private readonly policy: NotificationInboxPolicy,
    private readonly queries: INotificationQueries,
    private readonly clock: Clock,
  ) {}

  async execute(
    query: ListNotificationsQuery,
    ctx: AuthenticatedContext,
  ): Promise<NotificationPageDto> {
    this.policy.requireStaff(ctx);
    const now = this.clock.now();
    const [page, unreadCount] = await Promise.all([
      this.queries.listDue(ctx.userId, now, { isRead: query.isRead }, query.page),
      this.queries.countUnreadDue(ctx.userId, now),
    ]);
    return { ...page, unreadCount };
  }
}
