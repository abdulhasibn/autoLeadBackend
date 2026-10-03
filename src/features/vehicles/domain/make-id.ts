import type { Brand } from '../../../shared/primitives/brand';

export type MakeId = Brand<string, 'MakeId'>;

export function toMakeId(value: string): MakeId {
  return value as MakeId;
}
