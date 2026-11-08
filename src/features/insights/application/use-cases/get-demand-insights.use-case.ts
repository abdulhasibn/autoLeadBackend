import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import {
  BUDGET_BANDS,
  SEGMENT_GAP_POINTS,
  budgetBandOf,
  groupCounts,
  segmentOf,
  wholePercentages,
  zeroResultLabel,
} from '../../domain/demand';
import type { IInsightsQueries } from '../../domain/insights.queries';
import type { DemandInsightsDto, InsightsQuery } from '../dtos/insights.dto';
import { insightsWindow, type InsightsSettings } from '../insights-window';
import type { InsightsPolicy } from '../policies/insights.policy';

/** Zero-result searches listed by name. */
export const ZERO_RESULT_LIMIT = 3;

/**
 * What visitors search for on the website (filter_apply events) against live
 * stock: budget bands, body-type segments and searches with no matching car.
 */
export class GetDemandInsightsUseCase {
  constructor(
    private readonly policy: InsightsPolicy,
    private readonly queries: IInsightsQueries,
    private readonly clock: Clock,
    private readonly settings: InsightsSettings,
  ) {}

  async execute(query: InsightsQuery, ctx: AuthenticatedContext): Promise<DemandInsightsDto> {
    this.policy.requireAdmin(ctx);
    const { range, period } = insightsWindow(
      query.period,
      this.clock.now(),
      this.settings.timeZone,
    );
    const demand = await this.queries.getDemand(
      this.policy.showroom(query.showroomId),
      range,
      ZERO_RESULT_LIMIT,
    );

    const searchBands = withAllBands(groupCounts(demand.searchPrices, budgetBandOf));
    const stockBands = withAllBands(groupCounts(demand.stockPrices, budgetBandOf));
    const searchShare = wholePercentages(searchBands);
    const stockShare = wholePercentages(stockBands);

    const searchSegments = groupCounts(demand.searchBodyTypes, segmentOf);
    const stockSegments = groupCounts(demand.stockBodyTypes, segmentOf);
    const labels = [...new Set([...searchSegments.keys(), ...stockSegments.keys()])];
    const demandShares = wholePercentages(
      new Map(labels.map((l) => [l, searchSegments.get(l) ?? 0])),
    );
    const stockShares = wholePercentages(
      new Map(labels.map((l) => [l, stockSegments.get(l) ?? 0])),
    );
    const hasSearches = [...searchSegments.values()].some((n) => n > 0);

    return {
      period,
      budgetBands: BUDGET_BANDS.map((band) => ({
        band,
        searchShare: searchShare.get(band) ?? 0,
        stockShare: stockShare.get(band) ?? 0,
      })),
      segments: labels
        .map((label) => {
          const demandShare = demandShares.get(label) ?? 0;
          const stock = stockShares.get(label) ?? 0;
          return {
            label,
            demandShare,
            stockShare: stock,
            gap: hasSearches ? gapOf(demandShare, stock) : null,
          };
        })
        .sort((a, b) => b.demandShare - a.demandShare || b.stockShare - a.stockShare),
      zeroResultSearches: {
        count: demand.zeroResultCount,
        top: demand.zeroResultTop.map((search) => ({
          label: zeroResultLabel(search),
          count: search.count,
        })),
      },
    };
  }
}

function withAllBands(counts: Map<string, number>): Map<string, number> {
  return new Map(BUDGET_BANDS.map((band) => [band, counts.get(band) ?? 0]));
}

/** "under": demand outruns stock by the gap threshold; "over": the reverse. */
function gapOf(demandShare: number, stockShare: number): 'under' | 'over' | null {
  if (demandShare - stockShare >= SEGMENT_GAP_POINTS) return 'under';
  if (stockShare - demandShare >= SEGMENT_GAP_POINTS) return 'over';
  return null;
}
