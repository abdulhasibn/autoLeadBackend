import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { Money } from '../../domain/money.value-object';
import { toVehicleQuoteId } from '../../domain/vehicle-quote-id';
import { VehicleQuote } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteRepository } from '../../domain/vehicle-quote.repository';
import type { AddVehicleQuoteCommand } from '../dtos/add-vehicle-quote-command';
import { toVehicleQuoteDto, type VehicleQuoteDto } from '../dtos/vehicle-quote.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { QuoteSealer } from '../services/quote.sealer';

/** Records a price offered to a person. An unknown lead id is rejected by the database (404). */
export class AddVehicleQuoteUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly quotes: IVehicleQuoteRepository,
    private readonly sealer: QuoteSealer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: AddVehicleQuoteCommand,
    ctx: AuthenticatedContext,
  ): Promise<VehicleQuoteDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const vehicleId = toVehicleId(command.vehicleId);
    if ((await this.vehicles.findLinkable(vehicleId)) === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }
    const quote = VehicleQuote.create({
      id: toVehicleQuoteId(this.ids.generate()),
      vehicleId,
      leadId: command.leadId === null ? null : toLeadId(command.leadId),
      quotedOn: CalendarDate.create(command.quotedOn),
      amount: Money.ofPaise(command.amountPaise),
      quotedTo: command.quotedTo,
      note: command.note,
      createdBy: ctx.userId,
      createdAt: this.clock.now(),
    });
    await this.quotes.save(this.sealer.seal(quote, cipher));
    return toVehicleQuoteDto(quote);
  }
}
