import type { RequestHandler } from 'express';

import type { GetPublicCatalogUseCase } from '../../application/use-cases/get-public-catalog.use-case';
import {
  publicMakeIdParamSchema,
  publicModelIdParamSchema,
} from '../schemas/public-marketplace.schemas';

// Reference data changes rarely: let a CDN or the website's fetch cache absorb reads.
const CATALOG_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

export class PublicCatalogController {
  constructor(private readonly catalog: GetPublicCatalogUseCase) {}

  makes(): RequestHandler {
    return async (_req, res, next) => {
      try {
        const items = await this.catalog.makes();
        res.set('Cache-Control', CATALOG_CACHE_CONTROL).status(200).json({ items });
      } catch (err) {
        next(err);
      }
    };
  }

  models(): RequestHandler {
    return async (req, res, next) => {
      try {
        const { makeId } = publicMakeIdParamSchema.parse(req.params);
        const items = await this.catalog.models(makeId);
        res.set('Cache-Control', CATALOG_CACHE_CONTROL).status(200).json({ items });
      } catch (err) {
        next(err);
      }
    };
  }

  variants(): RequestHandler {
    return async (req, res, next) => {
      try {
        const { modelId } = publicModelIdParamSchema.parse(req.params);
        const items = await this.catalog.variants(modelId);
        res.set('Cache-Control', CATALOG_CACHE_CONTROL).status(200).json({ items });
      } catch (err) {
        next(err);
      }
    };
  }
}
