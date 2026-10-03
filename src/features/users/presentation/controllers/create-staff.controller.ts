import type { RequestHandler } from 'express';

import type { CreateStaffUseCase } from '../../application/use-cases/create-staff.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { createStaffBodySchema } from '../schemas/create-staff.schemas';

export class CreateStaffController {
  constructor(private readonly createStaff: CreateStaffUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createStaffBodySchema.parse(req.body);
        const staff = await this.createStaff.execute(
          {
            fullName: body.fullName,
            phone: body.phone,
            email: body.email,
            password: body.password,
            showroomId: body.showroomId,
            roles: body.roles,
          },
          ctx,
        );
        res.status(201).json(staff);
      } catch (err) {
        next(err);
      }
    };
  }
}
