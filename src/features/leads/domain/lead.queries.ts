import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { LeadStatusValue } from './lead-status.value-object';

export interface LeadFollowUpReadModel {
  readonly id: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly notes: string | null;
}

/** Just enough of the linked vehicle to label a pipeline card. */
export interface LinkedVehicleReadModel {
  readonly id: string;
  readonly makeName: string | null;
  readonly modelName: string | null;
  readonly variantName: string | null;
  readonly year: number;
  readonly registrationNumber: string;
}

export interface LeadReadModel {
  readonly id: string;
  readonly showroomId: string;
  readonly vehicleId: string | null;
  readonly linkedVehicle: LinkedVehicleReadModel | null;
  readonly assignedTo: string | null;
  readonly contactId: string;
  readonly contactFullName: string;
  readonly contactPhone: string;
  readonly contactEmail: string | null;
  readonly source: string;
  readonly status: string;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  readonly preferredMakeId: string | null;
  readonly preferredMakeName: string | null;
  readonly preferredModelId: string | null;
  readonly preferredModelName: string | null;
  readonly preferredVariantId: string | null;
  readonly preferredVariantName: string | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
  readonly nextFollowUp: LeadFollowUpReadModel | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LeadListCriteria {
  readonly status?: LeadStatusValue;
  readonly vehicleId?: VehicleId;
  readonly assignedTo?: UserId;
  readonly preferredMakeId?: string;
  readonly preferredModelId?: string;
  readonly preferredVariantId?: string;
}

export interface ILeadQueries {
  listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>>;
  getLead(id: LeadId): Promise<LeadReadModel | null>;
}
