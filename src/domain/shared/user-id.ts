import type { Brand } from '../../shared/primitives/brand';

export type UserId = Brand<string, 'UserId'>;

export function toUserId(value: string): UserId {
  return value as UserId;
}
