import type { RequestHandler } from 'express';

import type { ListStaffUseCase } from '../../application/use-cases/list-staff.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { listStaffQuerySchema } from '../schemas/list-staff.schemas';

export class ListStaffController {
  constructor(private readonly listStaff: ListStaffUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listStaffQuerySchema.parse(req.query);
        const page = await this.listStaff.execute(
          {
            role: query.role,
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
