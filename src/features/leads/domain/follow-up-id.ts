import type { Brand } from '../../../shared/primitives/brand';

export type FollowUpId = Brand<string, 'FollowUpId'>;

export function toFollowUpId(value: string): FollowUpId {
  return value as FollowUpId;
}
