import type { Brand } from '../../shared/primitives/brand';

export type ShowroomId = Brand<string, 'ShowroomId'>;

export function toShowroomId(value: string): ShowroomId {
  return value as ShowroomId;
}
