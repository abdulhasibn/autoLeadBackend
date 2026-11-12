import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { IRecordedSaleLookup } from '../../domain/recorded-sale-lookup.port';
import type { IVehicleSale } from '../../domain/vehicle-sale.port';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';

/**
 * Admin undo of a mistaken conversion: the lead goes back to a confirmed
 * booking and its car from `sold` to `linked`. Refused while finance still
 * has the sale price (remove it there first). Leads the sale moved to
 * `vehicle_unavailable` and follow-ups it cancelled stay as they are.
 *
 * The car is released before the lead is saved and both steps are
 * idempotent, so repeating a failed request finishes the job (ADR-0011).
 */
export class ReopenConvertedLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicleSale: IVehicleSale,
    private readonly recordedSales: IRecordedSaleLookup,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: { readonly leadId: string; readonly notes: string | null },
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string }> {
    this.policy.requireAdmin(ctx, 'Only an admin can undo a sale');

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    const now = this.clock.now();
    // Validates converted + has a vehicle before anything is written.
    lead.reopenConversion(now);
    const vehicleId = lead.vehicleId;
    if (vehicleId === null) {
      throw new Error('A reopened lead always has a vehicle');
    }
    if (await this.recordedSales.hasRecordedSale(vehicleId)) {
      throw new BusinessRuleViolationError(
        'SALE_PRICE_RECORDED',
        'Remove the sale price in Finance before undoing this sale',
      );
    }

    await this.vehicleSale.unmarkSold(
      vehicleId,
      lead.id,
      ctx.userId,
      `Sale undone (lead ${lead.id})`,
    );
    await this.repo.save(lead, {
      actorId: ctx.userId,
      statusNotes: command.notes ?? 'Sale undone',
    });
    await this.vehicleLinks.refresh(vehicleId, ctx.userId);
    return { status: lead.status.value };
  }
}
