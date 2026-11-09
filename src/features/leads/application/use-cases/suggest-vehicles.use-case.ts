import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { resolveShowroomId } from '../../../../domain/shared/resolve-showroom';
import type { SuggestVehiclesDto, SuggestVehiclesQuery } from '../dtos/suggest-vehicles.dto';
import type { VehicleMatchDto } from '../dtos/lead-vehicle-matches.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { hasMatchCriteria } from '../services/lead-match-preference';
import type { MatchPreference } from '../../domain/lead-vehicle-match';
import { isSuggestibleMatch, scoreLeadAgainstVehicle } from '../../domain/lead-vehicle-match';
import type { IMatchableVehicleLookup } from '../../domain/matchable-vehicle.port';
import { VEHICLE_MATCH_CANDIDATE_CAP } from './list-lead-vehicle-matches.use-case';

export class SuggestVehiclesUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly vehicles: IMatchableVehicleLookup,
  ) {}

  async execute(
    query: SuggestVehiclesQuery,
    ctx: AuthenticatedContext,
  ): Promise<SuggestVehiclesDto> {
    this.policy.requireStaff(ctx);

    const showroomId = resolveShowroomId(ctx, query.showroomId);

    const preference: MatchPreference = {
      makeId: query.preferredMakeId,
      modelId: query.preferredModelId,
      variantId: query.preferredVariantId,
      budget: query.budget,
      colours: query.preferredColours,
      fuelTypes: query.preferredFuelTypes,
      transmissions: query.preferredTransmissions,
      bodyTypes: query.preferredBodyTypes,
      yearMin: query.preferredYearMin,
      yearMax: query.preferredYearMax,
      kmMax: query.preferredKmMax,
      maxOwners: query.preferredMaxOwners,
    };

    if (!hasMatchCriteria(preference)) {
      return { suggestions: [], truncated: false };
    }

    const candidates = await this.vehicles.listMatchCandidates({
      showroomId,
      excludeVehicleId: null,
      limit: VEHICLE_MATCH_CANDIDATE_CAP,
    });

    const suggestions = candidates.vehicles
      .map((vehicle): VehicleMatchDto => ({
        vehicle,
        match: scoreLeadAgainstVehicle(preference, vehicle),
      }))
      .filter((candidate) => isSuggestibleMatch(candidate.match, query.minScore))
      .sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1))
      .slice(0, query.limit);

    return { suggestions, truncated: candidates.truncated };
  }
}
