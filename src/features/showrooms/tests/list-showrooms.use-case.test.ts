import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { ShowroomDirectoryPolicy } from '../application/policies/showroom-directory.policy';
import { ListShowroomsUseCase } from '../application/use-cases/list-showrooms.use-case';
import type { IShowroomQueries, ShowroomReadModel } from '../domain/showroom.queries';

class FakeShowroomQueries implements IShowroomQueries {
  constructor(private readonly items: ShowroomReadModel[]) {}

  async listActive(page: Pagination): Promise<Page<ShowroomReadModel>> {
    return toPage(this.items.slice(page.offset, page.offset + page.limit), this.items.length, page);
  }
}

const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

describe('ListShowroomsUseCase', () => {
  const useCase = new ListShowroomsUseCase(
    new ShowroomDirectoryPolicy(),
    new FakeShowroomQueries([{ id: 's1', name: 'Wheels Expert Kochi', city: 'Kochi' }]),
  );

  it('lets any staff member list showrooms', async () => {
    const page = await useCase.execute({ limit: 20, offset: 0 }, SALESPERSON);
    expect(page).toEqual({
      items: [{ id: 's1', name: 'Wheels Expert Kochi', city: 'Kochi' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(
        { limit: 20, offset: 0 },
        { userId: toUserId('cccc'), roles: ['buyer'], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
