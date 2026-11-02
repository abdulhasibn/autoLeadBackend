import type { Brand } from '../../../shared/primitives/brand';

export type FinanceSessionId = Brand<string, 'FinanceSessionId'>;

export function toFinanceSessionId(value: string): FinanceSessionId {
  return value as FinanceSessionId;
}
