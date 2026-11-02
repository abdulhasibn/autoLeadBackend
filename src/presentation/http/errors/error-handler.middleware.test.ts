import { Writable } from 'node:stream';

import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../infrastructure/logging/logger';
import { createErrorHandlerMiddleware } from './error-handler.middleware';

function appWithCapturedLogs(): { app: express.Express; output: () => string } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'));
      callback();
    },
  });
  const logger = createLogger({ logLevel: 'info', nodeEnv: 'test' }, destination);
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.post('/echo', (_req, res) => {
    res.status(204).end();
  });
  app.use(createErrorHandlerMiddleware(logger));
  return { app, output: () => chunks.join('') };
}

describe('error handler: request bodies the JSON parser rejects', () => {
  it('answers 400 INVALID_JSON and never logs the body', async () => {
    const { app, output } = appWithCapturedLogs();

    const res = await supertest(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('"financeKey":"FK-SECRET-1234","amount":545000');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
    expect(output()).toContain('INVALID_JSON');
    expect(output()).not.toContain('FK-SECRET-1234');
    expect(output()).not.toContain('545000');
  });

  it('answers 413 for an oversized body', async () => {
    const { app } = appWithCapturedLogs();

    const res = await supertest(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ note: 'x'.repeat(2048) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
