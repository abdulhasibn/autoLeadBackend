import type { LeadId } from '../../../../domain/shared/lead-id';
import type { FinanceLeadFacts, IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import {
  currentBuyersOf,
  type CurrentBuyers,
  type VehicleMoneyTally,
} from '../../domain/vehicle-money';

export interface ResolvedBuyers {
  /** Current buyers per car id, ready for `VehicleMoneyTally.finish`. */
  readonly buyers: ReadonlyMap<string, CurrentBuyers>;
  /** Every lead looked up (booked, sold, or holding money), for names. */
  readonly leads: ReadonlyMap<string, FinanceLeadFacts>;
}

/**
 * Works out who each car's current buyers are (BE-77 §3) with two batched
 * lookups, so every report agrees with car money:
 * - sold car: its `sold_lead_id`; unsold car: its booking-confirmed leads;
 */
export class CarBuyers {
  constructor(
    private readonly leads: Pick<IFinanceLeadLookup, 'findMany' | 'listBookedForVehicles'>,
  ) {}

  async resolve(
    cars: readonly { readonly vehicle: FinanceVehicleFacts; readonly tally: VehicleMoneyTally }[],
  ): Promise<ResolvedBuyers> {
    const unsold = cars.filter((c) => c.vehicle.status !== 'sold').map((c) => c.vehicle.id);
    const booked = unsold.length === 0 ? new Map() : await this.leads.listBookedForVehicles(unsold);

    const wanted = new Set<LeadId>();
    for (const { vehicle, tally } of cars) {
      tally.leadIds().forEach((id) => wanted.add(id));
      if (vehicle.soldLeadId !== null) wanted.add(vehicle.soldLeadId);
    }
    const facts = new Map<string, FinanceLeadFacts>();
    for (const lead of wanted.size === 0 ? [] : await this.leads.findMany([...wanted])) {
      facts.set(lead.id, lead);
    }
    for (const list of booked.values()) for (const lead of list) facts.set(lead.id, lead);

    const buyers = new Map<string, CurrentBuyers>();
    for (const { vehicle } of cars) {
      const bookedLeads: readonly FinanceLeadFacts[] = booked.get(vehicle.id) ?? [];
      buyers.set(
        vehicle.id,
        currentBuyersOf(
          vehicle,
          bookedLeads.map((l) => l.id),
        ),
      );
    }
    return { buyers, leads: facts };
  }
}
