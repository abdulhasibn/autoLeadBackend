import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateFinanceEntryUseCase } from '../../application/use-cases/create-finance-entry.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { createFinanceEntryBodySchema } from '../schemas/finance-entry.schemas';

export class CreateFinanceEntryController {
  constructor(private readonly createEntry: CreateFinanceEntryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createFinanceEntryBodySchema.parse(req.body);
        const entry = await this.createEntry.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            kind: body.kind,
            amountPaise: body.amount,
            entryDate: body.entryDate,
            tagIds: body.tagIds,
            vehicleId: body.vehicleId,
            purpose: body.purpose,
            party: body.party,
            note: body.note,
            showroomId: body.showroomId,
          },
          ctx,
        );
        res.status(201).json(entry);
      } catch (err) {
        next(err);
      }
    };
  }
}
