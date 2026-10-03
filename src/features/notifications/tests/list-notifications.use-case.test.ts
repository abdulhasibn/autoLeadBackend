import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { NotificationInboxPolicy } from '../application/policies/notification-inbox.policy';
import { ListNotificationsUseCase } from '../application/use-cases/list-notifications.use-case';
import { isNotificationDue } from '../domain/is-notification-due';
import type { INotificationQueries, NotificationReadModel } from '../domain/notification.queries';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

class FakeClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}

class FakeNotificationQueries implements INotificationQueries {
  constructor(private readonly items: NotificationReadModel[]) {}

  async listDue(userId: UserId, now: Date, page: Pagination): Promise<Page<NotificationReadModel>> {
    void userId;
    const due = this.items.filter((item) =>
      isNotificationDue(item.dueAt === null ? null : new Date(item.dueAt), now),
    );
    return toPage(due.slice(page.offset, page.offset + page.limit), due.length, page);
  }
}

describe('ListNotificationsUseCase', () => {
  let useCase: ListNotificationsUseCase;

  beforeEach(() => {
    useCase = new ListNotificationsUseCase(
      new NotificationInboxPolicy(),
      new FakeNotificationQueries([
        {
          id: 'n1',
          type: 'follow_up_due',
          title: 'Follow-up due',
          body: null,
          entityType: 'follow_up',
          entityId: 'f1',
          isRead: false,
          dueAt: '2026-10-10T10:00:00.000Z',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
        {
          id: 'n2',
          type: 'follow_up_due',
          title: 'Follow-up due',
          body: null,
          entityType: 'follow_up',
          entityId: 'f2',
          isRead: false,
          dueAt: '2026-10-03T09:00:00.000Z',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
      ]),
      new FakeClock(new Date('2026-10-03T10:00:00.000Z')),
    );
  });

  it('returns only due reminders', async () => {
    const page = await useCase.execute({ limit: 20, offset: 0 }, ADMIN);
    expect(page.items.map((item) => item.id)).toEqual(['n2']);
  });

  it('rejects a salesperson', async () => {
    await expect(
      useCase.execute(
        { limit: 20, offset: 0 },
        { userId: toUserId('bbbb'), roles: ['salesperson'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
