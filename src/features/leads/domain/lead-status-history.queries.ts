import type { LeadId } from '../../../domain/shared/lead-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface LeadStatusHistoryReadModel {
  readonly id: string;
  readonly leadId: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly changedBy: string;
  /** Actor's full name; null only if the user row is unreadable. */
  readonly changedByName: string | null;
  readonly notes: string | null;
  readonly changedAt: string;
}

export interface ILeadStatusHistoryQueries {
  listByLead(leadId: LeadId, page: Pagination): Promise<Page<LeadStatusHistoryReadModel>>;
}
