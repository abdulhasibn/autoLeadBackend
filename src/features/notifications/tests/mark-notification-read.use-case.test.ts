import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { NotificationId } from '../../../domain/shared/notification-id';
import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import { NotificationInboxPolicy } from '../application/policies/notification-inbox.policy';
import { MarkNotificationReadUseCase } from '../application/use-cases/mark-notification-read.use-case';
import type { INotificationRepository } from '../domain/notification.repository';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

class FakeNotificationRepository implements INotificationRepository {
  owned = new Set<string>(['11111111-1111-4111-8111-111111111111']);

  async markRead(id: NotificationId, userId: UserId): Promise<boolean> {
    void userId;
    return this.owned.has(id);
  }
}

describe('MarkNotificationReadUseCase', () => {
  let useCase: MarkNotificationReadUseCase;

  beforeEach(() => {
    useCase = new MarkNotificationReadUseCase(
      new NotificationInboxPolicy(),
      new FakeNotificationRepository(),
    );
  });

  it('marks an owned notification', async () => {
    await expect(
      useCase.execute('11111111-1111-4111-8111-111111111111', ADMIN),
    ).resolves.toBeUndefined();
  });

  it('throws when the notification is missing', async () => {
    await expect(
      useCase.execute('22222222-2222-4222-8222-222222222222', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
