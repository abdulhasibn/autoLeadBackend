import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { UpdateVehicleCommand } from '../dtos/update-vehicle-command';
import type { VehicleDto } from '../dtos/vehicle.dto';
import { toVehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { FuelType } from '../../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../../domain/previous-owners.value-object';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { Transmission } from '../../../../domain/shared/transmission.value-object';
import { parseLoanStatus, parseRcStatus, parseServiceHistory } from '../../domain/vehicle-details';
import type { IVehicleRepository } from '../../domain/vehicle.repository';
import { VehicleYear } from '../../domain/vehicle-year.value-object';

export class UpdateVehicleUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly repo: IVehicleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateVehicleCommand, ctx: AuthenticatedContext): Promise<VehicleDto> {
    this.policy.requireStaff(ctx);

    const vehicle = await this.repo.findById(toVehicleId(command.vehicleId));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    vehicle.updateDetails({
      year: VehicleYear.create(command.year),
      registrationNumber: RegistrationNumber.create(command.registrationNumber),
      fuelType: FuelType.create(command.fuelType),
      transmission: Transmission.create(command.transmission),
      kmDriven: KilometersDriven.create(command.kmDriven),
      numPreviousOwners: PreviousOwners.create(command.numPreviousOwners),
      colour: command.colour,
      insuranceValidUntil:
        command.insuranceValidUntil === null
          ? null
          : CalendarDate.create(command.insuranceValidUntil),
      rcStatus: parseRcStatus(command.rcStatus),
      serviceHistory: parseServiceHistory(command.serviceHistory),
      accidentHistory: command.accidentHistory,
      loanStatus: parseLoanStatus(command.loanStatus),
      location: command.location,
      description: command.description,
      updatedAt: this.clock.now(),
    });

    await this.repo.save(vehicle, ctx.userId);
    return toVehicleDto(vehicle);
  }
}
