import type { RequestHandler } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { LookupContactByPhoneUseCase } from '../../application/use-cases/lookup-contact-by-phone.use-case';
import { phoneSchema } from '../schemas/lead-fields.schemas';

// Same rule as creating a lead: an Indian mobile in any common shape (422 otherwise).
const contactLookupQuerySchema = z.object({ phone: phoneSchema });

export class LookupContactByPhoneController {
  constructor(private readonly lookup: LookupContactByPhoneUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = contactLookupQuerySchema.parse(req.query);
        res.status(200).json(await this.lookup.execute(query.phone, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
