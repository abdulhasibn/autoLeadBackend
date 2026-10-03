import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { LeadId } from './lead-id';
import type { LeadStatusValue } from './lead-status.value-object';

export interface LeadFollowUpReadModel {
  readonly id: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly notes: string | null;
}

export interface LeadReadModel {
  readonly id: string;
  readonly showroomId: string;
  readonly vehicleId: string | null;
  readonly contactId: string;
  readonly contactFullName: string;
  readonly contactPhone: string;
  readonly contactEmail: string | null;
  readonly source: string;
  readonly status: string;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
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
}

export interface ILeadQueries {
  listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>>;
  getLead(id: LeadId): Promise<LeadReadModel | null>;
}
