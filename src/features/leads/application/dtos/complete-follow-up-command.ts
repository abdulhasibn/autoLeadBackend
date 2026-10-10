import type { FollowUpPlan } from '../services/build-scheduled-follow-up';
import type { FollowUpDto } from './follow-up.dto';

export interface CompleteFollowUpCommand {
  readonly leadId: string;
  readonly followUpId: string;
  readonly outcome: string;
  readonly notes: string | null;
  /** Scheduled in the same transaction when present. */
  readonly next: FollowUpPlan | null;
}

export interface CompleteFollowUpResult {
  readonly followUp: FollowUpDto;
  readonly next: FollowUpDto | null;
}
