import type { OutgoingHttpHeaders } from 'node:http';

import type { RequestHandler } from 'express';

import { enterRequestSpans, formatServerTimingHeader } from '../../../shared/timing/request-spans';

export function createServerTimingMiddleware(): RequestHandler {
  return (_req, res, next) => {
    const store = enterRequestSpans();
    const startedAt = performance.now();
    const originalWriteHead = res.writeHead.bind(res);
    const originalEnd = res.end.bind(res);

    const applyTotal = (): void => {
      if (store.spans.total !== undefined) {
        return;
      }
      store.spans.total = Math.round(performance.now() - startedAt);
      const value = formatServerTimingHeader(store.spans);
      if (value !== '' && !res.headersSent) {
        res.setHeader('Server-Timing', value);
      }
    };

    res.writeHead = ((
      statusCode: number,
      reasonOrHeaders?: string | OutgoingHttpHeaders,
      maybeHeaders?: OutgoingHttpHeaders,
    ) => {
      applyTotal();
      if (typeof reasonOrHeaders === 'string') {
        return originalWriteHead(statusCode, reasonOrHeaders, maybeHeaders);
      }
      return originalWriteHead(statusCode, reasonOrHeaders);
    }) as typeof res.writeHead;

    res.end = ((...args: Parameters<typeof res.end>) => {
      applyTotal();
      return originalEnd(...args);
    }) as typeof res.end;

    next();
  };
}
