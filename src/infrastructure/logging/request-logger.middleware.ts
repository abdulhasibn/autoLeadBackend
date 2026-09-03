import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';
import pinoHttp from 'pino-http';

import { CORRELATION_ID_HEADER } from '../../config/constants';
import type { Logger } from '../../shared/logging/logger.port';
import { getRequestSpans } from '../../shared/timing/request-spans';

export function createRequestLoggerMiddleware(logger: Logger): RequestHandler {
  const httpLogger = pinoHttp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pino-http requires the concrete pino.Logger type.
    logger: logger as any,
    genReqId: (req) => {
      const inbound = req.headers[CORRELATION_ID_HEADER];
      return (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
    },
    customProps: () => {
      const spans = getRequestSpans();
      return Object.keys(spans).length === 0 ? {} : { spans };
    },
  });

  return (req, res, next) => {
    httpLogger(req, res, () => {
      res.setHeader(CORRELATION_ID_HEADER, String(req.id));
      next();
    });
  };
}
