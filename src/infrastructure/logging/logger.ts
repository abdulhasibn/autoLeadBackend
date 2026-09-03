import pino from 'pino';

import type { AppConfig } from '../../config/environment';
import type { Logger } from '../../shared/logging/logger.port';

/**
 * The only file in the codebase that imports `pino`. Every other layer depends
 * on the `Logger` port — never on this module or on `pino` directly.
 */
export function createLogger(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>): Logger {
  const pinoLogger = pino({
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
      ],
      censor: '[REDACTED]',
    },
    transport:
      config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });

  return pinoLogger;
}
