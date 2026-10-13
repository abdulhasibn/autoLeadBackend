import type { VehicleMatchDto } from './lead-vehicle-matches.dto';

export interface SuggestVehiclesQuery {
  readonly showroomId: string | null;
  readonly budget: number | null;
  readonly preferredMakeId: string | null;
  readonly preferredModelId: string | null;
  readonly preferredVariantId: string | null;
  readonly preferredColours: string[];
  readonly preferredFuelTypes: string[];
  readonly preferredTransmissions: string[];
  readonly preferredBodyTypes: string[];
  readonly preferredYearMin: number | null;
  readonly preferredYearMax: number | null;
  readonly preferredKmMax: number | null;
  readonly preferredMaxOwners: number | null;
  readonly minScore: number;
  readonly limit: number;
}

export interface SuggestVehiclesDto {
  readonly suggestions: readonly VehicleMatchDto[];
  readonly truncated: boolean;
}
