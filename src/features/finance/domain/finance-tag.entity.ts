import type { FinanceTagId } from './finance-tag-id';
import type { TagColor } from './tag-color.value-object';
import type { TagName } from './tag-name.value-object';

export interface FinanceTagProps {
  readonly id: FinanceTagId;
  readonly name: TagName;
  readonly color: TagColor | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

/**
 * An admin-defined label for entries. Archived instead of deleted, so entries
 * keep their labels; an archived tag can't be added to more entries.
 */
export class FinanceTag {
  private constructor(private props: FinanceTagProps) {}

  static create(input: {
    id: FinanceTagId;
    name: TagName;
    color: TagColor | null;
    now: Date;
  }): FinanceTag {
    return new FinanceTag({
      id: input.id,
      name: input.name,
      color: input.color,
      createdAt: input.now,
      updatedAt: input.now,
      archivedAt: null,
    });
  }

  static reconstitute(props: FinanceTagProps): FinanceTag {
    return new FinanceTag(props);
  }

  get id(): FinanceTagId {
    return this.props.id;
  }
  get name(): TagName {
    return this.props.name;
  }
  get color(): TagColor | null {
    return this.props.color;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }
  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  rename(name: TagName, now: Date): void {
    this.props = { ...this.props, name, updatedAt: now };
  }

  recolor(color: TagColor | null, now: Date): void {
    this.props = { ...this.props, color, updatedAt: now };
  }

  archive(now: Date): void {
    if (this.props.archivedAt === null) {
      this.props = { ...this.props, archivedAt: now, updatedAt: now };
    }
  }

  restore(now: Date): void {
    if (this.props.archivedAt !== null) {
      this.props = { ...this.props, archivedAt: null, updatedAt: now };
    }
  }
}
