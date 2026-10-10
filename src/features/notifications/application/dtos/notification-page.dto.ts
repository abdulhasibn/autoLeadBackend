import type { Page } from '../../../../shared/pagination/pagination';
import type { NotificationReadModel } from '../../domain/notification.queries';

export interface NotificationPageDto extends Page<NotificationReadModel> {
  /** Unread due notifications for the caller, regardless of the page or filter. */
  readonly unreadCount: number;
}
