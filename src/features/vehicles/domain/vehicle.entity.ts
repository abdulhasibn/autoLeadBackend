import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { OwnerId } from '../../../domain/shared/owner-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { AcquisitionType } from './acquisition-type.value-object';
import type { FuelType } from './fuel-type.value-object';
import type { KilometersDriven } from './kilometers-driven.value-object';
import type { PreviousOwners } from './previous-owners.value-object';
import type { RegistrationNumber } from './registration-number.value-object';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { Transmission } from './transmission.value-object';
import type { VariantId } from './variant-id';
import type { LoanStatus, RcStatus, ServiceHistory } from './vehicle-details';
import { normalizeColour, normalizeOptionalText } from './vehicle-details';
import type { VehicleYear } from './vehicle-year.value-object';
import { InvalidVehicleStatusTransitionError } from './errors/invalid-vehicle-status-transition.error';
import { VehicleStatus } from './vehicle-status.value-object';

export interface VehicleCreateProps {
  readonly id: VehicleId;
  readonly showroomId: ShowroomId;
  readonly ownerId: OwnerId;
  readonly variantId: VariantId;
  readonly year: VehicleYear;
  readonly registrationNumber: RegistrationNumber;
  readonly fuelType: FuelType;
  readonly transmission: Transmission;
  readonly kmDriven: KilometersDriven;
  readonly numPreviousOwners: PreviousOwners;
  readonly colour: string;
  readonly insuranceValidUntil: CalendarDate | null;
  readonly rcStatus: RcStatus | null;
  readonly serviceHistory: ServiceHistory | null;
  readonly accidentHistory: boolean;
  readonly loanStatus: LoanStatus | null;
  readonly location: string | null;
  readonly description: string | null;
  readonly acquisitionType: AcquisitionType;
  readonly submittedBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface VehicleReconstituteProps extends VehicleCreateProps {
  readonly status: VehicleStatus;
  readonly soldLeadId: LeadId | null;
  readonly deletedAt: Date | null;
}

export interface VehicleDetailsUpdate {
  readonly year: VehicleYear;
  readonly registrationNumber: RegistrationNumber;
  readonly fuelType: FuelType;
  readonly transmission: Transmission;
  readonly kmDriven: KilometersDriven;
  readonly numPreviousOwners: PreviousOwners;
  readonly colour: string;
  readonly insuranceValidUntil: CalendarDate | null;
  readonly rcStatus: RcStatus | null;
  readonly serviceHistory: ServiceHistory | null;
  readonly accidentHistory: boolean;
  readonly loanStatus: LoanStatus | null;
  readonly location: string | null;
  readonly description: string | null;
  readonly updatedAt: Date;
}

/**
 * Vehicle aggregate. Admins drop or re-list it; `linked` and `sold` follow the
 * vehicle's leads. Owner, showroom, variant, and acquisition type stay fixed.
 */
export class Vehicle {
  private constructor(
    readonly id: VehicleId,
    readonly showroomId: ShowroomId,
    readonly ownerId: OwnerId,
    readonly variantId: VariantId,
    private yearValue: VehicleYear,
    private registrationNumberValue: RegistrationNumber,
    private fuelTypeValue: FuelType,
    private transmissionValue: Transmission,
    private kmDrivenValue: KilometersDriven,
    private numPreviousOwnersValue: PreviousOwners,
    private colourValue: string,
    private insuranceValidUntilValue: CalendarDate | null,
    private rcStatusValue: RcStatus | null,
    private serviceHistoryValue: ServiceHistory | null,
    private accidentHistoryValue: boolean,
    private loanStatusValue: LoanStatus | null,
    private locationValue: string | null,
    private descriptionValue: string | null,
    private statusValue: VehicleStatus,
    readonly acquisitionType: AcquisitionType,
    readonly submittedBy: UserId,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
    private statusChangeReasonValue: string | null,
    private soldLeadIdValue: LeadId | null,
  ) {}

  static create(props: VehicleCreateProps): Vehicle {
    return new Vehicle(
      props.id,
      props.showroomId,
      props.ownerId,
      props.variantId,
      props.year,
      props.registrationNumber,
      props.fuelType,
      props.transmission,
      props.kmDriven,
      props.numPreviousOwners,
      normalizeColour(props.colour),
      props.insuranceValidUntil,
      props.rcStatus,
      props.serviceHistory,
      props.accidentHistory,
      props.loanStatus,
      normalizeOptionalText(props.location),
      normalizeOptionalText(props.description),
      VehicleStatus.open(),
      props.acquisitionType,
      props.submittedBy,
      props.createdAt,
      props.updatedAt,
      null,
      null,
      null,
    );
  }

  static reconstitute(props: VehicleReconstituteProps): Vehicle {
    return new Vehicle(
      props.id,
      props.showroomId,
      props.ownerId,
      props.variantId,
      props.year,
      props.registrationNumber,
      props.fuelType,
      props.transmission,
      props.kmDriven,
      props.numPreviousOwners,
      props.colour,
      props.insuranceValidUntil,
      props.rcStatus,
      props.serviceHistory,
      props.accidentHistory,
      props.loanStatus,
      props.location,
      props.description,
      props.status,
      props.acquisitionType,
      props.submittedBy,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
      null,
      props.soldLeadId,
    );
  }

  get status(): VehicleStatus {
    return this.statusValue;
  }

  get soldLeadId(): LeadId | null {
    return this.soldLeadIdValue;
  }

  get isLinkable(): boolean {
    return !this.isDeleted && this.statusValue.isLinkable();
  }

  get statusChangeReason(): string | null {
    return this.statusChangeReasonValue;
  }

  get year(): VehicleYear {
    return this.yearValue;
  }

  get registrationNumber(): RegistrationNumber {
    return this.registrationNumberValue;
  }

  get fuelType(): FuelType {
    return this.fuelTypeValue;
  }

  get transmission(): Transmission {
    return this.transmissionValue;
  }

  get kmDriven(): KilometersDriven {
    return this.kmDrivenValue;
  }

  get numPreviousOwners(): PreviousOwners {
    return this.numPreviousOwnersValue;
  }

  get colour(): string {
    return this.colourValue;
  }

  get insuranceValidUntil(): CalendarDate | null {
    return this.insuranceValidUntilValue;
  }

  get rcStatus(): RcStatus | null {
    return this.rcStatusValue;
  }

  get serviceHistory(): ServiceHistory | null {
    return this.serviceHistoryValue;
  }

  get accidentHistory(): boolean {
    return this.accidentHistoryValue;
  }

  get loanStatus(): LoanStatus | null {
    return this.loanStatusValue;
  }

  get location(): string | null {
    return this.locationValue;
  }

  get description(): string | null {
    return this.descriptionValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get deletedAt(): Date | null {
    return this.deletedAtValue;
  }

  get isDeleted(): boolean {
    return this.deletedAtValue !== null;
  }

  updateDetails(update: VehicleDetailsUpdate): void {
    this.assertLive();
    this.yearValue = update.year;
    this.registrationNumberValue = update.registrationNumber;
    this.fuelTypeValue = update.fuelType;
    this.transmissionValue = update.transmission;
    this.kmDrivenValue = update.kmDriven;
    this.numPreviousOwnersValue = update.numPreviousOwners;
    this.colourValue = normalizeColour(update.colour);
    this.insuranceValidUntilValue = update.insuranceValidUntil;
    this.rcStatusValue = update.rcStatus;
    this.serviceHistoryValue = update.serviceHistory;
    this.accidentHistoryValue = update.accidentHistory;
    this.loanStatusValue = update.loanStatus;
    this.locationValue = normalizeOptionalText(update.location);
    this.descriptionValue = normalizeOptionalText(update.description);
    this.updatedAtValue = update.updatedAt;
  }

  /** Admin-driven status change; only `open` (re-list) and `dropped` are allowed. */
  changeStatusByAdmin(next: VehicleStatus, at: Date, reason: string | null): void {
    if (!next.isAdminSettable()) {
      throw new BusinessRuleViolationError(
        'VEHICLE_STATUS_SYSTEM_MANAGED',
        `Vehicle status ${next.value} is set automatically from its leads`,
      );
    }
    this.transitionTo(next, at, reason);
  }

  /** Flips open ⇄ linked to match whether any active lead points at the vehicle. */
  syncLinkState(hasActiveLeads: boolean, at: Date): void {
    if (hasActiveLeads && this.statusValue.value === 'open') {
      this.transitionTo(VehicleStatus.linked(), at, null);
    } else if (!hasActiveLeads && this.statusValue.value === 'linked') {
      this.transitionTo(VehicleStatus.open(), at, null);
    }
  }

  markSold(leadId: LeadId, at: Date, reason: string): void {
    if (this.statusValue.value === 'sold') {
      if (this.soldLeadIdValue === leadId) {
        return;
      }
      throw new BusinessRuleViolationError(
        'VEHICLE_ALREADY_SOLD',
        'This vehicle was already sold through another lead',
      );
    }
    this.transitionTo(VehicleStatus.sold(), at, reason);
    this.soldLeadIdValue = leadId;
  }

  private transitionTo(next: VehicleStatus, at: Date, reason: string | null): void {
    this.assertLive();
    if (this.statusValue.value === next.value) {
      return;
    }
    if (!this.statusValue.canTransitionTo(next)) {
      throw new InvalidVehicleStatusTransitionError(this.id, this.statusValue.value, next.value);
    }
    this.statusValue = next;
    this.statusChangeReasonValue = normalizeOptionalText(reason);
    this.updatedAtValue = at;
  }

  private assertLive(): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deleted vehicle');
    }
  }
}
