export interface PreferredCatalogProps {
  readonly makeId: string | null;
  readonly modelId: string | null;
  readonly variantId: string | null;
}

/**
 * The catalog interest a buyer named: make, optionally narrowed to a model,
 * optionally narrowed to a variant. A narrower level never stands alone, so
 * filtering by make also finds leads that picked a model or variant of it.
 * Whether the three ids actually belong together is checked against the
 * catalog before this is built.
 */
export class PreferredCatalog {
  private constructor(
    readonly makeId: string | null,
    readonly modelId: string | null,
    readonly variantId: string | null,
  ) {}

  static none(): PreferredCatalog {
    return new PreferredCatalog(null, null, null);
  }

  static create(props: PreferredCatalogProps): PreferredCatalog {
    if (props.variantId !== null && props.modelId === null) {
      throw new Error('A preferred variant needs its model');
    }
    if (props.modelId !== null && props.makeId === null) {
      throw new Error('A preferred model needs its make');
    }
    return new PreferredCatalog(props.makeId, props.modelId, props.variantId);
  }

  get isEmpty(): boolean {
    return this.makeId === null;
  }

  equals(other: PreferredCatalog): boolean {
    return (
      this.makeId === other.makeId &&
      this.modelId === other.modelId &&
      this.variantId === other.variantId
    );
  }
}
