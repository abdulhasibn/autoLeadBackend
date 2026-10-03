import type { Brand } from '../../../shared/primitives/brand';

export type OwnerId = Brand<string, 'OwnerId'>;

export function toOwnerId(value: string): OwnerId {
  return value as OwnerId;
}
