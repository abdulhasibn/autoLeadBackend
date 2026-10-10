import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { SearchTerm } from '../../../domain/shared/search-term.value-object';
import type { LeadSourceValue } from './lead-source.value-object';
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
  /** Assignee's full name; null when unassigned. */
  readonly assignedToName: string | null;
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
  readonly preferredColours: readonly string[];
  readonly preferredFuelTypes: readonly string[];
  readonly preferredTransmissions: readonly string[];
  readonly preferredBodyTypes: readonly string[];
  readonly preferredYearMin: number | null;
  readonly preferredYearMax: number | null;
  readonly preferredKmMax: number | null;
  readonly preferredMaxOwners: number | null;
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
  /** Partial, case-insensitive match on contact name or phone. */
  readonly search?: SearchTerm;
  readonly budgetMin?: number;
  readonly budgetMax?: number;
  readonly sources?: readonly LeadSourceValue[];
  readonly hasVehicle?: boolean;
  readonly purchaseTimeline?: string;
  readonly financeRequired?: boolean;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
}

export interface LeadMatchCandidateCriteria {
  readonly vehicleId: VehicleId;
  /** Suggestions come from this showroom only. */
  readonly showroomId: string;
  /** Salesperson scope: only leads assigned to this user. */
  readonly assignedTo?: UserId;
  /** Cap on suggestion candidates read. */
  readonly limit: number;
}

export interface LeadMatchCandidates {
  /** Every live lead linked to the vehicle, whatever its status. */
  readonly linked: readonly LeadReadModel[];
  /** Open leads with no vehicle and at least one preference, newest first. */
  readonly unlinked: readonly LeadReadModel[];
  /** More unlinked candidates existed than `limit`. */
  readonly truncated: boolean;
}

export interface ILeadQueries {
  listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>>;
  getLead(id: LeadId): Promise<LeadReadModel | null>;
  /** Active-lead count per vehicle in one lookup; vehicles with none are absent. */
  countActiveByVehicles(vehicleIds: readonly VehicleId[]): Promise<ReadonlyMap<VehicleId, number>>;
  /** Leads to score against one vehicle. */
  listMatchCandidates(criteria: LeadMatchCandidateCriteria): Promise<LeadMatchCandidates>;
}
