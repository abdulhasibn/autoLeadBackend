import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import type { Clock } from '../../../../shared/clock/clock';
import type { UpdateOwnerCommand } from '../dtos/update-owner-command';
import type { OwnerDto } from '../dtos/owner.dto';
import { toOwnerDto } from '../dtos/owner.dto';
import type { OwnerManagementPolicy } from '../policies/owner-management.policy';
import { parsePreferredContactMethod } from '../../domain/owner.entity';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import type { IOwnerRepository } from '../../domain/owner.repository';

export class UpdateOwnerUseCase {
  constructor(
    private readonly policy: OwnerManagementPolicy,
    private readonly repo: IOwnerRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateOwnerCommand, ctx: AuthenticatedContext): Promise<OwnerDto> {
    this.policy.requireAdminOrSalesperson(ctx);

    const owner = await this.repo.findById(toOwnerId(command.ownerId));
    if (owner === null) {
      throw new NotFoundError(`Owner not found for id ${command.ownerId}`);
    }

    owner.updateProfile({
      fullName: command.fullName,
      phone: Phone.create(command.phone),
      email: parseOptionalEmail(command.email),
      address: command.address,
      city: command.city,
      preferredContactMethod: parsePreferredContactMethod(command.preferredContactMethod),
      altPhone: parseOptionalPhone(command.altPhone),
      idInfo: command.idInfo,
      notes: command.notes,
      updatedAt: this.clock.now(),
    });

    await this.repo.save(owner, ctx.userId);
    return toOwnerDto(owner);
  }
}

function parseOptionalEmail(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  return Email.create(input).value;
}

function parseOptionalPhone(input: string | null): Phone | null {
  if (input === null) {
    return null;
  }
  return Phone.create(input);
}
