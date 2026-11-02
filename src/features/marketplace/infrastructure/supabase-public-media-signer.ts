import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import {
  PUBLIC_SIGNED_READ_TTL_SECONDS,
  type IPublicMediaSigner,
} from '../domain/public-media-signer.port';

const MEDIA_BUCKET = 'vehicle-media';

export class SupabasePublicMediaSigner implements IPublicMediaSigner {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async sign(storagePaths: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (storagePaths.length === 0) {
      return new Map();
    }

    const { data, error } = await this.db.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls([...storagePaths], PUBLIC_SIGNED_READ_TTL_SECONDS);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to sign vehicle photos: ${error.message}`);
    }

    const urls = new Map<string, string>();
    for (const item of data) {
      if (item.error === null && item.path !== null && item.signedUrl !== null) {
        urls.set(item.path, item.signedUrl);
      }
    }
    return urls;
  }
}
