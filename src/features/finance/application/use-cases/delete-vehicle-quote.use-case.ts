import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import { toVehicleQuoteId } from '../../domain/vehicle-quote-id';
import type { IVehicleQuoteRepository } from '../../domain/vehicle-quote.repository';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { QuoteSealer } from '../services/quote.sealer';

export class DeleteVehicleQuoteUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly quotes: IVehicleQuoteRepository,
    private readonly sealer: QuoteSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: {
      readonly sessionToken: string | null;
      readonly vehicleId: string;
      readonly quoteId: string;
    },
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const sealed = await this.quotes.findById(toVehicleQuoteId(command.quoteId));
    if (sealed === null || sealed.vehicleId !== command.vehicleId) {
      throw new NotFoundError(`Quote not found for id ${command.quoteId}`);
    }
    const quote = this.sealer.open(sealed, cipher);
    quote.softDelete(this.clock.now());
    await this.quotes.save(this.sealer.seal(quote, cipher));
  }
}
