import type { Brand } from '../../../shared/primitives/brand';

export type MediaId = Brand<string, 'MediaId'>;

export function toMediaId(value: string): MediaId {
  return value as MediaId;
}
