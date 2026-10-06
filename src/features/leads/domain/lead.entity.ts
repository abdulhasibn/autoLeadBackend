import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { ContactId } from './contact-id';
import { InvalidLeadStatusTransitionError } from './errors/invalid-lead-status-transition.error';
import type { LeadSource } from './lead-source.value-object';
import { LeadStatus } from './lead-status.value-object';
import { PreferredCatalog } from './preferred-catalog.value-object';

export interface LeadCreateProps {
  readonly id: LeadId;
  readonly showroomId: ShowroomId;
  readonly contactId: ContactId;
  readonly vehicleId: VehicleId | null;
  readonly assignedTo: UserId | null;
  readonly source: LeadSource;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  /** Defaults to no preference. */
  readonly preferredCatalog?: PreferredCatalog;
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
  readonly preferredCatalog: PreferredCatalog;
  readonly status: LeadStatus;
  readonly deletedAt: Date | null;
}

export class Lead {
  private constructor(
    readonly id: LeadId,
    readonly showroomId: ShowroomId,
    readonly contactId: ContactId,
    private vehicleIdValue: VehicleId | null,
    private assignedToValue: UserId | null,
    readonly source: LeadSource,
    private statusValue: LeadStatus,
    private budgetValue: number | null,
    private preferredVehicleValue: string | null,
    private preferredCatalogValue: PreferredCatalog,
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
    private assigneeChanged: boolean,
  ) {}

  static create(props: LeadCreateProps): Lead {
    return new Lead(
      props.id,
      props.showroomId,
      props.contactId,
      props.vehicleId,
      props.assignedTo,
      props.source,
      LeadStatus.initial(),
      props.budget,
      normalizeOptionalText(props.preferredVehicle),
      props.preferredCatalog ?? PreferredCatalog.none(),
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
      props.assignedTo !== null,
    );
  }

  static reconstitute(props: LeadReconstituteProps): Lead {
    return new Lead(
      props.id,
      props.showroomId,
      props.contactId,
      props.vehicleId,
      props.assignedTo,
      props.source,
      props.status,
      props.budget,
      props.preferredVehicle,
      props.preferredCatalog,
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
      false,
    );
  }

  get vehicleId(): VehicleId | null {
    return this.vehicleIdValue;
  }

  get assignedTo(): UserId | null {
    return this.assignedToValue;
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

  get preferredCatalog(): PreferredCatalog {
    return this.preferredCatalogValue;
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

  get hasAssigneeChanged(): boolean {
    return this.assigneeChanged;
  }

  assign(assignee: UserId | null, at: Date): void {
    this.assertOpen('Cannot reassign a closed lead');
    if (this.assignedToValue === assignee) {
      return;
    }
    this.assignedToValue = assignee;
    this.assigneeChanged = true;
    this.updatedAtValue = at;
  }

  associateVehicle(vehicleId: VehicleId, at: Date): void {
    this.assertOpen('Cannot associate a vehicle with a closed lead');
    this.vehicleIdValue = vehicleId;
    this.updatedAtValue = at;
  }

  setPreferredCatalog(preference: PreferredCatalog, at: Date): void {
    this.assertOpen('Cannot change the preference of a closed lead');
    if (this.preferredCatalogValue.equals(preference)) {
      return;
    }
    this.preferredCatalogValue = preference;
    this.updatedAtValue = at;
  }

  unlinkVehicle(at: Date): void {
    this.assertLive();
    if (this.vehicleIdValue === null) {
      return;
    }
    this.vehicleIdValue = null;
    this.updatedAtValue = at;
  }

  changeStatus(next: LeadStatus, at: Date): void {
    if (!next.isManuallySettable()) {
      throw new BusinessRuleViolationError(
        'LEAD_STATUS_SYSTEM_MANAGED',
        `Lead status ${next.value} is set automatically`,
      );
    }
    if (next.requiresVehicle() && this.vehicleIdValue === null) {
      throw new BusinessRuleViolationError(
        'LEAD_REQUIRES_VEHICLE',
        `Link a vehicle to this lead before moving it to ${next.value}`,
      );
    }
    this.transitionTo(next, at);
  }

  /** Another lead bought this lead's vehicle: release the vehicle and park the lead. */
  markVehicleUnavailable(at: Date): void {
    this.transitionTo(LeadStatus.vehicleUnavailable(), at);
    this.vehicleIdValue = null;
  }

  private transitionTo(next: LeadStatus, at: Date): void {
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

  private assertOpen(message: string): void {
    this.assertLive();
    if (this.statusValue.isTerminal()) {
      throw new BusinessRuleViolationError('LEAD_CLOSED', message);
    }
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
