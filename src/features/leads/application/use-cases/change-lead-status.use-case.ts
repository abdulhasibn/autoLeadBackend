import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { ChangeLeadStatusCommand } from '../dtos/change-lead-status-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';
import type { ILeadRepository } from '../../domain/lead.repository';
import { LeadStatus } from '../../domain/lead-status.value-object';
import type { IVehicleSale } from '../../domain/vehicle-sale.port';

export class ChangeLeadStatusUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicleSale: IVehicleSale,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeLeadStatusCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string; readonly vehicleSold: boolean }> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const now = this.clock.now();
    lead.changeStatus(LeadStatus.create(command.status), now);
    if (!lead.hasStatusChanged) {
      return { status: lead.status.value, vehicleSold: false };
    }

    const vehicleId = lead.vehicleId;
    const write = { actorId: ctx.userId, statusNotes: command.notes };

    if (lead.status.value === 'converted' && vehicleId !== null) {
      // Each step is idempotent and the converting lead is saved last, so a
      // failed request is finished by repeating it (ADR-0011).
      await this.vehicleSale.markSold(
        vehicleId,
        lead.id,
        ctx.userId,
        `Sold through lead ${lead.id}`,
      );
      const others = await this.repo.findActiveByVehicle(vehicleId);
      for (const other of others) {
        if (other.id === lead.id) {
          continue;
        }
        other.markVehicleUnavailable(now);
        await this.repo.save(other, {
          actorId: ctx.userId,
          statusNotes: `Vehicle sold through lead ${lead.id}`,
        });
      }
      await this.repo.save(lead, write);
      return { status: lead.status.value, vehicleSold: true };
    }

    await this.repo.save(lead, write);
    if (vehicleId !== null) {
      await this.vehicleLinks.refresh(vehicleId, ctx.userId);
    }
    return { status: lead.status.value, vehicleSold: false };
  }
}
