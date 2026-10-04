import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListLeadsUseCase } from '../../application/use-cases/list-leads.use-case';
import { listLeadsQuerySchema } from '../schemas/list-leads.schemas';

export class ListLeadsController {
  constructor(private readonly listLeads: ListLeadsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listLeadsQuerySchema.parse(req.query);
        const page = await this.listLeads.execute(
          {
            status: query.status,
            vehicleId: query.vehicleId,
            assignedTo: query.assignedTo,
            page: { limit: query.limit, offset: query.offset },
          },
          ctx,
        );
        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    };
  }
}
