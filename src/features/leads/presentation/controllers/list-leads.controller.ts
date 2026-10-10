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
            preferredMakeId: query.preferredMakeId,
            preferredModelId: query.preferredModelId,
            preferredVariantId: query.preferredVariantId,
            search: query.search,
            budgetMin: query.budgetMin,
            budgetMax: query.budgetMax,
            sources: query.source,
            hasVehicle: query.hasVehicle,
            purchaseTimeline: query.purchaseTimeline,
            financeRequired: query.financeRequired,
            createdFrom: query.createdFrom,
            createdTo: query.createdTo,
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
