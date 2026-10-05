import type {
  CappedList,
  DashboardSummaryReadModel,
  FollowUpItemReadModel,
  LeadItemReadModel,
  PeriodCount,
  VehicleItemReadModel,
  VehicleLabelParts,
} from '../domain/dashboard.queries';

interface VehicleLabelJson {
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly registration_number: string;
}

interface FollowUpCardJson {
  readonly follow_up_id: string;
  readonly lead_id: string;
  readonly task_type: string;
  readonly scheduled_at: string;
  readonly contact_name: string;
  readonly contact_phone: string | null;
  readonly vehicle: VehicleLabelJson | null;
}

interface LeadCardJson {
  readonly lead_id: string;
  readonly status: string;
  readonly source: string;
  readonly contact_name: string;
  readonly contact_phone: string | null;
  readonly vehicle: VehicleLabelJson | null;
  readonly created_at: string;
}

interface VehicleCardJson {
  readonly vehicle_id: string;
  readonly status: string;
  readonly active_leads: number;
  readonly created_at: string;
  readonly vehicle: VehicleLabelJson;
}

interface CappedListJson<T> {
  readonly total: number;
  readonly items: readonly T[];
}

/** Shape returned by public.dashboard_summary. */
export interface DashboardSummaryJson {
  readonly cars_sold: PeriodCount;
  readonly new_leads: PeriodCount;
  readonly converted: PeriodCount;
  readonly lost: PeriodCount;
  readonly inventory: { readonly open: number; readonly linked: number };
  readonly pipeline: {
    readonly new: number;
    readonly not_now: number;
    readonly booking_confirmed: number;
  };
  readonly overdue_follow_ups: CappedListJson<FollowUpCardJson>;
  readonly today_follow_ups: CappedListJson<FollowUpCardJson>;
  readonly leads_without_follow_up: CappedListJson<LeadCardJson>;
  readonly aged_stock: CappedListJson<VehicleCardJson>;
}

export function toDashboardSummaryReadModel(json: DashboardSummaryJson): DashboardSummaryReadModel {
  return {
    carsSold: json.cars_sold,
    newLeads: json.new_leads,
    converted: json.converted,
    lost: json.lost,
    inventory: json.inventory,
    pipeline: json.pipeline,
    overdueFollowUps: mapList(json.overdue_follow_ups, toFollowUpItem),
    todayFollowUps: mapList(json.today_follow_ups, toFollowUpItem),
    leadsWithoutFollowUp: mapList(json.leads_without_follow_up, toLeadItem),
    agedStock: mapList(json.aged_stock, toVehicleItem),
  };
}

function mapList<TJson, TModel>(
  list: CappedListJson<TJson>,
  map: (item: TJson) => TModel,
): CappedList<TModel> {
  return { total: list.total, items: list.items.map(map) };
}

function toVehicleLabel(json: VehicleLabelJson | null): VehicleLabelParts | null {
  if (json === null) {
    return null;
  }
  return {
    year: json.year,
    make: json.make,
    model: json.model,
    variant: json.variant,
    registrationNumber: json.registration_number,
  };
}

function toFollowUpItem(json: FollowUpCardJson): FollowUpItemReadModel {
  return {
    followUpId: json.follow_up_id,
    leadId: json.lead_id,
    taskType: json.task_type,
    scheduledAt: new Date(json.scheduled_at).toISOString(),
    contactName: json.contact_name,
    contactPhone: json.contact_phone,
    vehicle: toVehicleLabel(json.vehicle),
  };
}

function toLeadItem(json: LeadCardJson): LeadItemReadModel {
  return {
    leadId: json.lead_id,
    status: json.status,
    source: json.source,
    contactName: json.contact_name,
    contactPhone: json.contact_phone,
    vehicle: toVehicleLabel(json.vehicle),
    createdAt: new Date(json.created_at).toISOString(),
  };
}

function toVehicleItem(json: VehicleCardJson): VehicleItemReadModel {
  return {
    vehicleId: json.vehicle_id,
    status: json.status,
    activeLeads: json.active_leads,
    createdAt: new Date(json.created_at).toISOString(),
    vehicle: {
      year: json.vehicle.year,
      make: json.vehicle.make,
      model: json.vehicle.model,
      variant: json.vehicle.variant,
      registrationNumber: json.vehicle.registration_number,
    },
  };
}
