import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { OwnerManagementPolicy } from '../policies/owner-management.policy';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import type { IOwnerRepository } from '../../domain/owner.repository';

export class DeactivateOwnerUseCase {
  constructor(
    private readonly policy: OwnerManagementPolicy,
    private readonly repo: IOwnerRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerIdRaw: string, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireAdmin(ctx);

    const owner = await this.repo.findById(toOwnerId(ownerIdRaw));
    if (owner === null) {
      throw new NotFoundError(`Owner not found for id ${ownerIdRaw}`);
    }

    owner.deactivate(this.clock.now());
    await this.repo.save(owner, ctx.userId);
  }
}
