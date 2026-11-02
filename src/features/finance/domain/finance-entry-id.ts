import type { Brand } from '../../../shared/primitives/brand';

export type FinanceEntryId = Brand<string, 'FinanceEntryId'>;

export function toFinanceEntryId(value: string): FinanceEntryId {
  return value as FinanceEntryId;
}
