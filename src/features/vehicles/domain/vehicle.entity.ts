import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
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
 * Vehicle aggregate for admin intake. Status stays submitted in this phase.
 * Owner, showroom, variant, and acquisition type are fixed after create.
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
    readonly status: VehicleStatus,
    readonly acquisitionType: AcquisitionType,
    readonly submittedBy: UserId,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
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
      VehicleStatus.submitted(),
      props.acquisitionType,
      props.submittedBy,
      props.createdAt,
      props.updatedAt,
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
    );
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

  private assertLive(): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deleted vehicle');
    }
  }
}
