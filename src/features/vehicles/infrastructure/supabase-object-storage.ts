import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  ObjectStoragePort,
  SignedReadUrl,
  SignedUploadTicket,
  VehicleStorageKind,
} from '../domain/object-storage.port';

const BUCKETS: Record<VehicleStorageKind, string> = {
  media: 'vehicle-media',
  documents: 'vehicle-documents',
};

export class SupabaseObjectStorage implements ObjectStoragePort {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async createSignedUpload(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedUploadTicket> {
    const { data, error } = await this.db.storage
      .from(BUCKETS[input.kind])
      .createSignedUploadUrl(input.storagePath);

    if (error !== null || data === null) {
      throw new DatabaseUnavailableError(
        `Failed to create signed upload URL: ${error?.message ?? 'no data'}`,
      );
    }

    return { uploadUrl: data.signedUrl, token: data.token };
  }

  async exists(kind: VehicleStorageKind, storagePath: string): Promise<boolean> {
    const slash = storagePath.lastIndexOf('/');
    const folder = slash === -1 ? '' : storagePath.slice(0, slash);
    const name = slash === -1 ? storagePath : storagePath.slice(slash + 1);
    const { data, error } = await this.db.storage.from(BUCKETS[kind]).list(folder, {
      search: name,
      limit: 20,
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to check stored object: ${error.message}`);
    }

    return (data ?? []).some((item) => item.name === name);
  }

  async createSignedReadUrl(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedReadUrl> {
    const { data, error } = await this.db.storage
      .from(BUCKETS[input.kind])
      .createSignedUrl(input.storagePath, input.expiresInSeconds);

    if (error !== null || data === null) {
      throw new DatabaseUnavailableError(
        `Failed to create signed read URL: ${error?.message ?? 'no data'}`,
      );
    }

    return { url: data.signedUrl };
  }

  async remove(kind: VehicleStorageKind, storagePath: string): Promise<void> {
    const { error } = await this.db.storage.from(BUCKETS[kind]).remove([storagePath]);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to remove stored object: ${error.message}`);
    }
  }
}
