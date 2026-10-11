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
import type {
  INotificationQueries,
  NotificationListCriteria,
  NotificationReadModel,
} from '../domain/notification.queries';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

class FakeClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}

class FakeNotificationQueries implements INotificationQueries {
  constructor(private readonly items: NotificationReadModel[]) {}

  async listDue(
    userId: UserId,
    now: Date,
    criteria: NotificationListCriteria,
    page: Pagination,
  ): Promise<Page<NotificationReadModel>> {
    void userId;
    const due = this.due(now).filter(
      (item) => criteria.isRead === undefined || item.isRead === criteria.isRead,
    );
    return toPage(due.slice(page.offset, page.offset + page.limit), due.length, page);
  }

  async countUnreadDue(userId: UserId, now: Date): Promise<number> {
    void userId;
    return this.due(now).filter((item) => !item.isRead).length;
  }

  private due(now: Date): NotificationReadModel[] {
    return this.items.filter((item) =>
      isNotificationDue(item.dueAt === null ? null : new Date(item.dueAt), now),
    );
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
          leadId: 'l1',
          leadContactName: 'Alice Smith',
          leadContactPhone: '+1234567890',
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
          leadId: 'l2',
          leadContactName: 'Bob Jones',
          leadContactPhone: '+0987654321',
          isRead: false,
          dueAt: '2026-10-03T09:00:00.000Z',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
        {
          id: 'n3',
          type: 'lead_assigned',
          title: 'New lead assigned',
          body: null,
          entityType: 'lead',
          entityId: 'l3',
          leadId: 'l3',
          leadContactName: null,
          leadContactPhone: null,
          isRead: true,
          dueAt: null,
          createdAt: '2026-10-02T00:00:00.000Z',
        },
      ]),
      new FakeClock(new Date('2026-10-03T10:00:00.000Z')),
    );
  });

  it('returns only due reminders', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.items.map((item) => item.id)).toEqual(['n2', 'n3']);
    expect(page.items[0]?.leadId).toBe('l2');
  });

  it('counts unread due notifications whatever the filter', async () => {
    const page = await useCase.execute({ isRead: true, page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.items.map((item) => item.id)).toEqual(['n3']);
    expect(page.unreadCount).toBe(1);
  });

  it('filters to unread only', async () => {
    const page = await useCase.execute({ isRead: false, page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.items.map((item) => item.id)).toEqual(['n2']);
    expect(page.total).toBe(1);
  });

  it('lets a salesperson read their own inbox', async () => {
    await expect(
      useCase.execute(
        { page: { limit: 20, offset: 0 } },
        { userId: toUserId('bbbb'), roles: ['salesperson'], showroomId: null },
      ),
    ).resolves.toMatchObject({ limit: 20, offset: 0, unreadCount: 1 });
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(
        { page: { limit: 20, offset: 0 } },
        { userId: toUserId('cccc'), roles: ['buyer'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
