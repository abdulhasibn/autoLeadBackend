import type { RequestHandler } from 'express';

import type { ReplaceStaffRolesUseCase } from '../../application/use-cases/replace-staff-roles.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { replaceStaffRolesBodySchema } from '../schemas/replace-staff-roles.schemas';
import { staffIdParamSchema } from '../schemas/staff-id.schemas';

export class ReplaceStaffRolesController {
  constructor(private readonly replaceStaffRoles: ReplaceStaffRolesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = staffIdParamSchema.parse(req.params);
        const body = replaceStaffRolesBodySchema.parse(req.body);
        const staff = await this.replaceStaffRoles.execute(
          { userId: params.id, roles: body.roles },
          ctx,
        );
        res.status(200).json(staff);
      } catch (err) {
        next(err);
      }
    };
  }
}
