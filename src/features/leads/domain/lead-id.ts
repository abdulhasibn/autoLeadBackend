import type { Brand } from '../../../shared/primitives/brand';

export type LeadId = Brand<string, 'LeadId'>;

export function toLeadId(value: string): LeadId {
  return value as LeadId;
}
