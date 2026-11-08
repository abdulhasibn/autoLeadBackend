import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IInsightsQueries } from '../../domain/insights.queries';
import { leadIntent } from '../../domain/lead-intent';
import type { LeadJourneyDto } from '../dtos/insights.dto';
import { vehicleTitle } from '../insights-window';
import type { InsightsPolicy } from '../policies/insights.policy';

/** Other cars listed on a journey, most viewed first. */
export const OTHER_CARS_LIMIT = 5;

/** A lead without website attribution (walk-in, phone, or beacons blocked). */
export const NO_JOURNEY: LeadJourneyDto = {
  channel: null,
  campaign: null,
  content: null,
  firstVisitAt: null,
  visits: 0,
  viewsOfThisCar: 0,
  galleryOpens: 0,
  otherCarsViewed: [],
  intent: null,
};

/** The website visits behind one lead: channel, campaign, what they looked at. */
export class GetLeadJourneyUseCase {
  constructor(
    private readonly policy: InsightsPolicy,
    private readonly queries: IInsightsQueries,
  ) {}

  async execute(leadId: string, ctx: AuthenticatedContext): Promise<LeadJourneyDto> {
    this.policy.requireAdmin(ctx);
    const journey = await this.queries.getLeadJourney(leadId, OTHER_CARS_LIMIT);
    if (journey === null) {
      throw new NotFoundError('Lead not found');
    }
    if (!journey.hasAttribution) {
      return NO_JOURNEY;
    }
    return {
      channel: journey.channel,
      campaign: journey.campaign,
      content: journey.content,
      firstVisitAt: journey.firstVisitAt,
      visits: journey.visits,
      viewsOfThisCar: journey.viewsOfThisCar,
      galleryOpens: journey.galleryOpens,
      otherCarsViewed: journey.otherCars.map((car) => ({
        vehicleId: car.vehicleId,
        title: vehicleTitle(car),
        listedPrice: car.listedPrice,
        views: car.views,
      })),
      intent: leadIntent(journey),
    };
  }
}
