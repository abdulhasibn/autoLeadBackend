import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type {
  LeadMatchDto,
  ListVehicleLeadMatchesQuery,
  VehicleLeadMatchesDto,
} from '../dtos/lead-vehicle-matches.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { scoreLeadAgainstVehicle } from '../../domain/lead-vehicle-match';
import type { ILeadQueries, LeadReadModel } from '../../domain/lead.queries';
import type {
  IMatchableVehicleLookup,
  MatchableVehicle,
} from '../../domain/matchable-vehicle.port';

/** Newest open leads scored for suggestions; older ones are left out. */
export const MATCH_CANDIDATE_CAP = 1000;
/** A suggestion must rest on at least this many criteria, so one lucky colour is not a 100% fit. */
export const MIN_SUGGESTION_CRITERIA = 2;

/**
 * Scores the leads linked to a vehicle and suggests unlinked open leads whose
 * preference fits it. A salesperson only sees leads assigned to them.
 */
export class ListVehicleLeadMatchesUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly queries: ILeadQueries,
    private readonly vehicles: IMatchableVehicleLookup,
  ) {}

  async execute(
    query: ListVehicleLeadMatchesQuery,
    ctx: AuthenticatedContext,
  ): Promise<VehicleLeadMatchesDto> {
    this.policy.requireStaff(ctx);

    const vehicleId = toVehicleId(query.vehicleId);
    const vehicle = await this.vehicles.findForMatching(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${query.vehicleId}`);
    }

    const candidates = await this.queries.listMatchCandidates({
      vehicleId,
      showroomId: vehicle.showroomId,
      assignedTo: this.policy.assigneeScope(ctx, undefined),
      limit: MATCH_CANDIDATE_CAP,
    });

    const linked = candidates.linked.map((lead) => withMatch(lead, vehicle)).sort(byScore);
    const suggested = candidates.unlinked
      .map((lead) => withMatch(lead, vehicle))
      .filter(
        (lead) =>
          lead.match !== null &&
          lead.match.score >= query.minScore &&
          lead.match.evaluatedCriteria >= MIN_SUGGESTION_CRITERIA,
      )
      .sort(byScore)
      .slice(0, query.limit);

    return { vehicle, linked, suggested, truncated: candidates.truncated };
  }
}

function withMatch(lead: LeadReadModel, vehicle: MatchableVehicle): LeadMatchDto {
  const match = scoreLeadAgainstVehicle(
    {
      makeId: lead.preferredMakeId,
      modelId: lead.preferredModelId,
      variantId: lead.preferredVariantId,
      budget: lead.budget,
      colours: lead.preferredColours,
      fuelTypes: lead.preferredFuelTypes,
      transmissions: lead.preferredTransmissions,
      bodyTypes: lead.preferredBodyTypes,
      yearMin: lead.preferredYearMin,
      yearMax: lead.preferredYearMax,
      kmMax: lead.preferredKmMax,
      maxOwners: lead.preferredMaxOwners,
    },
    vehicle,
  );
  return { ...lead, match };
}

/** Best score first; leads with nothing to score go last. */
function byScore(a: LeadMatchDto, b: LeadMatchDto): number {
  return (b.match?.score ?? -1) - (a.match?.score ?? -1);
}
