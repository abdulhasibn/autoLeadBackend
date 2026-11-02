import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IFinanceTagQueries } from '../../domain/finance-tag.queries';
import { toFinanceTagDto, type FinanceTagDto } from '../dtos/finance-tag.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

/** Tags for pickers, sorted by name. Archived ones only on request. */
export class ListFinanceTagsUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly tags: IFinanceTagQueries,
    private readonly sealer: TagSealer,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly includeArchived: boolean },
    ctx: AuthenticatedContext,
  ): Promise<FinanceTagDto[]> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    return this.sealer
      .openAll(await this.tags.listAll(), cipher)
      .filter((tag) => query.includeArchived || !tag.isArchived)
      .sort((a, b) => a.name.value.localeCompare(b.name.value, 'en-IN', { sensitivity: 'base' }))
      .map(toFinanceTagDto);
  }
}
