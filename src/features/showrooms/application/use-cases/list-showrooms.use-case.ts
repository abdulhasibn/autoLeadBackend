import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { ShowroomDirectoryPolicy } from '../policies/showroom-directory.policy';
import type { IShowroomQueries, ShowroomReadModel } from '../../domain/showroom.queries';

export class ListShowroomsUseCase {
  constructor(
    private readonly policy: ShowroomDirectoryPolicy,
    private readonly queries: IShowroomQueries,
  ) {}

  async execute(page: Pagination, ctx: AuthenticatedContext): Promise<Page<ShowroomReadModel>> {
    this.policy.requireStaff(ctx);
    return this.queries.listActive(page);
  }
}
