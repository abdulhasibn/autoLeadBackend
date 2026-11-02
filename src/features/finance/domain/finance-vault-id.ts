import type { Brand } from '../../../shared/primitives/brand';

export type FinanceVaultId = Brand<string, 'FinanceVaultId'>;

export function toFinanceVaultId(value: string): FinanceVaultId {
  return value as FinanceVaultId;
}
