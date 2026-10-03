import type { Brand } from '../../../shared/primitives/brand';

export type VariantId = Brand<string, 'VariantId'>;

export function toVariantId(value: string): VariantId {
  return value as VariantId;
}
