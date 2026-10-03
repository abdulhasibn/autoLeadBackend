import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { MediaId } from '../domain/media-id';
import type { VehicleMedia } from '../domain/vehicle-media.entity';
import type { IVehicleMediaRepository } from '../domain/vehicle-media.repository';
import { translateVehicleWriteError } from './translate-vehicle-write-error';
import { toVehicleMedia, type VehicleMediaRow } from './vehicle-media.mapper';

const MEDIA_COLUMNS =
  'id, vehicle_id, storage_path, category, sort_order, uploaded_by, uploaded_at';

export class SupabaseVehicleMediaRepository implements IVehicleMediaRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: MediaId): Promise<VehicleMedia | null> {
    const { data, error } = await this.db
      .from('vehicle_media')
      .select(MEDIA_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle media: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toVehicleMedia(data as VehicleMediaRow);
  }

  async save(media: VehicleMedia): Promise<void> {
    const { error } = await this.db.from('vehicle_media').insert({
      id: media.id,
      vehicle_id: media.vehicleId,
      storage_path: media.storagePath.value,
      category: media.category.value,
      sort_order: media.sortOrder,
      uploaded_by: media.uploadedBy,
      uploaded_at: media.uploadedAt.toISOString(),
    });

    if (error !== null) {
      translateVehicleWriteError(
        error,
        'Failed to save vehicle media',
        'This file has already been attached',
      );
    }
  }

  async delete(id: MediaId): Promise<void> {
    const { error } = await this.db.from('vehicle_media').delete().eq('id', id);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to delete vehicle media: ${error.message}`);
    }
  }
}
