import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { RegisterPushDeviceUseCase } from '../../application/use-cases/register-push-device.use-case';
import type { UnregisterPushDeviceUseCase } from '../../application/use-cases/unregister-push-device.use-case';
import {
  registerPushDeviceBodySchema,
  unregisterPushDeviceQuerySchema,
} from '../schemas/push-device.schemas';

export class PushDeviceController {
  constructor(
    private readonly register: RegisterPushDeviceUseCase,
    private readonly unregister: UnregisterPushDeviceUseCase,
  ) {}

  handleRegister(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = registerPushDeviceBodySchema.parse(req.body);
        await this.register.execute(body, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }

  handleUnregister(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = unregisterPushDeviceQuerySchema.parse(req.query);
        await this.unregister.execute(query.token, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }
}
