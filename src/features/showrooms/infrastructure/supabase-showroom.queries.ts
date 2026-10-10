import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IShowroomQueries, ShowroomReadModel } from '../domain/showroom.queries';

export class SupabaseShowroomQueries implements IShowroomQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listActive(page: Pagination): Promise<Page<ShowroomReadModel>> {
    const { data, error, count } = await this.db
      .from('showrooms')
      .select('id, name, city', { count: 'exact' })
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list showrooms: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({ id: row.id, name: row.name, city: row.city }));
    return toPage(items, count ?? items.length, page);
  }
}
