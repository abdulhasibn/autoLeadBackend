# Finance Phase 1 — vault, keys and unlock sessions

**Status:** approved plan · **Date:** 2026-11-02 · **Branch:** `feat/finance-1-vault` · **Design:** `docs/plans/finance-module.md`

## Context

The finance module (design: `docs/plans/finance-module.md`; decisions: `docs/adr/0014-…`, `docs/adr/0015-…`, both on `main`) stores every amount encrypted with a business data key (DEK) that only the admin's **finance key** can unlock. Phase 1 builds that foundation and nothing else: vault setup, finance/recovery keys, unlock sessions, the cipher every later phase uses, lockout, audit and log redaction. No ledger, car or report code yet. Outcome: an admin can set up the vault, unlock, lock, change the key and recover, and later phases get one call — `FinanceSessionService.open(ctx, token)` — that returns a ready `FinanceCipher` or throws 423.

Step 0: branch `feat/finance-1-vault` from `main`, mark ADR-0014/0015 `accepted` if you've accepted them.

## Flows (what the code must do)

| Flow | Steps |
|---|---|
| **Setup** `POST /finance/vault/setup` | Admin; no vault (or only an unconfirmed one) → generate DEK (32 bytes), finance key, recovery key, two salts → derive two KEKs (scrypt) → wrap DEK twice (AES-GCM, AAD `finance_vault:finance` / `finance_vault:recovery`) → save vault `status = pending` → return both keys **once**. |
| **Confirm** `POST /finance/vault/confirm { recoveryKey }` | Proves the recovery key was saved: unwrap with it; success → `status = active`. Unlock is refused while `pending`. A pending vault may be set up again (overwritten). |
| **Unlock** `POST /finance/unlock { financeKey }` | Admin; vault active; not blocked → derive KEK, unwrap DEK. Fail → count failure (5 in 15 min ⇒ blocked 15 min), audit, 422. Success → reset counter, purge expired sessions, create session: random secret `S` (32 bytes), session KEK = HKDF-SHA256(S, salt = sessionId, info `autolead-finance-session-v1`), store DEK wrapped by it (AAD `finance_sessions:<id>`) with idle (30 min) and absolute (8 h) expiry → return `sessionToken = <id>.<base64url(S)>`, `expiresAt`. |
| **Open** (every finance request) | Parse `X-Finance-Session` → load session → must belong to `ctx.userId` and not be expired (else 423) → HKDF → unwrap DEK → slide idle expiry → return `FinanceCipher` bound to the DEK. |
| **Lock** `POST /finance/lock` | Delete the session named by the header. Idempotent 204. |
| **Change key** `POST /finance/vault/change-key { currentKey }` | Valid session + current key re-checked (counts toward lockout) → new finance key + salt → re-wrap DEK → delete the caller's **other** sessions → return new key once. |
| **Recover** `POST /finance/vault/recover { recoveryKey }` | No session needed; lockout applies → unwrap with recovery key → new finance key **and** new recovery key, both re-wrapped → delete all sessions → return both once. |
| **Status** `GET /finance/vault` | `{ initialized, confirmed, unlocked, expiresAt }`; `unlocked` only when a valid header is sent (doesn't slide expiry). |

All routes: bearer + `FinancePolicy.requireAdmin`, `Cache-Control: no-store`.

## Key formats and crypto parameters

- **Finance key:** 15 random bytes (120 bits) → Crockford base32 (24 chars) → `FK-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (six groups of four, easier to type than 128 bits' uneven 26 chars). **Recovery key:** 32 bytes → `RK-…` (52 chars, groups of 4). Value objects normalise input (trim, uppercase, drop spaces/dashes, map `O→0`, `I/L→1`), check prefix (optional on input) and length, and keep the canonical form. Wrong format → 422 `VALIDATION_ERROR` before any crypto.
- **KDF:** `node:crypto` `scrypt`, N=2¹⁷, r=8, p=1, 32-byte output, `maxmem` 256 MB, 16-byte salt per wrap; params stored in `finance_vault.kdf` (jsonb) so they can change later. Tests inject N=2¹⁰.
- **Sealed format:** `v1.<keyVersion>.<base64(iv12 ‖ ciphertext ‖ tag16)>`, AES-256-GCM, AAD bound per row. Row payloads (used from Phase 2) are JSON padded to 256-byte buckets before sealing; key wraps aren't padded.
- DEK bytes are zero-filled after each request (best effort) and never logged, returned or stored unwrapped.

## Migration — `supabase/migrations/<ts>_finance_vault.sql`

- `finance_vault`: `id uuid pk`, `singleton boolean not null default true unique check (singleton)`, `status text check in ('pending','active')`, `kdf jsonb`, `finance_salt text`, `finance_wrapped_dek text`, `recovery_salt text`, `recovery_wrapped_dek text`, `key_version int default 1`, `failed_unlocks int default 0`, `last_failed_unlock_at timestamptz`, `unlock_blocked_until timestamptz`, `created_by uuid → users`, `confirmed_at`, `created_at`, `updated_at`. Salts/wraps are base64 text (avoids PostgREST `bytea` hex handling).
- `finance_sessions`: `id uuid pk`, `user_id uuid → users on delete cascade`, `wrapped_dek text`, `created_at`, `last_used_at`, `idle_expires_at`, `expires_at`; indexes on `user_id`, `expires_at`.
- RLS enabled, no policies (matches every other table). Then `docs/schema.dbml` + regenerate `src/infrastructure/supabase/database.types.ts`; apply to hosted only after your OK (`.claude/skills/sync-supabase-db`).

## Files — `src/features/finance/`

**domain/**
- `vault-secret.value-object.ts` (`FinanceKey`, `RecoveryKey`; shared base32 helper `crockford-base32.ts`)
- `money.value-object.ts` (integer paise, non-negative, `add`/`subtract`, `fromRupees`) — used from Phase 2, added now with tests since the cipher payload tests use it
- `finance-vault.entity.ts`: status, wraps, KDF params, lockout state; behaviour `confirm()`, `recordFailedUnlock(now)`, `recordSuccessfulUnlock()`, `isBlocked(now)`, `replaceFinanceWrap(...)`, `replaceRecoveryWrap(...)`
- `finance-session.entity.ts`: `isExpired(now)`, `touch(now)` (slides idle, capped at absolute)
- ids: `finance-vault-id.ts`, `finance-session-id.ts` (branded, like `src/domain/shared/vehicle-id.ts`)
- ports: `finance-vault.repository.ts`, `finance-vault.queries.ts` (status read for `GET /finance/vault`, keeps the read use case off the command repo), `finance-session.repository.ts`, `finance-cipher.port.ts` (`seal(plain: string, aad: string): string`, `open(sealed: string, aad: string): string`), `finance-crypto.port.ts` (`randomBytes`, `deriveKek(secret, salt, kdf)`, `deriveSessionKek(secret, sessionId)`, `wrap(key, dek, aad)`, `unwrap(key, wrapped, aad)`, `cipherFor(dek, keyVersion)`), `finance-audit-log.port.ts`
- `finance.constants.ts`: lockout (5 / 15 min), session lifetimes (30 min / 8 h), default KDF params

**application/**
- `errors/`: `finance-locked.error.ts` (423 `FINANCE_LOCKED`), `finance-not-initialized.error.ts` (409), `finance-already-initialized.error.ts` (409), `finance-vault-not-confirmed.error.ts` (409 `FINANCE_VAULT_NOT_CONFIRMED`), `invalid-finance-key.error.ts` (422 `INVALID_FINANCE_KEY`), `finance-unlock-blocked.error.ts` (429 `FINANCE_UNLOCK_BLOCKED`, message carries minutes left). Pattern: `src/features/users/application/errors/last-admin-protected.error.ts`. Corrupt rows reuse `src/domain/errors/data-integrity.error.ts` (500, generic message).
- `policies/finance.policy.ts`: `requireAdmin` via `requireAnyRole(ctx, [ROLE.ADMIN], …)` from `src/domain/shared/role.ts`
- `services/finance-session.service.ts`: `open(ctx, token)`, `peek(ctx, token)` (status, no slide), `parseToken`; the only producer of `FinanceCipher`
- `services/vault-keyring.ts`: wraps the data key under a finance/recovery key, and opens it with "derive + unwrap + lockout bookkeeping + audit"; used by setup, confirm, unlock, change-key and recover
- `dtos/`: vault status, setup result, unlock result, rotated keys
- `use-cases/`: `setup-vault`, `confirm-vault`, `unlock-vault`, `lock-vault`, `get-vault-status`, `change-finance-key`, `recover-vault` (`.use-case.ts` each)

**infrastructure/**
- `node-finance-crypto.ts` (implements `FinanceCrypto` with `scrypt`, `hkdfSync`, `createCipheriv('aes-256-gcm')`, `randomBytes`), `node-aes-gcm.cipher.ts` (implements `FinanceCipher`, padding, version prefix)
- `supabase-finance-vault.repository.ts`, `supabase-finance-session.repository.ts`, `finance-vault.mapper.ts`, `finance-session.mapper.ts` (pattern: `src/features/owners/infrastructure/supabase-owner.repository.ts`)
- `supabase-finance-audit-log.ts`: inserts into existing `audit_logs` (`entity_type 'finance_vault'`, `action 'finance.setup' | 'finance.confirm' | 'finance.unlock' | 'finance.unlock_failed' | 'finance.lock' | 'finance.change_key' | 'finance.recover'`, `actor_id`, `metadata` without values)

**presentation/**
- `finance.routes.ts` (bearer, `no-store` middleware, vault routes), `finance-session-token.ts` (reads `x-finance-session`; missing → `FinanceLockedError`)
- `controllers/` one per route (pattern: `src/features/owners/presentation/controllers/update-owner.controller.ts`, `requireAuth` from `src/presentation/http/middleware/require-auth.ts`)
- `schemas/`: `unlock.schemas.ts`, `confirm-vault.schemas.ts`, `change-finance-key.schemas.ts`, `recover-vault.schemas.ts` (Zod delegates to the value objects via `superRefine`)

**composition.ts**: `composeFinance(infraClient, { bearerMiddleware, clock })` → `{ router, errorMapper, sessionService }` (sessionService exposed only for later phases inside the feature; nothing outside finance uses it).

## Changes outside the feature

- `src/app/composition-root.ts`: compose finance, add router + `errorMapper`.
- `src/app/routes.ts`: `router.use('/finance', deps.financeRouter)`.
- `src/infrastructure/logging/logger.ts`: redact `req.headers["x-finance-session"]`, `*.financeKey`, `*.currentKey`, `*.recoveryKey`, `*.sessionToken`, `*.payload`, `*.dek`. Add an optional `destination` parameter so a test can capture output. (pino-http logs request headers, so the session header redaction matters.)
- `src/app/tests/routes.test.ts`: add the finance routes to `PROTECTED_ROUTES`.
- CORS: none — `cors()` default reflects requested headers.
- `docs/api.md`: Finance (vault) section; `postman/AutoLead-API.postman_collection.json`: Finance › Vault folder with a `financeSessionToken` variable; `docs/PROGRESS.md`; roadmap 5.0 → Done.

## Tests (`src/features/finance/tests/`, Vitest, fakes in `fakes.ts`)

- **Crypto** (real `node-finance-crypto`, low N): wrap/unwrap round-trip; wrong key fails; tampered byte fails; AAD swap fails; seal/open round-trip; equal plaintexts give different ciphertext; padding hides length (1-digit vs 7-digit amounts same length); unknown version rejected.
- **Value objects:** key generation round-trips through normalisation; lowercase/spaced/`O`-for-`0` input accepted; wrong prefix/length rejected; `Money` arithmetic and negatives rejected.
- **Use cases** (fake repos, fake clock, real crypto with low N): setup returns keys and stores no plaintext; setup twice → 409 (unless pending); confirm with wrong recovery key → 422; unlock while pending → 409; unlock success returns token; wrong key ×5 → 429, unblocks after 15 min; counter resets after success and after 15 quiet minutes; session idle expiry, absolute expiry, slide capped at absolute; other user's token → 423; lock is idempotent; change-key ends other sessions and old key stops working; recover rotates both keys and ends all sessions; non-admin → 403 on every use case.
- **Redaction:** log a fake request with the header and a body containing `financeKey` through `createLogger(..., destination)`; captured output contains neither value.
- **Routes:** finance routes return 401 without bearer (existing table test).

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test`.
2. `.claude/skills/architecture-compliance` on the diff (H1–H12, `docs/plans/finance-module.md` §10).
3. After you approve applying the migration: regenerate types, `pnpm typecheck` again.
4. Dev server (`preview_start` from `.claude/launch.json`), admin bearer from `docs/api.md` §2: setup → confirm → unlock → `GET /finance/vault` shows `unlocked: true` → lock → shows `false`; 5 wrong keys → 429; recover → old finance key rejected, new one works.
5. Supabase `execute_sql` (read-only): `finance_vault` / `finance_sessions` rows hold only base64 salts/wraps; `audit_logs` finance rows carry no keys or tokens.
6. `preview_logs` search for the finance key and session token used in step 4 → no hits.

## Later phases (unchanged, for orientation)

2 tags + entries ledger · 3 car deal, sale, quotes, profit, dues · 4 reports + summary · 5 seeder, Postman, docs. Phase 2 extends setup to seed the default tags (encrypted), plus a one-time "seed if none" for vaults created during Phase 1.
