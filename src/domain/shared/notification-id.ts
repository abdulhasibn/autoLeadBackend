import type { Brand } from '../../shared/primitives/brand';

export type NotificationId = Brand<string, 'NotificationId'>;

export function toNotificationId(value: string): NotificationId {
  return value as NotificationId;
}
