import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { resolveShowroomId } from '../../../../domain/shared/resolve-showroom';
import type { ShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { assertTagsUsable } from '../../domain/finance-tag-rules';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
} from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import type { CreateFinanceEntryCommand } from '../dtos/create-finance-entry-command';
import { toFinanceEntryDto, type FinanceEntryDto } from '../dtos/finance-entry.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

/**
 * Records money in or out. With a car it lands in the car's showroom with the
 * car's default purpose; without one it's a business entry.
 */
export class CreateFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryRepository,
    private readonly tags: IFinanceTagRepository,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly entrySealer: EntrySealer,
    private readonly tagSealer: TagSealer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: CreateFinanceEntryCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const tagIds = command.tagIds.map(toFinanceTagId);
    const tags = this.tagSealer.openAll(await this.tags.findByIds(tagIds), cipher);
    const tagsById = new Map(tags.map((tag) => [tag.id as string, tag]));
    assertTagsUsable(tagIds, [], tagsById);

    let vehicle: FinanceVehicleFacts | null = null;
    let showroomId: ShowroomId;
    if (command.vehicleId === null) {
      showroomId = resolveShowroomId(ctx, command.showroomId);
    } else {
      vehicle = await this.vehicles.findLinkable(toVehicleId(command.vehicleId));
      if (vehicle === null) {
        throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
      }
      if (command.showroomId !== null && command.showroomId !== vehicle.showroomId) {
        throw new BusinessRuleViolationError(
          'ENTRY_SHOWROOM_FOLLOWS_VEHICLE',
          "A car-linked entry belongs to the car's showroom",
        );
      }
      showroomId = vehicle.showroomId;
    }

    const entry = FinanceEntry.create({
      id: toFinanceEntryId(this.ids.generate()),
      kind: command.kind,
      amount: Money.ofPaise(command.amountPaise),
      entryDate: CalendarDate.create(command.entryDate),
      purpose: command.purpose,
      tagIds,
      vehicleId: vehicle?.id ?? null,
      showroomId,
      party: command.party,
      note: command.note,
      recordedBy: ctx.userId,
      now: this.clock.now(),
    });
    await this.entries.save(this.entrySealer.seal(entry, cipher));

    const vehiclesById = new Map(vehicle === null ? [] : [[vehicle.id as string, vehicle]]);
    return toFinanceEntryDto(entry, tagsById, vehiclesById);
  }
}
