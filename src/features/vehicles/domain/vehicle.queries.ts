import type { OwnerId } from '../../../domain/shared/owner-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { SearchTerm } from '../../../domain/shared/search-term.value-object';
import type { FuelTypeValue } from '../../../domain/shared/fuel-type.value-object';
import type { MakeId } from './make-id';
import type { ModelId } from './model-id';
import type { TransmissionValue } from '../../../domain/shared/transmission.value-object';
import type { VariantId } from './variant-id';
import type { VehicleStatusValue } from './vehicle-status.value-object';

export interface VehicleReadModel {
  readonly id: string;
  readonly showroomId: string;
  readonly ownerId: string;
  readonly variantId: string;
  readonly makeName: string | null;
  readonly modelName: string | null;
  readonly variantName: string | null;
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
  readonly status: string;
  readonly soldLeadId: string | null;
  readonly acquisitionType: string;
  readonly submittedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VehicleListCriteria {
  readonly status?: VehicleStatusValue;
  readonly ownerId?: OwnerId;
  readonly showroomId?: ShowroomId;
  readonly registration?: string;
  /** Every word must match the plate or the make / model / variant name. */
  readonly search?: SearchTerm;
  readonly makeId?: MakeId;
  readonly modelId?: ModelId;
  readonly variantId?: VariantId;
  readonly yearMin?: number;
  readonly yearMax?: number;
  readonly kmMin?: number;
  readonly kmMax?: number;
  readonly fuelTypes?: readonly FuelTypeValue[];
  readonly transmissions?: readonly TransmissionValue[];
}

export interface IVehicleQueries {
  listVehicles(criteria: VehicleListCriteria, page: Pagination): Promise<Page<VehicleReadModel>>;
  getVehicle(id: VehicleId): Promise<VehicleReadModel | null>;
}
