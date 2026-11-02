import { createHmac } from 'node:crypto';

import type { RequestHandler } from 'express';

import type { SubmitTestDriveUseCase } from '../../application/use-cases/submit-test-drive.use-case';
import { submitTestDriveBodySchema } from '../schemas/public-marketplace.schemas';

export class SubmitTestDriveController {
  /** @param ipHashKey keys the IP hash so stored rate-limit keys cannot be reversed. */
  constructor(
    private readonly submitTestDrive: SubmitTestDriveUseCase,
    private readonly ipHashKey: string,
  ) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = submitTestDriveBodySchema.parse(req.body);

        // A filled honeypot is a bot: answer like a success, record nothing.
        if (body.fax !== undefined && body.fax.trim() !== '') {
          res.status(201).json({ outcome: 'created', vehicleAvailable: true, showroom: null });
          return;
        }

        const receipt = await this.submitTestDrive.execute({
          vehicleId: body.vehicleId,
          fullName: body.fullName,
          phone: body.phone,
          ipHash: createHmac('sha256', this.ipHashKey)
            .update(req.ip ?? 'unknown')
            .digest('hex'),
        });
        res.status(receipt.outcome === 'created' ? 201 : 200).json(receipt);
      } catch (err) {
        next(err);
      }
    };
  }
}
