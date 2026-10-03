export interface CreateVehicleCommand {
  readonly showroomId: string;
  readonly ownerId: string;
  readonly variantId: string;
  readonly year: number;
  readonly registrationNumber: string;
  readonly fuelType: string;
  readonly transmission: string;
  readonly kmDriven: number;
  readonly numPreviousOwners: number;
  readonly colour: string;
  readonly insuranceValidUntil: string | null;
  readonly rcStatus: string | null;
  readonly serviceHistory: string | null;
  readonly accidentHistory: boolean;
  readonly loanStatus: string | null;
  readonly location: string | null;
  readonly description: string | null;
  readonly acquisitionType: string;
}
