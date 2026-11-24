import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { UpdateFinanceEntryUseCase } from '../../application/use-cases/update-finance-entry.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import {
  financeEntryIdParamSchema,
  toDealTermsInput,
  updateFinanceEntryBodySchema,
} from '../schemas/finance-entry.schemas';

export class UpdateFinanceEntryController {
  constructor(private readonly updateEntry: UpdateFinanceEntryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = financeEntryIdParamSchema.parse(req.params);
        const b = updateFinanceEntryBodySchema.parse(req.body);
        const entry = await this.updateEntry.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            entryId: params.id,
            ...(b.amount === undefined ? {} : { amountPaise: b.amount }),
            ...(b.entryDate === undefined ? {} : { entryDate: b.entryDate }),
            ...(b.tagIds === undefined ? {} : { tagIds: b.tagIds }),
            ...(b.vehicleId === undefined ? {} : { vehicleId: b.vehicleId }),
            ...(b.purpose === undefined ? {} : { purpose: b.purpose }),
            ...(b.leadId === undefined ? {} : { leadId: b.leadId }),
            ...(b.keepLead === undefined ? {} : { keepLead: b.keepLead }),
            ...(b.party === undefined ? {} : { party: b.party }),
            ...(b.note === undefined ? {} : { note: b.note }),
            ...(b.showroomId === undefined ? {} : { showroomId: b.showroomId }),
            ...(b.deal === undefined ? {} : { deal: toDealTermsInput(b.deal) }),
            ...(b.keepOverpayment === undefined ? {} : { keepOverpayment: b.keepOverpayment }),
          },
          ctx,
        );
        res.status(200).json(entry);
      } catch (err) {
        next(err);
      }
    };
  }
}
