import { describe, expect, it } from 'vitest';

import { toNotificationId } from '../../../domain/shared/notification-id';
import { toUserId } from '../../../domain/shared/user-id';
import { FollowUp } from '../domain/follow-up.entity';
import { toFollowUpId } from '../domain/follow-up-id';
import { FollowUpTaskType } from '../domain/follow-up-task-type.value-object';
import { toLeadId } from '../../../domain/shared/lead-id';

const SCHEDULED = new Date('2026-10-10T10:00:00.000Z');

describe('FollowUp', () => {
  it('requires dueAt to match scheduledAt', () => {
    expect(() =>
      FollowUp.schedule({
        id: toFollowUpId('88888888-8888-4888-8888-888888888888'),
        leadId: toLeadId('77777777-7777-4777-8777-777777777777'),
        assignedTo: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        taskType: FollowUpTaskType.create('call'),
        scheduledAt: SCHEDULED,
        notes: null,
        createdBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        createdAt: SCHEDULED,
        notificationId: toNotificationId('99999999-9999-4999-8999-999999999999'),
        dueAt: new Date('2026-10-11T10:00:00.000Z'),
      }),
    ).toThrow('due time must match');
  });

  it('schedules when the reminder time matches', () => {
    const followUp = FollowUp.schedule({
      id: toFollowUpId('88888888-8888-4888-8888-888888888888'),
      leadId: toLeadId('77777777-7777-4777-8777-777777777777'),
      assignedTo: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      taskType: FollowUpTaskType.create('call'),
      scheduledAt: SCHEDULED,
      notes: null,
      createdBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      createdAt: SCHEDULED,
      notificationId: toNotificationId('99999999-9999-4999-8999-999999999999'),
      dueAt: SCHEDULED,
    });
    expect(followUp.dueAt).toEqual(SCHEDULED);
    expect(followUp.notificationId).toBe('99999999-9999-4999-8999-999999999999');
  });
});
