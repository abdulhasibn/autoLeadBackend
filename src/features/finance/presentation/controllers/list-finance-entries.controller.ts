import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListFinanceEntriesUseCase } from '../../application/use-cases/list-finance-entries.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { listFinanceEntriesQuerySchema } from '../schemas/finance-entry.schemas';

export class ListFinanceEntriesController {
  constructor(private readonly listEntries: ListFinanceEntriesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const q = listFinanceEntriesQuerySchema.parse(req.query);
        const page = await this.listEntries.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            ...(q.from === undefined ? {} : { from: q.from }),
            ...(q.to === undefined ? {} : { to: q.to }),
            ...(q.kind === undefined ? {} : { kind: q.kind }),
            ...(q.vehicleId === undefined ? {} : { vehicleId: q.vehicleId }),
            ...(q.unlinked === undefined ? {} : { unlinked: q.unlinked }),
            ...(q.showroomId === undefined ? {} : { showroomId: q.showroomId }),
            ...(q.tagId === undefined ? {} : { tagIds: q.tagId }),
            ...(q.purpose === undefined ? {} : { purposes: q.purpose }),
            ...(q.minAmount === undefined ? {} : { minAmountPaise: q.minAmount }),
            ...(q.maxAmount === undefined ? {} : { maxAmountPaise: q.maxAmount }),
            ...(q.search === undefined ? {} : { search: q.search }),
            sort: q.sort,
            limit: q.limit,
            offset: q.offset,
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
