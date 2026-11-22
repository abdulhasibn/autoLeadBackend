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
          res.status(201).json({ showroom: null });
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
          makeId: body.makeId,
          modelId: body.modelId,
          variantId: body.variantId,
          referenceVehicleId: body.referenceVehicleId,
        });
        // Same answer whether a lead was created or merged, and no lead id:
        // the response must not reveal whether a phone number is already a customer.
        res.status(201).json({ showroom: receipt.showroom });
      } catch (err) {
        next(err);
      }
    };
  }
}
