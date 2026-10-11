import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type {
  LeadVehicleMatchesDto,
  ListLeadVehicleMatchesQuery,
  VehicleMatchDto,
} from '../dtos/lead-vehicle-matches.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { hasMatchCriteria, toMatchPreference } from '../services/lead-match-preference';
import { type MatchPreference, scoreLeadAgainstVehicle } from '../../domain/lead-vehicle-match';
import type { ILeadQueries } from '../../domain/lead.queries';
import type {
  IMatchableVehicleLookup,
  MatchableVehicle,
} from '../../domain/matchable-vehicle.port';
import { MIN_SUGGESTION_CRITERIA } from './list-vehicle-lead-matches.use-case';

/** Newest linkable vehicles scored for suggestions; older ones are left out. */
export const VEHICLE_MATCH_CANDIDATE_CAP = 1000;

/**
 * Scores the vehicle linked to a lead and suggests other vehicles in its
 * showroom that fit its preference. A salesperson only sees their own leads.
 */
export class ListLeadVehicleMatchesUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly queries: ILeadQueries,
    private readonly vehicles: IMatchableVehicleLookup,
  ) {}

  async execute(
    query: ListLeadVehicleMatchesQuery,
    ctx: AuthenticatedContext,
  ): Promise<LeadVehicleMatchesDto> {
    this.policy.requireStaff(ctx);

    const lead = await this.queries.getLead(toLeadId(query.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${query.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const preference = toMatchPreference(lead);
    const linkedVehicleId = lead.vehicleId === null ? null : toVehicleId(lead.vehicleId);
    const linkedVehicle =
      linkedVehicleId === null ? null : await this.vehicles.findForMatching(linkedVehicleId);
    const linked = linkedVehicle === null ? null : withMatch(linkedVehicle, preference);

    if (!hasMatchCriteria(preference)) {
      return { linked, suggested: [], truncated: false };
    }

    const candidates = await this.vehicles.listMatchCandidates({
      showroomId: lead.showroomId,
      excludeVehicleId: linkedVehicleId,
      limit: VEHICLE_MATCH_CANDIDATE_CAP,
    });
    const suggested = candidates.vehicles
      .map((vehicle) => withMatch(vehicle, preference))
      .filter(
        (candidate) =>
          candidate.match !== null &&
          candidate.match.score >= query.minScore &&
          candidate.match.evaluatedCriteria >= MIN_SUGGESTION_CRITERIA,
      )
      .sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1))
      .slice(0, query.limit);

    return { linked, suggested, truncated: candidates.truncated };
  }
}

function withMatch(vehicle: MatchableVehicle, preference: MatchPreference): VehicleMatchDto {
  return { vehicle, match: scoreLeadAgainstVehicle(preference, vehicle) };
}
