export interface SignedUploadDto {
  readonly storagePath: string;
  readonly uploadUrl: string;
  readonly token: string;
  readonly expiresAt: string;
}
