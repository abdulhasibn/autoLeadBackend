import type { LeadId } from '../lead-id';

export class InvalidLeadStatusTransitionError extends Error {
  readonly code = 'INVALID_LEAD_STATUS_TRANSITION';

  constructor(
    readonly leadId: LeadId,
    readonly fromStatus: string,
    readonly toStatus: string,
  ) {
    super(`Cannot change lead status from ${fromStatus} to ${toStatus}`);
    this.name = 'InvalidLeadStatusTransitionError';
  }
}
