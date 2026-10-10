import type { LeadId } from '../../../domain/shared/lead-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { FollowUpStatus } from './follow-up.entity';

export interface FollowUpReadModel {
  readonly id: string;
  readonly leadId: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly notes: string | null;
  readonly status: FollowUpStatus;
  readonly outcome: string | null;
  readonly completionNotes: string | null;
  readonly completedAt: string | null;
  readonly completedBy: string | null;
  readonly completedByName: string | null;
  readonly cancelledAt: string | null;
  readonly cancelledBy: string | null;
  readonly cancelledByName: string | null;
  readonly assignedTo: string;
  readonly assignedToName: string | null;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly createdAt: string;
}

/** `open`: due work, earliest first. `closed`: completed or cancelled, latest first. */
export type FollowUpListScope = 'open' | 'closed' | 'all';

export interface IFollowUpQueries {
  listByLead(
    leadId: LeadId,
    scope: FollowUpListScope,
    page: Pagination,
  ): Promise<Page<FollowUpReadModel>>;
}
