import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { ContactId } from './contact-id';
import { InvalidLeadStatusTransitionError } from './errors/invalid-lead-status-transition.error';
import type { LeadSource } from './lead-source.value-object';
import { LeadStatus } from './lead-status.value-object';
import { LeadPreference } from './lead-preference.value-object';
import type { PreferredCatalog } from './preferred-catalog.value-object';

export interface LeadCreateProps {
  readonly id: LeadId;
  readonly showroomId: ShowroomId;
  readonly contactId: ContactId;
  readonly vehicleId: VehicleId | null;
  readonly assignedTo: UserId | null;
  readonly source: LeadSource;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  /** What the buyer wants; defaults to no preference. */
  readonly preference?: LeadPreference;
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
  readonly preference: LeadPreference;
  readonly status: LeadStatus;
  readonly deletedAt: Date | null;
}

export interface LeadDetails {
  readonly contactId: ContactId;
  readonly source: LeadSource;
  readonly budget: number | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
}

export class Lead {
  private constructor(
    readonly id: LeadId,
    readonly showroomId: ShowroomId,
    private contactIdValue: ContactId,
    private vehicleIdValue: VehicleId | null,
    private assignedToValue: UserId | null,
    private sourceValue: LeadSource,
    private statusValue: LeadStatus,
    private budgetValue: number | null,
    private preferredVehicleValue: string | null,
    private preferenceValue: LeadPreference,
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
      props.preference ?? LeadPreference.none(),
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
      props.preference,
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

  get contactId(): ContactId {
    return this.contactIdValue;
  }

  get source(): LeadSource {
    return this.sourceValue;
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

  get preference(): LeadPreference {
    return this.preferenceValue;
  }

  get preferredCatalog(): PreferredCatalog {
    return this.preferenceValue.catalog;
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

  /** Full replace of what the buyer wants. */
  setPreference(preference: LeadPreference, at: Date): void {
    this.assertOpen('Cannot change the preference of a closed lead');
    if (this.preferenceValue.equals(preference)) {
      return;
    }
    this.preferenceValue = preference;
    this.updatedAtValue = at;
  }

  /** Staff clear the link by hand; a booking keeps its vehicle until its status moves on. */
  removeVehicle(at: Date): void {
    this.assertOpen('Cannot remove the vehicle of a closed lead');
    if (this.vehicleIdValue === null) {
      return;
    }
    if (this.statusValue.requiresVehicle()) {
      throw new BusinessRuleViolationError(
        'LEAD_REQUIRES_VEHICLE',
        `A ${this.statusValue.value} lead must keep its vehicle; change its status first`,
      );
    }
    this.vehicleIdValue = null;
    this.updatedAtValue = at;
  }

  /** Full replace of the CRM fields staff correct after intake. */
  updateDetails(details: LeadDetails, at: Date): void {
    this.assertOpen('Cannot edit a closed lead');
    this.contactIdValue = details.contactId;
    this.sourceValue = details.source;
    this.budgetValue = details.budget;
    this.purchaseTimelineValue = normalizeOptionalText(details.purchaseTimeline);
    this.financeRequiredValue = details.financeRequired;
    this.currentVehicleValue = normalizeOptionalText(details.currentVehicle);
    this.tradeInRequiredValue = details.tradeInRequired;
    this.notesValue = normalizeOptionalText(details.notes);
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
