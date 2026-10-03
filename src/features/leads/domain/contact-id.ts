import type { Brand } from '../../../shared/primitives/brand';

export type ContactId = Brand<string, 'ContactId'>;

export function toContactId(value: string): ContactId {
  return value as ContactId;
}
