import type { RequestHandler } from 'express';

import type { DeactivateStaffUseCase } from '../../application/use-cases/deactivate-staff.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { staffIdParamSchema } from '../schemas/staff-id.schemas';

export class DeactivateStaffController {
  constructor(private readonly deactivateStaff: DeactivateStaffUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = staffIdParamSchema.parse(req.params);
        await this.deactivateStaff.execute(params.id, ctx);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
