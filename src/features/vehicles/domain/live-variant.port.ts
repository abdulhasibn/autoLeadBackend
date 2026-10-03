import type { VariantId } from './variant-id';

export interface ILiveVariantLookup {
  isLive(variantId: VariantId): Promise<boolean>;
}
