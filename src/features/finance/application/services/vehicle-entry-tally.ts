import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import { VehicleMoneyTally } from '../../domain/vehicle-money';
import type { EntrySealer } from './entry.sealer';

/**
 * Folds every live ledger entry of one car into a {@link VehicleMoneyTally}.
 * Reads them all with `scan`, never a capped list, so a total can't miss rows.
 * The money tab and the sale guard both use this, so they agree on what the
 * buyer has paid.
 */
export async function tallyVehicleEntries(
  entries: Pick<IFinanceEntryQueries, 'scan'>,
  sealer: EntrySealer,
  cipher: FinanceCipher,
  vehicleId: VehicleId,
): Promise<VehicleMoneyTally> {
  const tally = new VehicleMoneyTally();
  for await (const page of entries.scan({ vehicleId })) {
    for (const row of page) tally.add(sealer.open(row, cipher));
  }
  return tally;
}
