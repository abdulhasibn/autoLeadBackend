# Finance Phase 5 — encrypted seed data, smoke checks, Postman sync

**Status:** approved plan, done 2026-11-08 · **Branch:** `feat/finance-5-seed-smoke` · **Design:** `docs/plans/finance-module.md`

**Outcome notes:** the live finance smoke run with a temporary vault was skipped because hosted gained a real vault on 2026-11-05 (left untouched); the Postman cloud push was replaced by a manual import (collection too large for the connector). The smoke script also gained `FINANCE_ONLY=1` and a macOS bash fix (`set +B`).

## Context

Phases 1–4 are on `main` (`529d5cd`). What's left from the finance plan (roadmap 5.4): test data that exercises finance, an automated live check, and publishing the Postman collection. Today `pnpm seed:test-data` creates six months of showroom activity but **no finance data** (the plaintext tables it used to fill are gone), so a fresh environment shows empty finance screens. The smoke script doesn't touch finance. The Postman mirror repo and cloud collection stop before Finance.

**Where the work happens:** this checkout is on your `feat/site-analytics` branch (one commit not on `main`). I won't touch it: Phase 5 runs in a separate git worktree on a new branch `feat/finance-5-seed-smoke` from `origin/main`, and the plan doc is saved as `docs/plans/finance-phase-5-seed-smoke.md` there.

## 1. Encrypted finance seed data (`pnpm seed:test-data`)

New `scripts/lib/seed-finance.ts`, called from `scripts/seed-test-data.ts` after the existing simulation (so earlier random draws, and therefore all existing seed data, are unchanged).

**Same code path as the API**, imported from `src/features/finance/` (no copy of the crypto):
- Vault: `NodeFinanceCrypto` + `DEFAULT_KDF_PARAMS`; finance key from `SEED_FINANCE_KEY` when set (validated by `FinanceKey.create`), otherwise generated; recovery key generated. The vault is written **active** (already confirmed). Keys are printed once at the end, like the seeded passwords; they are test-only.
- Rows: domain entities (`FinanceTag`, `FinanceEntry`, `VehicleDeal`, `VehicleQuote`) sealed with the real sealers (`TagSealer`, `EntrySealer`, `VehicleDealSealer`, `QuoteSealer`) and converted with the infrastructure mappers (`toFinanceTagRow`, `toFinanceEntryRow`, `toVehicleDealRow`, `toVehicleQuoteRow`).

**What it generates** (seeded PRNG from `scripts/lib/random.ts`, dates within the simulated six months):
- The 11 default tags (`DEFAULT_FINANCE_TAGS`) plus a few business tags (Rent, Salaries, Electricity, Marketing).
- Every non-deleted car: a deal (purchase rate ≈ 80–90% of listed price), 1–2 seller payments (about 15% of cars still owe the seller something), 1–4 tagged cost entries after intake, and 0–3 quotes on cars that got leads.
- Sold cars: a recorded sale (finalised ≈ 93–100% of listed, `soldOn` = simulated sale date) with a buyer token + balance; ~10% still owe a balance; ~5% have **no** recorded sale, so "awaiting sale price" isn't empty; a few post-sale costs.
- Business: monthly rent, salaries, electricity, marketing (unlinked expenses), occasional other income; two soft-deleted mistakes.
- **The client's worked example**: one sold car set to exactly purchase ₹5,00,000 (paid 2,00,000 + 3,00,000), mediator 10,000, painting/service/polish 5,000 each, insurance+tyres 15,000, travel/fuel 5,000, quote ₹5,85,000, sale ₹5,60,000, buyer 50,000 + 5,10,000. Its registration is printed so the team can open it.

**Self-check on every run (including `--dry-run`)**: open every sealed row with the cipher, and recompute the client car with `calculateVehicleMoney`. The script stops unless landing = ₹5,45,000 and profit = ₹15,000. The summary prints counts per kind, purpose and tag, cars with dues, awaiting-price count and stock value.

**Safety**: `assertEmpty()` also refuses when `finance_vault` or `finance_entries` has rows. Inserts follow the existing `insert()` batching. **I will not run it against hosted**: it only runs on an empty database, and hosted is full. Verified with `--dry-run` (which needs only the catalog read) and typecheck. Running it for real is your call (it is the same as today's re-seed flow after a wipe).

## 2. Smoke script (`scripts/smoke-api.sh`)

- Token-free section: add the 32 finance routes to `PROTECTED` (expect 401).
- New optional section when `FINANCE_KEY` is set (with admin credentials), **read-only**, safe on production: `GET /finance/vault` (confirmed) → unlock → tags, entries for this month, `GET /finance/vehicles/awaiting-sale-price`, all five reports and summary (200 + key fields), a 423 check without the header, a 422 check for a bad range → lock → 423 after lock. Without `FINANCE_KEY` it prints "Skipped finance checks".
- Run it locally against the dev server with a **temporary vault** (created and deleted by me as in earlier phases) to prove it passes.

## 3. Postman publishing

- Mirror repo `../autoLeadBackend-postman` (on `main`, clean): copy both JSON files; update `README.md` (files table, collection layout with Public marketplace + Finance folders, a finance smoke flow: Setup → Confirm → Unlock → Tags → Entries → Car money → Reports → Lock); commit and **push to its GitHub `main`**.
- Postman cloud "AutoLead API" in My Workspace via the Postman connector (`getCollections` to find the UID, then `.claude/skills/sync-postman/scripts/prepare-put.mjs` → `putCollection`, and `putEnvironment` for the new variables). If the connector isn't authorised, I stop and tell you; nothing else depends on it.
- Run the audit script before both: Finance must add no gaps (the 104 older gaps stay as they are).

## 4. Docs

`docs/PROGRESS.md` (finance done; how to seed; smoke usage), roadmap 5.4 → Done, `docs/api.md` "How frontend apps should start" gets a short finance first-run note (seeded key printed by the seeder; otherwise run setup), `.env.example` (if present) gains `SEED_FINANCE_KEY=` (commented, test-only), `docs/plans/finance-module.md` status → done.

## Critical files

- New: `scripts/lib/seed-finance.ts`, `docs/plans/finance-phase-5-seed-smoke.md`.
- Modified: `scripts/seed-test-data.ts` (call + assertEmpty + summary), `scripts/smoke-api.sh`, `docs/PROGRESS.md`, `docs/MVP_ROADMAP.md`, `docs/api.md`, `../autoLeadBackend-postman/{README.md,*.json}`.
- Reused (no changes): finance domain, sealers, mappers, `NodeFinanceCrypto`, `calculateVehicleMoney`, `scripts/lib/random.ts`, `scripts/lib/supabase.ts`.

## Verification

1. `pnpm typecheck` (covers `scripts/` via `tsconfig.scripts.json`), `pnpm lint`, `pnpm test`.
2. `pnpm seed:test-data --dry-run`: the self-check passes; summary shows finance distributions, the client car and its registration. (It refuses the real run on hosted because the DB isn't empty, as designed.)
3. Smoke script on the dev server: without `FINANCE_KEY` (finance skipped, 401s pass), then with a temporary vault's key (all finance checks pass); delete the temporary vault and data afterwards.
4. Postman: audit shows no Finance gaps; mirror repo pushed; cloud collection lists the Finance folders (spot-check one request).
5. Commit and push straight to `main` as before (after `git fetch`; rebase if `main` moved). Your `feat/site-analytics` branch and checkout stay untouched.
