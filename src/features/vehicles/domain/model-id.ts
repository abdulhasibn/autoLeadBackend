import type { Brand } from '../../../shared/primitives/brand';

export type ModelId = Brand<string, 'ModelId'>;

export function toModelId(value: string): ModelId {
  return value as ModelId;
}
