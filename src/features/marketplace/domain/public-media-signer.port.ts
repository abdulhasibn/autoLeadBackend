/**
 * Signs private vehicle photos for anonymous viewers. Public pages are cached
 * by the website for minutes, so these URLs live far longer than staff ones.
 */
export interface IPublicMediaSigner {
  /** Keyed by storage path; a path that could not be signed is absent. */
  sign(storagePaths: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export const PUBLIC_SIGNED_READ_TTL_SECONDS = 24 * 60 * 60;
