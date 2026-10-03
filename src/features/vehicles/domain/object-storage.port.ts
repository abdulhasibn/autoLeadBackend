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

  createSignedReadUrl(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedReadUrl>;

  remove(kind: VehicleStorageKind, storagePath: string): Promise<void>;
}

export const SIGNED_UPLOAD_TTL_SECONDS = 15 * 60;
export const SIGNED_READ_TTL_SECONDS = 10 * 60;
