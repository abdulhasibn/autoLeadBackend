import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { isTagNameTaken } from '../../domain/finance-tag-rules';
import { FinanceTag } from '../../domain/finance-tag.entity';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import { TagColor } from '../../domain/tag-color.value-object';
import { TagName } from '../../domain/tag-name.value-object';
import type { CreateFinanceTagCommand } from '../dtos/create-finance-tag-command';
import { toFinanceTagDto, type FinanceTagDto } from '../dtos/finance-tag.dto';
import { FinanceTagNameTakenError } from '../errors/finance-tag-name-taken.error';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

export class CreateFinanceTagUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly tags: IFinanceTagRepository,
    private readonly sealer: TagSealer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: CreateFinanceTagCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceTagDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const name = TagName.create(command.name);
    const existing = this.sealer.openAll(await this.tags.findAll(), cipher);
    if (isTagNameTaken(existing, name, null)) {
      throw new FinanceTagNameTakenError(name.value);
    }

    const tag = FinanceTag.create({
      id: toFinanceTagId(this.ids.generate()),
      name,
      color: command.color === null ? null : TagColor.create(command.color),
      now: this.clock.now(),
    });
    await this.tags.save(this.sealer.seal(tag, cipher));
    return toFinanceTagDto(tag);
  }
}
