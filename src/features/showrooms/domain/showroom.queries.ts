import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface ShowroomReadModel {
  readonly id: string;
  readonly name: string;
  readonly city: string;
}

/** Read side for showroom pickers. Showrooms are managed outside the API for now. */
export interface IShowroomQueries {
  listActive(page: Pagination): Promise<Page<ShowroomReadModel>>;
}
