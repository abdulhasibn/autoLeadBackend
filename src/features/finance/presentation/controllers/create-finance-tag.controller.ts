import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateFinanceTagUseCase } from '../../application/use-cases/create-finance-tag.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { createFinanceTagBodySchema } from '../schemas/finance-tag.schemas';

export class CreateFinanceTagController {
  constructor(private readonly createTag: CreateFinanceTagUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createFinanceTagBodySchema.parse(req.body);
        const tag = await this.createTag.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            name: body.name,
            color: body.color ?? null,
          },
          ctx,
        );
        res.status(201).json(tag);
      } catch (err) {
        next(err);
      }
    };
  }
}
