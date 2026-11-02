import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { FinanceTagId } from './finance-tag-id';
import type { FinanceTag } from './finance-tag.entity';
import type { TagName } from './tag-name.value-object';

/** True when another tag (archived or not) already uses this name, ignoring case. */
export function isTagNameTaken(
  tags: readonly FinanceTag[],
  name: TagName,
  exceptId: FinanceTagId | null,
): boolean {
  return tags.some((tag) => tag.id !== exceptId && tag.name.key === name.key);
}

/**
 * Checks the tags an entry is about to carry: each must exist, and tags being
 * newly added must not be archived. Tags the entry already had may stay even
 * if archived since.
 */
export function assertTagsUsable(
  requested: readonly FinanceTagId[],
  current: readonly FinanceTagId[],
  tagsById: ReadonlyMap<string, FinanceTag>,
): void {
  for (const id of requested) {
    const tag = tagsById.get(id);
    if (tag === undefined) {
      throw new BusinessRuleViolationError('FINANCE_TAG_NOT_FOUND', `Tag ${id} does not exist`, {
        tagId: id,
      });
    }
    if (tag.isArchived && !current.includes(id)) {
      throw new BusinessRuleViolationError(
        'FINANCE_TAG_ARCHIVED',
        `Tag "${tag.name.value}" is archived and can't be added`,
        { tagId: id },
      );
    }
  }
}
