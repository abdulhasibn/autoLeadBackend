import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  DemandReadModel,
  IInsightsQueries,
  InsightsRange,
  LeadJourneyReadModel,
  TrafficReadModel,
  VehicleDetailReadModel,
  VehicleStatsReadModel,
} from '../domain/insights.queries';
import {
  toDemandReadModel,
  toLeadJourneyReadModel,
  toTrafficReadModel,
  toVehicleDetailReadModel,
  toVehicleStatsReadModel,
  type DemandJson,
  type LeadJourneyJson,
  type TrafficJson,
  type VehicleDetailJson,
  type VehicleStatsJson,
} from './insights.mapper';

/** One RPC per read; see supabase/migrations/20261108120000_insights_reads.sql. */
export class SupabaseInsightsQueries implements IInsightsQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getTraffic(
    showroomId: ShowroomId | null,
    current: InsightsRange,
    previous: InsightsRange,
    campaignLimit: number,
  ): Promise<TrafficReadModel> {
    const { data, error } = await this.db.rpc('insights_traffic', {
      p_showroom_id: showroomId,
      p_from: current.from.toISOString(),
      p_until: current.until.toISOString(),
      p_prev_from: previous.from.toISOString(),
      p_prev_until: previous.until.toISOString(),
      p_campaign_limit: campaignLimit,
    });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load traffic insights: ${error.message}`);
    }
    return toTrafficReadModel(data as unknown as TrafficJson);
  }

  async getVehicleStats(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    includeVehicleId: string | null,
  ): Promise<readonly VehicleStatsReadModel[]> {
    const { data, error } = await this.db.rpc('insights_vehicle_stats', {
      p_showroom_id: showroomId,
      p_from: range.from.toISOString(),
      p_until: range.until.toISOString(),
      p_vehicle_id: includeVehicleId,
    });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle insights: ${error.message}`);
    }
    return (data as unknown as VehicleStatsJson[]).map(toVehicleStatsReadModel);
  }

  async getVehicleDetail(
    vehicleId: string,
    seriesFrom: Date,
    range: InsightsRange,
    timeZone: string,
  ): Promise<VehicleDetailReadModel> {
    const { data, error } = await this.db.rpc('insights_vehicle_detail', {
      p_vehicle_id: vehicleId,
      p_series_from: seriesFrom.toISOString(),
      p_from: range.from.toISOString(),
      p_until: range.until.toISOString(),
      p_time_zone: timeZone,
    });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle insight: ${error.message}`);
    }
    return toVehicleDetailReadModel(data as unknown as VehicleDetailJson);
  }

  async getDemand(
    showroomId: ShowroomId | null,
    range: InsightsRange,
    zeroResultLimit: number,
  ): Promise<DemandReadModel> {
    const { data, error } = await this.db.rpc('insights_demand', {
      p_showroom_id: showroomId,
      p_from: range.from.toISOString(),
      p_until: range.until.toISOString(),
      p_top_limit: zeroResultLimit,
    });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load demand insights: ${error.message}`);
    }
    return toDemandReadModel(data as unknown as DemandJson);
  }

  async getLeadJourney(
    leadId: string,
    otherCarsLimit: number,
  ): Promise<LeadJourneyReadModel | null> {
    const { data, error } = await this.db.rpc('insights_lead_journey', {
      p_lead_id: leadId,
      p_other_limit: otherCarsLimit,
    });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load lead journey: ${error.message}`);
    }
    return data === null ? null : toLeadJourneyReadModel(data as unknown as LeadJourneyJson);
  }
}
