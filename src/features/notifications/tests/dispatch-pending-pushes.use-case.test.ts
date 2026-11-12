import { describe, expect, it } from 'vitest';

import { toUserId, type UserId } from '../../../domain/shared/user-id';
import type { Logger } from '../../../shared/logging/logger.port';
import { DispatchPendingPushesUseCase } from '../application/use-cases/dispatch-pending-pushes.use-case';
import type {
  IPendingPushRepository,
  IPushDeviceRepository,
  IPushSender,
  PendingPush,
  PushMessage,
} from '../domain/push.ports';

const ANA = toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const BEN = toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => logger,
};

function pending(id: string, userId: UserId): PendingPush {
  return {
    id,
    userId,
    type: 'lead_assigned',
    title: 'T',
    body: 'B',
    entityType: 'lead',
    entityId: 'l1',
  };
}

class FakePending implements IPendingPushRepository {
  released: string[] = [];
  constructor(private queue: PendingPush[]) {}
  async release(ids: readonly string[]): Promise<void> {
    this.released.push(...ids);
  }
  async claim(limit: number): Promise<readonly PendingPush[]> {
    return this.queue.splice(0, limit);
  }
}

class FakeDevices implements IPushDeviceRepository {
  removed: string[] = [];
  constructor(private readonly tokens: Record<string, string[]>) {}
  async upsert(): Promise<void> {}
  async remove(): Promise<void> {}
  async findEnabledTokens(ids: readonly UserId[]) {
    return new Map(ids.filter((id) => this.tokens[id]).map((id) => [id, this.tokens[id] ?? []]));
  }
  async removeTokens(tokens: readonly string[]): Promise<void> {
    this.removed.push(...tokens);
  }
}

class FakeSender implements IPushSender {
  sent: PushMessage[] = [];
  constructor(
    private readonly invalid: string[] = [],
    private readonly fail = false,
  ) {}
  async send(messages: readonly PushMessage[]) {
    if (this.fail) throw new Error('down');
    this.sent.push(...messages);
    return { invalidTokens: this.invalid };
  }
}

const pending_ = (id: string): PendingPush => pending(id, ANA);

describe('DispatchPendingPushesUseCase', () => {
  it('pushes to every enabled device of the recipient', async () => {
    const sender = new FakeSender();
    const useCase = new DispatchPendingPushesUseCase(
      new FakePending([pending('n1', ANA), pending('n2', BEN)]),
      new FakeDevices({ [ANA]: ['ExponentPushToken[a1]', 'ExponentPushToken[a2]'] }),
      sender,
      logger,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ notifications: 2, pushes: 2 });
    expect(sender.sent.map((m) => m.to)).toEqual([
      'ExponentPushToken[a1]',
      'ExponentPushToken[a2]',
    ]);
    expect(sender.sent[0]?.data).toMatchObject({ notificationId: 'n1', entityType: 'lead' });
  });

  it('prunes tokens the provider reports invalid', async () => {
    const devices = new FakeDevices({ [ANA]: ['ExponentPushToken[dead]'] });
    const useCase = new DispatchPendingPushesUseCase(
      new FakePending([pending('n1', ANA)]),
      devices,
      new FakeSender(['ExponentPushToken[dead]']),
      logger,
    );

    await useCase.execute();

    expect(devices.removed).toEqual(['ExponentPushToken[dead]']);
  });

  it('does not throw when the provider is down', async () => {
    const useCase = new DispatchPendingPushesUseCase(
      new FakePending([pending('n1', ANA)]),
      new FakeDevices({ [ANA]: ['ExponentPushToken[a1]'] }),
      new FakeSender([], true),
      logger,
    );

    await expect(useCase.execute()).resolves.toEqual({ notifications: 1, pushes: 1 });
  });

  it('hands the batch back when the device lookup fails, so it is retried', async () => {
    const pending = new FakePending([pending_('n1'), pending_('n2')]);
    const devices = new FakeDevices({});
    devices.findEnabledTokens = async () => {
      throw new Error('db down');
    };
    const sender = new FakeSender();
    const useCase = new DispatchPendingPushesUseCase(pending, devices, sender, logger);

    await expect(useCase.execute()).rejects.toThrow('db down');

    expect(pending.released).toEqual(['n1', 'n2']);
    expect(sender.sent).toEqual([]);
  });
});
