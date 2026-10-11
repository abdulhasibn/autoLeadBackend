import type { UserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface NotificationReadModel {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  /** The lead this notification is about (follow-up or assignment); null otherwise. */
  readonly leadId: string | null;
  /** Contact name from the associated lead, if any. */
  readonly leadContactName: string | null;
  /** Contact phone from the associated lead, if any. */
  readonly leadContactPhone: string | null;
  readonly isRead: boolean;
  readonly dueAt: string | null;
  readonly createdAt: string;
}

export interface NotificationListCriteria {
  readonly isRead?: boolean;
}

export interface INotificationQueries {
  listDue(
    userId: UserId,
    now: Date,
    criteria: NotificationListCriteria,
    page: Pagination,
  ): Promise<Page<NotificationReadModel>>;
  countUnreadDue(userId: UserId, now: Date): Promise<number>;
}
