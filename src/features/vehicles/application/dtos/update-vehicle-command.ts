export interface UpdateVehicleCommand {
  readonly vehicleId: string;
  readonly year: number;
  readonly registrationNumber: string;
  readonly fuelType: string;
  readonly transmission: string;
  readonly kmDriven: number;
  readonly numPreviousOwners: number;
  readonly colour: string;
  readonly insuranceValidUntil: string | null;
  /** Omitted (undefined): kept, unless a date is set. */
  readonly insuranceNil?: boolean;
  readonly rcStatus: string | null;
  readonly serviceHistory: string | null;
  readonly accidentHistory: boolean;
  readonly loanStatus: string | null;
  readonly location: string | null;
  readonly description: string | null;
  /** Omitted (undefined): unchanged. */
  readonly acquisitionType?: string;
}
