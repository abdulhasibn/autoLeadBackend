import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { isTagNameTaken } from '../../domain/finance-tag-rules';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import { TagColor } from '../../domain/tag-color.value-object';
import { TagName } from '../../domain/tag-name.value-object';
import { toFinanceTagDto, type FinanceTagDto } from '../dtos/finance-tag.dto';
import type { UpdateFinanceTagCommand } from '../dtos/update-finance-tag-command';
import { FinanceTagNameTakenError } from '../errors/finance-tag-name-taken.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

/** Renames, recolours, archives or restores a tag. Entries keep their tags either way. */
export class UpdateFinanceTagUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly tags: IFinanceTagRepository,
    private readonly sealer: TagSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: UpdateFinanceTagCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceTagDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const tagId = toFinanceTagId(command.tagId);
    const sealed = await this.tags.findById(tagId);
    if (sealed === null) {
      throw new NotFoundError(`Tag not found for id ${command.tagId}`);
    }
    const tag = this.sealer.open(sealed, cipher);
    const now = this.clock.now();

    if (command.name !== undefined) {
      const name = TagName.create(command.name);
      const all = this.sealer.openAll(await this.tags.findAll(), cipher);
      if (isTagNameTaken(all, name, tag.id)) {
        throw new FinanceTagNameTakenError(name.value);
      }
      tag.rename(name, now);
    }
    if (command.color !== undefined) {
      tag.recolor(command.color === null ? null : TagColor.create(command.color), now);
    }
    if (command.archived === true) {
      tag.archive(now);
    } else if (command.archived === false) {
      tag.restore(now);
    }

    await this.tags.save(this.sealer.seal(tag, cipher));
    return toFinanceTagDto(tag);
  }
}
