import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateLeadUseCase } from '../../application/use-cases/create-lead.use-case';
import { createLeadBodySchema } from '../schemas/create-lead.schemas';

export class CreateLeadController {
  constructor(private readonly createLead: CreateLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createLeadBodySchema.parse(req.body);
        const lead = await this.createLead.execute(body, ctx);
        res.status(201).json(lead);
      } catch (err) {
        next(err);
      }
    };
  }
}
