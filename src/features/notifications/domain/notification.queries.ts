import type { UserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface NotificationReadModel {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly isRead: boolean;
  readonly dueAt: string | null;
  readonly createdAt: string;
}

export interface INotificationQueries {
  listDue(userId: UserId, now: Date, page: Pagination): Promise<Page<NotificationReadModel>>;
}
