import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toOwnerId } from '../../../../domain/shared/owner-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { CreateVehicleCommand } from '../dtos/create-vehicle-command';
import type { VehicleDto } from '../dtos/vehicle.dto';
import { toVehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { AcquisitionType } from '../../domain/acquisition-type.value-object';
import type { IActiveShowroomLookup } from '../../domain/active-showroom.port';
import { FuelType } from '../../domain/fuel-type.value-object';
import { KilometersDriven } from '../../domain/kilometers-driven.value-object';
import type { ILiveVariantLookup } from '../../domain/live-variant.port';
import { PreviousOwners } from '../../domain/previous-owners.value-object';
import type { IRegisteredOwnerLookup } from '../../domain/registered-owner.port';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { Transmission } from '../../domain/transmission.value-object';
import { toVariantId } from '../../domain/variant-id';
import { Vehicle } from '../../domain/vehicle.entity';
import { parseLoanStatus, parseRcStatus, parseServiceHistory } from '../../domain/vehicle-details';
import type { IVehicleRepository } from '../../domain/vehicle.repository';
import { VehicleYear } from '../../domain/vehicle-year.value-object';

export class CreateVehicleUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly repo: IVehicleRepository,
    private readonly owners: IRegisteredOwnerLookup,
    private readonly variants: ILiveVariantLookup,
    private readonly showrooms: IActiveShowroomLookup,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateVehicleCommand, ctx: AuthenticatedContext): Promise<VehicleDto> {
    this.policy.requireAdmin(ctx);

    const ownerId = toOwnerId(command.ownerId);
    if (!(await this.owners.isLive(ownerId))) {
      throw new NotFoundError(`Owner not found for id ${command.ownerId}`);
    }

    const variantId = toVariantId(command.variantId);
    if (!(await this.variants.isLive(variantId))) {
      throw new NotFoundError(`Variant not found for id ${command.variantId}`);
    }

    const showroomId = toShowroomId(command.showroomId);
    if (!(await this.showrooms.isActive(showroomId))) {
      throw new NotFoundError(`Showroom not found for id ${command.showroomId}`);
    }

    const now = this.clock.now();
    const vehicle = Vehicle.create({
      id: toVehicleId(this.ids.generate()),
      showroomId,
      ownerId,
      variantId,
      year: VehicleYear.create(command.year),
      registrationNumber: RegistrationNumber.create(command.registrationNumber),
      fuelType: FuelType.create(command.fuelType),
      transmission: Transmission.create(command.transmission),
      kmDriven: KilometersDriven.create(command.kmDriven),
      numPreviousOwners: PreviousOwners.create(command.numPreviousOwners),
      colour: command.colour,
      insuranceValidUntil: parseOptionalDate(command.insuranceValidUntil),
      rcStatus: parseRcStatus(command.rcStatus),
      serviceHistory: parseServiceHistory(command.serviceHistory),
      accidentHistory: command.accidentHistory,
      loanStatus: parseLoanStatus(command.loanStatus),
      location: command.location,
      description: command.description,
      acquisitionType: AcquisitionType.create(command.acquisitionType),
      submittedBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.save(vehicle, ctx.userId);
    return toVehicleDto(vehicle);
  }
}

function parseOptionalDate(input: string | null): CalendarDate | null {
  if (input === null) {
    return null;
  }
  return CalendarDate.create(input);
}
