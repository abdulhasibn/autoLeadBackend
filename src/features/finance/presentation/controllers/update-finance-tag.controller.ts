import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { UpdateFinanceTagUseCase } from '../../application/use-cases/update-finance-tag.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import {
  financeTagIdParamSchema,
  updateFinanceTagBodySchema,
} from '../schemas/finance-tag.schemas';

export class UpdateFinanceTagController {
  constructor(private readonly updateTag: UpdateFinanceTagUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = financeTagIdParamSchema.parse(req.params);
        const body = updateFinanceTagBodySchema.parse(req.body);
        const tag = await this.updateTag.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            tagId: params.id,
            ...(body.name === undefined ? {} : { name: body.name }),
            ...(body.color === undefined ? {} : { color: body.color }),
            ...(body.archived === undefined ? {} : { archived: body.archived }),
          },
          ctx,
        );
        res.status(200).json(tag);
      } catch (err) {
        next(err);
      }
    };
  }
}
