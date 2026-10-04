export interface CreateVehicleCommand {
  /** Defaults to the actor's home showroom; only admins may name another. */
  readonly showroomId: string | null;
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
