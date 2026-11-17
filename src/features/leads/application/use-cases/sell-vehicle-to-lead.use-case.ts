import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId, type VehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import { InvalidLeadStatusTransitionError } from '../../domain/errors/invalid-lead-status-transition.error';
import type { ILeadRepository } from '../../domain/lead.repository';
import { LeadStatus } from '../../domain/lead-status.value-object';
import type { ILinkableVehicleLookup } from '../../domain/linkable-vehicle.port';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { requireLinkableVehicle } from '../services/require-linkable-vehicle';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';
import type { AssociateLeadVehicleUseCase } from './associate-lead-vehicle.use-case';
import type { ChangeLeadStatusUseCase } from './change-lead-status.use-case';

export interface SellVehicleToLeadCommand {
  readonly leadId: string;
  readonly vehicleId: string;
  readonly notes: string | null;
}

/**
 * "Mark as sold" in one request (#33): links the car to the lead, confirms
 * the booking and converts the lead, which marks the car sold (ADR-0011).
 *
 * Everything that can be checked is checked before the first write: the lead
 * is open and the staff member may work it, the car can be linked, and the
 * lead can move to a confirmed booking. If a later step still fails, the lead
 * is put back to its old status and car, unless the conversion already got
 * as far as selling the car: then repeating the request finishes the sale.
 * Selling to a lead already converted on this car answers like a success.
 */
export class SellVehicleToLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicles: ILinkableVehicleLookup,
    private readonly associate: AssociateLeadVehicleUseCase,
    private readonly changeStatus: ChangeLeadStatusUseCase,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: SellVehicleToLeadCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string; readonly vehicleSold: boolean }> {
    this.policy.requireStaff(ctx);

    const leadId = toLeadId(command.leadId);
    const lead = await this.repo.findById(leadId);
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const vehicleId = toVehicleId(command.vehicleId);
    if (lead.status.value === 'converted' && lead.vehicleId === vehicleId) {
      return { status: 'converted', vehicleSold: true };
    }
    lead.ensureOpen('Cannot sell a car to a closed lead');

    const booked = LeadStatus.create('booking_confirmed');
    const alreadyBookedHere = lead.vehicleId === vehicleId && lead.status.value === booked.value;
    if (!alreadyBookedHere) {
      await requireLinkableVehicle(this.vehicles, vehicleId);
      if (lead.status.value !== booked.value && !lead.status.canTransitionTo(booked)) {
        throw new InvalidLeadStatusTransitionError(lead.id, lead.status.value, booked.value);
      }
    }

    const before = { status: lead.status, vehicleId: lead.vehicleId };
    try {
      if (before.vehicleId !== vehicleId) {
        await this.associate.execute({ leadId: command.leadId, vehicleId: command.vehicleId }, ctx);
      }
      if (before.status.value !== booked.value) {
        await this.changeStatus.execute(
          { leadId: command.leadId, status: booked.value, notes: command.notes },
          ctx,
        );
      }
      return await this.changeStatus.execute(
        { leadId: command.leadId, status: 'converted', notes: command.notes },
        ctx,
      );
    } catch (err) {
      await this.restore(command.leadId, vehicleId, before, ctx).catch(() => undefined);
      throw err;
    }
  }

  /** Best effort: the original error is what the caller sees. */
  private async restore(
    leadId: string,
    vehicleId: VehicleId,
    before: { readonly status: LeadStatus; readonly vehicleId: VehicleId | null },
    ctx: AuthenticatedContext,
  ): Promise<void> {
    // The conversion marks the car sold first: past that point, finish by retrying.
    if ((await this.vehicles.linkability(vehicleId)) !== 'linkable') {
      return;
    }
    const lead = await this.repo.findById(toLeadId(leadId));
    if (lead === null || lead.status.isTerminal()) {
      return;
    }
    lead.restoreAfterFailedSale(before.status, before.vehicleId, this.clock.now());
    await this.repo.save(lead, {
      actorId: ctx.userId,
      statusNotes: 'Sale did not complete; lead restored',
    });
    await this.vehicleLinks.refresh(vehicleId, ctx.userId);
    if (before.vehicleId !== null && before.vehicleId !== vehicleId) {
      await this.vehicleLinks.refresh(before.vehicleId, ctx.userId);
    }
  }
}
