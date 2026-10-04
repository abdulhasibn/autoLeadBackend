import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { NotificationInboxPolicy } from '../policies/notification-inbox.policy';
import type {
  INotificationQueries,
  NotificationReadModel,
} from '../../domain/notification.queries';

export class ListNotificationsUseCase {
  constructor(
    private readonly policy: NotificationInboxPolicy,
    private readonly queries: INotificationQueries,
    private readonly clock: Clock,
  ) {}

  async execute(page: Pagination, ctx: AuthenticatedContext): Promise<Page<NotificationReadModel>> {
    this.policy.requireStaff(ctx);
    return this.queries.listDue(ctx.userId, this.clock.now(), page);
  }
}
