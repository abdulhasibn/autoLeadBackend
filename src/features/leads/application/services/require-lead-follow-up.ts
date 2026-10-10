import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { FollowUp } from '../../domain/follow-up.entity';
import { toFollowUpId } from '../../domain/follow-up-id';
import type { Lead } from '../../domain/lead.entity';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';

/**
 * Loads a follow-up through its lead, so the caller's lead scope applies.
 * A follow-up on another lead answers NotFound, like an unknown id.
 */
export async function requireLeadFollowUp(
  repo: ILeadRepository,
  policy: LeadManagementPolicy,
  ids: { readonly leadId: string; readonly followUpId: string },
  ctx: AuthenticatedContext,
): Promise<{ readonly lead: Lead; readonly followUp: FollowUp }> {
  policy.requireStaff(ctx);

  const lead = await repo.findById(toLeadId(ids.leadId));
  if (lead === null) {
    throw new NotFoundError(`Lead not found for id ${ids.leadId}`);
  }
  policy.requireCanWork(ctx, lead);

  const followUp = await repo.findFollowUpById(toFollowUpId(ids.followUpId));
  if (followUp === null || followUp.leadId !== lead.id) {
    throw new NotFoundError(`Follow-up not found for id ${ids.followUpId}`);
  }

  return { lead, followUp };
}
