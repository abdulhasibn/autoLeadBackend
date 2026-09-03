/**
 * Generic branded-type helper. Every feature defines its own domain id types on top of this.
 */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };
