// Read-only report of money from a buyer on a car with no buyer (#32): live
// `sale` income entries on cars that are not sold and have no booked lead.
// Such a payment counts as cash in but shows in no dues row.
//
//   FINANCE_KEY=FK-... pnpm finance:orphan-sale-income
//
// Reads with the service role and unwraps the data key itself, so it writes
// nothing (not even a failed-unlock count). Fix what it lists in the CRM: book
// the buyer, record the sale, or delete or re-purpose the entry.

import { FINANCE_WRAP_AAD } from '../src/features/finance/application/services/vault-keyring';
import { EntrySealer } from '../src/features/finance/application/services/entry.sealer';
import { FinanceKey } from '../src/features/finance/domain/vault-secret.value-object';
import { NodeFinanceCrypto } from '../src/features/finance/infrastructure/node-finance-crypto';
import { SupabaseFinanceEntryQueries } from '../src/features/finance/infrastructure/supabase-finance-entry.queries';
import { SupabaseFinanceLeadLookup } from '../src/features/finance/infrastructure/supabase-finance-lead.lookup';
import { SupabaseFinanceVaultRepository } from '../src/features/finance/infrastructure/supabase-finance-vault.repository';
import { SupabaseFinanceVehicleLookup } from '../src/features/finance/infrastructure/supabase-finance-vehicle.lookup';
import type { VehicleId } from '../src/domain/shared/vehicle-id';
import { requireEnv, serviceRoleClient } from './lib/supabase';

async function main(): Promise<void> {
  const db = serviceRoleClient();
  const financeKey = FinanceKey.create(requireEnv('FINANCE_KEY'));

  const vault = await new SupabaseFinanceVaultRepository(db).find();
  if (vault === null) {
    console.log('No finance vault: nothing to check.');
    return;
  }
  const crypto = new NodeFinanceCrypto();
  const kek = await crypto.deriveKek(financeKey.value, vault.financeWrap.salt, vault.kdf);
  const dataKey = crypto.unwrapKey(kek, vault.financeWrap.wrappedKey, FINANCE_WRAP_AAD);
  kek.fill(0);
  if (dataKey === null) {
    console.error('Wrong finance key.');
    process.exit(1);
  }
  const cipher = crypto.cipherFor(dataKey, vault.keyVersion);
  dataKey.fill(0);

  const sealer = new EntrySealer();
  const payments = [];
  for await (const page of new SupabaseFinanceEntryQueries(db).scan({ kind: 'income' })) {
    for (const row of page) {
      const entry = sealer.open(row, cipher);
      if (!entry.isDeleted && entry.purpose === 'sale' && entry.vehicleId !== null) {
        payments.push(entry);
      }
    }
  }

  const vehicleIds = [...new Set(payments.map((p) => p.vehicleId as VehicleId))];
  const cars = new Map(
    (await new SupabaseFinanceVehicleLookup(db).findMany(vehicleIds)).map((c) => [c.id, c]),
  );
  const leads = new SupabaseFinanceLeadLookup(db);
  const withoutBuyer = new Set<string>();
  for (const id of vehicleIds) {
    if (cars.get(id)?.status === 'sold') continue;
    if ((await leads.listBookedForVehicle(id)).length === 0) withoutBuyer.add(id);
  }

  const orphans = payments.filter((p) => withoutBuyer.has(p.vehicleId as string));
  if (orphans.length === 0) {
    console.log(`Checked ${payments.length} buyer payments: none on a car without a buyer.`);
    return;
  }
  console.log(`${orphans.length} buyer payment(s) on a car without a buyer:`);
  for (const p of orphans) {
    const car = cars.get(p.vehicleId as VehicleId);
    console.log(
      [
        p.id,
        p.entryDate.value,
        `Rs ${(p.amount.paise / 100).toLocaleString('en-IN')}`,
        car?.label ?? p.vehicleId,
        `car ${car?.status ?? 'unknown'}`,
        p.note ?? '',
      ].join(' | '),
    );
  }
  process.exitCode = 2;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
