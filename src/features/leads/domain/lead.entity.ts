import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { ContactId } from './contact-id';
import { InvalidLeadStatusTransitionError } from './errors/invalid-lead-status-transition.error';
import type { LeadId } from './lead-id';
import type { LeadSource } from './lead-source.value-object';
import { LeadStatus } from './lead-status.value-object';

export interface LeadCreateProps {
  readonly id: LeadId;
  readonly showroomId: ShowroomId;
  readonly contactId: ContactId;
  readonly vehicleId: VehicleId | null;
  readonly source: LeadSource;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LeadReconstituteProps extends LeadCreateProps {
  readonly status: LeadStatus;
  readonly deletedAt: Date | null;
}

export class Lead {
  private constructor(
    readonly id: LeadId,
    readonly showroomId: ShowroomId,
    readonly contactId: ContactId,
    private vehicleIdValue: VehicleId | null,
    readonly source: LeadSource,
    private statusValue: LeadStatus,
    private budgetValue: number | null,
    private preferredVehicleValue: string | null,
    private purchaseTimelineValue: string | null,
    private financeRequiredValue: boolean | null,
    private currentVehicleValue: string | null,
    private tradeInRequiredValue: boolean | null,
    private notesValue: string | null,
    readonly createdBy: UserId,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
    private statusChanged: boolean,
  ) {}

  static create(props: LeadCreateProps): Lead {
    return new Lead(
      props.id,
      props.showroomId,
      props.contactId,
      props.vehicleId,
      props.source,
      LeadStatus.initial(),
      props.budget,
      normalizeOptionalText(props.preferredVehicle),
      normalizeOptionalText(props.purchaseTimeline),
      props.financeRequired,
      normalizeOptionalText(props.currentVehicle),
      props.tradeInRequired,
      normalizeOptionalText(props.notes),
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      null,
      true,
    );
  }

  static reconstitute(props: LeadReconstituteProps): Lead {
    return new Lead(
      props.id,
      props.showroomId,
      props.contactId,
      props.vehicleId,
      props.source,
      props.status,
      props.budget,
      props.preferredVehicle,
      props.purchaseTimeline,
      props.financeRequired,
      props.currentVehicle,
      props.tradeInRequired,
      props.notes,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
      false,
    );
  }

  get vehicleId(): VehicleId | null {
    return this.vehicleIdValue;
  }

  get status(): LeadStatus {
    return this.statusValue;
  }

  get budget(): number | null {
    return this.budgetValue;
  }

  get preferredVehicle(): string | null {
    return this.preferredVehicleValue;
  }

  get purchaseTimeline(): string | null {
    return this.purchaseTimelineValue;
  }

  get financeRequired(): boolean | null {
    return this.financeRequiredValue;
  }

  get currentVehicle(): string | null {
    return this.currentVehicleValue;
  }

  get tradeInRequired(): boolean | null {
    return this.tradeInRequiredValue;
  }

  get notes(): string | null {
    return this.notesValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get deletedAt(): Date | null {
    return this.deletedAtValue;
  }

  get hasStatusChanged(): boolean {
    return this.statusChanged;
  }

  associateVehicle(vehicleId: VehicleId, at: Date): void {
    this.assertLive();
    if (this.statusValue.isTerminal()) {
      throw new Error('Cannot associate a vehicle with a closed lead');
    }
    this.vehicleIdValue = vehicleId;
    this.updatedAtValue = at;
  }

  changeStatus(next: LeadStatus, at: Date): void {
    this.assertLive();
    if (this.statusValue.value === next.value) {
      return;
    }
    if (!this.statusValue.canTransitionTo(next)) {
      throw new InvalidLeadStatusTransitionError(this.id, this.statusValue.value, next.value);
    }
    this.statusValue = next;
    this.statusChanged = true;
    this.updatedAtValue = at;
  }

  private assertLive(): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deleted lead');
    }
  }
}

function normalizeOptionalText(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}
