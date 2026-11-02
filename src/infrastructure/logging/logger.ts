import pino from 'pino';

import type { AppConfig } from '../../config/environment';
import type { Logger } from '../../shared/logging/logger.port';

/**
 * The only file in the codebase that imports `pino`. Every other layer depends
 * on the `Logger` port — never on this module or on `pino` directly.
 */
export function createLogger(
  config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>,
  destination?: pino.DestinationStream,
): Logger {
  const options: pino.LoggerOptions = {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.otp',
        '*.serviceRoleKey',
        '*.jwtSecret',
        // Finance (ADR-0014): keys, session tokens and sealed payloads never reach logs.
        'req.headers["x-finance-session"]',
        '*.financeKey',
        '*.currentKey',
        '*.recoveryKey',
        '*.sessionToken',
        '*.payload',
        '*.dek',
      ],
      censor: '[REDACTED]',
    },
    transport:
      config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  };

  return destination === undefined ? pino(options) : pino(options, destination);
}
