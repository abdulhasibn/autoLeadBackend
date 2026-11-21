import type { RequestHandler } from 'express';

import { hashClientIp } from '../../../../presentation/http/client-ip-hash';
import type { SubmitPreferenceUseCase } from '../../application/use-cases/submit-preference.use-case';
import { submitPreferenceBodySchema } from '../schemas/public-marketplace.schemas';

export class SubmitPreferenceController {
  /** @param ipHashKey keys the IP hash so stored rate-limit keys cannot be reversed. */
  constructor(
    private readonly submitPreference: SubmitPreferenceUseCase,
    private readonly ipHashKey: string,
  ) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = submitPreferenceBodySchema.parse(req.body);

        // A filled honeypot is a bot: answer like a success, record nothing.
        if (body.fax !== undefined && body.fax.trim() !== '') {
          res.status(201).json({ outcome: 'created', showroom: null });
          return;
        }

        const receipt = await this.submitPreference.execute({
          fullName: body.fullName,
          phone: body.phone,
          ipHash: hashClientIp(req, this.ipHashKey),
          attribution: body.attribution,
          budgetMax: body.budgetMax,
          bodyTypes: body.bodyTypes,
          fuelTypes: body.fuelTypes,
          transmissions: body.transmissions,
          make: body.make,
          model: body.model,
          referenceVehicleId: body.referenceVehicleId,
        });
        res.status(receipt.outcome === 'created' ? 201 : 200).json(receipt);
      } catch (err) {
        next(err);
      }
    };
  }
}
