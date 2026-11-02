import type { FinanceTag } from '../../domain/finance-tag.entity';

export interface FinanceTagDto {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toFinanceTagDto(tag: FinanceTag): FinanceTagDto {
  return {
    id: tag.id,
    name: tag.name.value,
    color: tag.color?.value ?? null,
    archived: tag.isArchived,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}
