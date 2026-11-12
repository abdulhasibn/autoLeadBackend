import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { OwnerManagementPolicy } from '../policies/owner-management.policy';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import type { IOwnerRepository } from '../../domain/owner.repository';
import type { IOwnerVehicleCount } from '../../domain/owner-vehicle-count.port';
import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';

export class DeactivateOwnerUseCase {
  constructor(
    private readonly policy: OwnerManagementPolicy,
    private readonly repo: IOwnerRepository,
    private readonly vehicles: IOwnerVehicleCount,
    private readonly clock: Clock,
  ) {}

  async execute(ownerIdRaw: string, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireAdmin(ctx);

    const owner = await this.repo.findById(toOwnerId(ownerIdRaw));
    if (owner === null) {
      throw new NotFoundError(`Owner not found for id ${ownerIdRaw}`);
    }

    const unsoldVehicleCount = await this.vehicles.countUnsold(owner.id);
    if (unsoldVehicleCount > 0) {
      throw new BusinessRuleViolationError(
        'OWNER_HAS_UNSOLD_VEHICLES',
        `This owner has ${unsoldVehicleCount} unsold car(s). Sell or drop them before deactivating the owner`,
        { unsoldVehicleCount },
      );
    }

    owner.deactivate(this.clock.now());
    await this.repo.save(owner, ctx.userId);
  }
}
