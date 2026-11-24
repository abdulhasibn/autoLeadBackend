import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/**
 * Removes a sale recorded by mistake. Idempotent.
 *
 * With `withBuyerPayments` the payments recorded against the sale go too: the
 * sold lead's `sale` and `refund` entries and the car's unassigned ones (which
 * count as theirs on a sold car). Other leads' payments and refunds stay, owed
 * back to them (BE-77 §4.7). Payments go first, the sale last, so a failed delete is finished by
 * repeating the request.
 */
export class ClearVehicleSaleUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly deals: IVehicleDealRepository,
    private readonly sealer: VehicleDealSealer,
    private readonly clock: Clock,
    private readonly vehicles: Pick<IFinanceVehicleLookup, 'findMany'>,
    private readonly entries: Pick<IFinanceEntryQueries, 'scan'>,
    private readonly entryRepo: Pick<IFinanceEntryRepository, 'save'>,
    private readonly entrySealer: EntrySealer,
  ) {}

  async execute(
    command: {
      readonly sessionToken: string | null;
      readonly vehicleId: string;
      readonly withBuyerPayments?: boolean;
    },
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const vehicleId = toVehicleId(command.vehicleId);
    const [vehicle] = await this.vehicles.findMany([vehicleId]);
    if (vehicle === undefined) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }
    const sealed = await this.deals.find(vehicleId);
    if (sealed === null) {
      return;
    }
    const deal = this.sealer.open(sealed, cipher);
    if (deal.sale === null) {
      return;
    }

    if (command.withBuyerPayments === true) {
      const soldLeadId = vehicle.soldLeadId;
      const carSold = vehicle.status === 'sold';
      const now = this.clock.now();
      const doomed: FinanceEntry[] = [];
      for await (const page of this.entries.scan({ vehicleId })) {
        for (const row of page) {
          const entry = this.entrySealer.open(row, cipher);
          if (entry.purpose !== 'sale' && entry.purpose !== 'refund') continue;
          const theirs =
            (soldLeadId !== null && entry.leadId === soldLeadId) ||
            (entry.leadId === null && carSold);
          if (!theirs) continue;
          this.entrySealer.assertWritable(entry);
          doomed.push(entry);
        }
      }
      // Read everything first: deleting while a paged scan runs could skip rows.
      for (const entry of doomed) {
        entry.softDelete(now);
        await this.entryRepo.save(this.entrySealer.seal(entry, cipher));
      }
    }

    deal.clearSale(this.clock.now());
    await this.deals.save(this.sealer.seal(deal, cipher));
  }
}
