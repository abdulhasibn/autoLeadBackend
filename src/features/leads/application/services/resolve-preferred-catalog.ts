import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { ICatalogLineageLookup } from '../../domain/catalog-lineage.port';
import { PreferredCatalog } from '../../domain/preferred-catalog.value-object';

export interface PreferredCatalogInput {
  readonly makeId: string | null;
  readonly modelId: string | null;
  readonly variantId: string | null;
}

/**
 * Turns the ids a client picked into a full make → model → variant chain.
 * The narrowest id wins and its parents are filled in from the catalog, so a
 * client may send only a variant. Any parent the client also sent must match.
 */
export async function resolvePreferredCatalog(
  catalog: ICatalogLineageLookup,
  input: PreferredCatalogInput,
): Promise<PreferredCatalog> {
  if (input.variantId !== null) {
    const lineage = await catalog.variantLineage(input.variantId);
    if (lineage === null) {
      throw new NotFoundError(`Variant not found for id ${input.variantId}`);
    }
    requireMatch('model', input.modelId, lineage.modelId);
    requireMatch('make', input.makeId, lineage.makeId);
    return PreferredCatalog.create({
      makeId: lineage.makeId,
      modelId: lineage.modelId,
      variantId: input.variantId,
    });
  }

  if (input.modelId !== null) {
    const lineage = await catalog.modelLineage(input.modelId);
    if (lineage === null) {
      throw new NotFoundError(`Model not found for id ${input.modelId}`);
    }
    requireMatch('make', input.makeId, lineage.makeId);
    return PreferredCatalog.create({
      makeId: lineage.makeId,
      modelId: input.modelId,
      variantId: null,
    });
  }

  if (input.makeId !== null) {
    if (!(await catalog.isLiveMake(input.makeId))) {
      throw new NotFoundError(`Make not found for id ${input.makeId}`);
    }
    return PreferredCatalog.create({ makeId: input.makeId, modelId: null, variantId: null });
  }

  return PreferredCatalog.none();
}

function requireMatch(level: 'make' | 'model', sent: string | null, actual: string): void {
  if (sent !== null && sent !== actual) {
    throw new BusinessRuleViolationError(
      'PREFERRED_CATALOG_MISMATCH',
      `The preferred ${level} does not match the catalog entry below it`,
    );
  }
}
