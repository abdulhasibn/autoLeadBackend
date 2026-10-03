import type { NotificationId } from '../../../domain/shared/notification-id';
import type { UserId } from '../../../domain/shared/user-id';

export interface INotificationRepository {
  markRead(id: NotificationId, userId: UserId): Promise<boolean>;
}
