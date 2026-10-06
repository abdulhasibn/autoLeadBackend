import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { LeadPreferenceDto } from '../dtos/lead-preference.dto';
import { toLeadPreferenceDto } from '../dtos/lead-preference.dto';
import type { SetLeadPreferenceCommand } from '../dtos/set-lead-preference-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { resolvePreferredCatalog } from '../services/resolve-preferred-catalog';
import type { ICatalogLineageLookup } from '../../domain/catalog-lineage.port';
import type { ILeadRepository } from '../../domain/lead.repository';

/** Replaces a lead's catalog preference; all-null ids clear it. */
export class SetLeadPreferenceUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly catalog: ICatalogLineageLookup,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: SetLeadPreferenceCommand,
    ctx: AuthenticatedContext,
  ): Promise<LeadPreferenceDto> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const preference = await resolvePreferredCatalog(this.catalog, {
      makeId: command.preferredMakeId,
      modelId: command.preferredModelId,
      variantId: command.preferredVariantId,
    });
    lead.setPreferredCatalog(preference, this.clock.now());
    await this.repo.save(lead, { actorId: ctx.userId });

    return toLeadPreferenceDto(lead.preferredCatalog);
  }
}
