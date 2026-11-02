import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger } from './logger';

function captureLogger(): { logger: ReturnType<typeof createLogger>; output: () => string } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'));
      callback();
    },
  });
  const logger = createLogger({ logLevel: 'info', nodeEnv: 'test' }, destination);
  return { logger, output: () => chunks.join('') };
}

describe('createLogger redaction', () => {
  it('never writes finance keys, session tokens or sealed payloads', () => {
    const { logger, output } = captureLogger();
    const financeKey = 'FK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF';
    const recoveryKey = 'RK-1111-2222-3333';
    const sessionToken = '11111111-1111-4111-8111-000000000001.c2VjcmV0LXNlc3Npb24';

    logger.info(
      {
        req: { headers: { 'x-finance-session': sessionToken, authorization: 'Bearer jwt' } },
        body: { financeKey, currentKey: financeKey, recoveryKey },
        result: { sessionToken, payload: 'v1.1.c2VhbGVk' },
      },
      'finance request',
    );

    const written = output();
    expect(written).toContain('finance request');
    for (const secret of [financeKey, recoveryKey, sessionToken, 'v1.1.c2VhbGVk', 'Bearer jwt']) {
      expect(written).not.toContain(secret);
    }
  });
});
