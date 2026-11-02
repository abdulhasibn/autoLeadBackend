import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { assertTagsUsable } from '../../domain/finance-tag-rules';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { toFinanceEntryDto, type FinanceEntryDto } from '../dtos/finance-entry.dto';
import type { UpdateFinanceEntryCommand } from '../dtos/update-finance-entry-command';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

/**
 * Edits an entry. Sending `vehicleId` links, moves or (with null) unlinks it;
 * the purpose then resets to the default unless `purpose` is sent too.
 */
export class UpdateFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryRepository,
    private readonly tags: IFinanceTagRepository,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly entrySealer: EntrySealer,
    private readonly tagSealer: TagSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: UpdateFinanceEntryCommand,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const sealed = await this.entries.findById(toFinanceEntryId(command.entryId));
    if (sealed === null) {
      throw new NotFoundError(`Finance entry not found for id ${command.entryId}`);
    }
    const entry = this.entrySealer.open(sealed, cipher);
    const now = this.clock.now();

    if (command.amountPaise !== undefined) {
      entry.changeAmount(Money.ofPaise(command.amountPaise), now);
    }
    if (command.entryDate !== undefined) {
      entry.changeDate(CalendarDate.create(command.entryDate), now);
    }
    if (command.party !== undefined) {
      entry.changeParty(command.party, now);
    }
    if (command.note !== undefined) {
      entry.changeNote(command.note, now);
    }

    if (command.vehicleId === null) {
      entry.unlink(
        command.showroomId === undefined ? entry.showroomId : toShowroomId(command.showroomId),
        now,
      );
      if (command.purpose !== undefined) {
        entry.changePurpose(command.purpose, now);
      }
    } else if (command.vehicleId !== undefined) {
      const vehicle = await this.vehicles.findLinkable(toVehicleId(command.vehicleId));
      if (vehicle === null) {
        throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
      }
      entry.linkToVehicle(vehicle.id, vehicle.showroomId, command.purpose ?? null, now);
      if (command.showroomId !== undefined) {
        entry.moveToShowroom(toShowroomId(command.showroomId), now);
      }
    } else {
      if (command.purpose !== undefined) {
        entry.changePurpose(command.purpose, now);
      }
      if (command.showroomId !== undefined) {
        entry.moveToShowroom(toShowroomId(command.showroomId), now);
      }
    }

    const nextTagIds = command.tagIds?.map(toFinanceTagId) ?? entry.tagIds;
    const tags = this.tagSealer.openAll(await this.tags.findByIds(nextTagIds), cipher);
    const tagsById = new Map(tags.map((tag) => [tag.id as string, tag]));
    if (command.tagIds !== undefined) {
      assertTagsUsable(nextTagIds, entry.tagIds, tagsById);
      entry.retag(nextTagIds, now);
    }

    await this.entries.save(this.entrySealer.seal(entry, cipher));

    const vehicles =
      entry.vehicleId === null ? [] : await this.vehicles.findMany([entry.vehicleId]);
    return toFinanceEntryDto(entry, tagsById, new Map(vehicles.map((v) => [v.id as string, v])));
  }
}
