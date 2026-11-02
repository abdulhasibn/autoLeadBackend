import type { Brand } from '../../../shared/primitives/brand';

export type FinanceTagId = Brand<string, 'FinanceTagId'>;

export function toFinanceTagId(value: string): FinanceTagId {
  return value as FinanceTagId;
}
