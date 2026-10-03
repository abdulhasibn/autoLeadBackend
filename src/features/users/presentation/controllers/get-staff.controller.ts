import type { RequestHandler } from 'express';

import type { GetStaffUseCase } from '../../application/use-cases/get-staff.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { staffIdParamSchema } from '../schemas/staff-id.schemas';

export class GetStaffController {
  constructor(private readonly getStaff: GetStaffUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = staffIdParamSchema.parse(req.params);
        const staff = await this.getStaff.execute(params.id, ctx);
        res.status(200).json(staff);
      } catch (err) {
        next(err);
      }
    };
  }
}
