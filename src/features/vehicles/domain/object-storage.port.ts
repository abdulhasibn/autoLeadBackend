export type VehicleStorageKind = 'media' | 'documents';

export interface SignedUploadTicket {
  readonly uploadUrl: string;
  readonly token: string;
}

export interface SignedReadUrl {
  readonly url: string;
}

export interface ObjectStoragePort {
  createSignedUpload(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedUploadTicket>;

  exists(kind: VehicleStorageKind, storagePath: string): Promise<boolean>;

  /**
   * The first `length` bytes of a stored object, or null when it is missing.
   * Throws when the object could not be read, so callers never accept a file
   * they could not inspect.
   */
  readHead(
    kind: VehicleStorageKind,
    storagePath: string,
    length: number,
  ): Promise<Uint8Array | null>;

  createSignedReadUrl(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedReadUrl>;

  /**
   * Signs many objects in one call. Keyed by storage path; a path the store
   * could not sign (for example, the object is gone) is absent from the map.
   */
  createSignedReadUrls(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePaths: readonly string[];
    readonly expiresInSeconds: number;
  }): Promise<ReadonlyMap<string, string>>;

  remove(kind: VehicleStorageKind, storagePath: string): Promise<void>;
}

export const SIGNED_UPLOAD_TTL_SECONDS = 15 * 60;
export const SIGNED_READ_TTL_SECONDS = 10 * 60;
