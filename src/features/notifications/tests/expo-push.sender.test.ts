import { describe, expect, it } from 'vitest';

import type { Logger } from '../../../shared/logging/logger.port';
import type { PushMessage } from '../domain/push.ports';
import { ExpoPushSender } from '../infrastructure/expo-push.sender';

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => logger,
};

const messages = (count: number): PushMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    to: `ExponentPushToken[t${i}]`,
    title: 'T',
    body: null,
    data: {},
  }));

describe('ExpoPushSender', () => {
  it('keeps sending later chunks and keeps dead tokens when one chunk fails', async () => {
    let call = 0;
    const sender = new ExpoPushSender(null, logger, async () => {
      call += 1;
      if (call === 2) throw new Error('network');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: call === 1 ? [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] : [],
        }),
      };
    });

    const report = await sender.send(messages(250)); // 3 chunks of 100/100/50

    expect(call).toBe(3);
    expect(report.invalidTokens).toEqual(['ExponentPushToken[t0]']);
  });
});
