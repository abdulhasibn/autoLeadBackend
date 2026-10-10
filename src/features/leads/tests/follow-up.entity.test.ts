import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { toNotificationId } from '../../../domain/shared/notification-id';
import { toUserId } from '../../../domain/shared/user-id';
import { FollowUp, type FollowUpScheduleProps } from '../domain/follow-up.entity';
import { toFollowUpId } from '../domain/follow-up-id';
import { FollowUpOutcome } from '../domain/follow-up-outcome.value-object';
import { FollowUpTaskType } from '../domain/follow-up-task-type.value-object';
import { toLeadId } from '../../../domain/shared/lead-id';

const SCHEDULED = new Date('2026-10-10T10:00:00.000Z');
const LATER = new Date('2026-10-10T11:00:00.000Z');
const ACTOR = toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

function props(overrides: Partial<FollowUpScheduleProps> = {}): FollowUpScheduleProps {
  return {
    id: toFollowUpId('88888888-8888-4888-8888-888888888888'),
    leadId: toLeadId('77777777-7777-4777-8777-777777777777'),
    assignedTo: ACTOR,
    taskType: FollowUpTaskType.create('call'),
    scheduledAt: SCHEDULED,
    notes: null,
    createdBy: ACTOR,
    createdAt: SCHEDULED,
    notificationId: toNotificationId('99999999-9999-4999-8999-999999999999'),
    dueAt: SCHEDULED,
    ...overrides,
  };
}

describe('FollowUp', () => {
  it('requires dueAt to match scheduledAt', () => {
    expect(() => FollowUp.schedule(props({ dueAt: new Date('2026-10-11T10:00:00.000Z') }))).toThrow(
      'due time must match',
    );
  });

  it('schedules an open follow-up when the reminder time matches', () => {
    const followUp = FollowUp.schedule(props());
    expect(followUp.dueAt).toEqual(SCHEDULED);
    expect(followUp.notificationId).toBe('99999999-9999-4999-8999-999999999999');
    expect(followUp.status).toBe('open');
  });

  it('completes with an outcome and trimmed notes', () => {
    const followUp = FollowUp.schedule(props());
    followUp.complete({
      by: ACTOR,
      at: LATER,
      outcome: FollowUpOutcome.create('reached'),
      notes: '  Wants a test drive  ',
    });
    expect(followUp.status).toBe('completed');
    expect(followUp.completion?.outcome.value).toBe('reached');
    expect(followUp.completion?.notes).toBe('Wants a test drive');
  });

  it('cancels an open follow-up', () => {
    const followUp = FollowUp.schedule(props());
    followUp.cancel({ by: ACTOR, at: LATER });
    expect(followUp.status).toBe('cancelled');
  });

  it('closes only once', () => {
    const followUp = FollowUp.schedule(props());
    followUp.cancel({ by: ACTOR, at: LATER });
    expect(() =>
      followUp.complete({
        by: ACTOR,
        at: LATER,
        outcome: FollowUpOutcome.create('done'),
        notes: null,
      }),
    ).toThrow(BusinessRuleViolationError);
    expect(() => followUp.cancel({ by: ACTOR, at: LATER })).toThrow('already cancelled');
  });
});

describe('FollowUpOutcome', () => {
  it('rejects unknown outcomes', () => {
    expect(() => FollowUpOutcome.create('maybe')).toThrow('Follow-up outcome must be');
    expect(FollowUpOutcome.create(' no_answer ').value).toBe('no_answer');
  });
});
