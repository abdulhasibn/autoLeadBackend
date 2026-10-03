import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { OwnerDto } from '../dtos/owner.dto';
import type { OwnerManagementPolicy } from '../policies/owner-management.policy';
import type { IOwnerQueries } from '../../domain/owner.queries';
import { toOwnerId } from '../../domain/owner-id';

export class GetOwnerUseCase {
  constructor(
    private readonly policy: OwnerManagementPolicy,
    private readonly queries: IOwnerQueries,
  ) {}

  async execute(ownerIdRaw: string, ctx: AuthenticatedContext): Promise<OwnerDto> {
    this.policy.requireAdminOrSalesperson(ctx);

    const owner = await this.queries.getOwner(toOwnerId(ownerIdRaw));
    if (owner === null) {
      throw new NotFoundError(`Owner not found for id ${ownerIdRaw}`);
    }

    return owner;
  }
}
