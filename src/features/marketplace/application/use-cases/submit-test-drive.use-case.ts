import { InvalidMobileError } from '../../domain/errors/invalid-mobile.error';
import { IndianMobile } from '../../domain/indian-mobile.value-object';
import {
  WEBSITE_SYSTEM_USER_ID,
  type ITestDriveIntake,
  type IVehicleLinkSync,
  type ShowroomLocation,
} from '../../domain/test-drive-intake.port';

export interface SubmitTestDriveCommand {
  readonly vehicleId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly ipHash: string;
}

export interface TestDriveReceiptDto {
  readonly outcome: 'created' | 'updated';
  readonly vehicleAvailable: boolean;
  /** Revealed only after a successful request; no public GET exposes it. */
  readonly showroom: ShowroomLocation | null;
}

/**
 * A website visitor asks to test drive a car. The request always lands as a
 * lead — even when the car sold in the meantime — so no enquiry is lost.
 */
export class SubmitTestDriveUseCase {
  constructor(
    private readonly intake: ITestDriveIntake,
    private readonly vehicleLinkSync: IVehicleLinkSync,
  ) {}

  async execute(command: SubmitTestDriveCommand): Promise<TestDriveReceiptDto> {
    const phone = IndianMobile.parse(command.phone);
    if (phone === null) {
      throw new InvalidMobileError();
    }

    const result = await this.intake.submit({
      vehicleId: command.vehicleId,
      fullName: command.fullName.trim().replace(/\s+/g, ' '),
      phone: phone.value,
      ipHash: command.ipHash,
    });

    if (result.outcome === 'created' && result.linkedVehicleId !== null) {
      await this.vehicleLinkSync.syncLinkState(
        result.linkedVehicleId,
        true,
        WEBSITE_SYSTEM_USER_ID,
      );
    }

    return {
      outcome: result.outcome,
      vehicleAvailable: result.vehicleAvailable,
      showroom: result.showroom,
    };
  }
}
