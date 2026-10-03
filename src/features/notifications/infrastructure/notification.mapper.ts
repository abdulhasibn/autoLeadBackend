import type { NotificationReadModel } from '../domain/notification.queries';

export interface NotificationRow {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly is_read: boolean;
  readonly due_at: string | null;
  readonly created_at: string;
}

export function toNotificationReadModel(row: NotificationRow): NotificationReadModel {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    dueAt: row.due_at === null ? null : new Date(row.due_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
