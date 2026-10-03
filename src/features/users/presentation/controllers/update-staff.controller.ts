import type { RequestHandler } from 'express';

import type { UpdateStaffUseCase } from '../../application/use-cases/update-staff.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { staffIdParamSchema } from '../schemas/staff-id.schemas';
import { updateStaffBodySchema } from '../schemas/update-staff.schemas';

export class UpdateStaffController {
  constructor(private readonly updateStaff: UpdateStaffUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = staffIdParamSchema.parse(req.params);
        const body = updateStaffBodySchema.parse(req.body);
        const staff = await this.updateStaff.execute(
          {
            userId: params.id,
            fullName: body.fullName,
            phone: body.phone,
            email: body.email,
            showroomId: body.showroomId,
          },
          ctx,
        );
        res.status(200).json(staff);
      } catch (err) {
        next(err);
      }
    };
  }
}
