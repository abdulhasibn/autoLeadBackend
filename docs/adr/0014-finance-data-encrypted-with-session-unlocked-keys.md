# Finance data is encrypted with keys the admin unlocks per session

**Status:** accepted

Finance data (purchase rates, sale prices, payments, expenses, notes) must be readable only by the admin who holds the business's **finance key**. A database dump, a backup, Supabase dashboard access or a developer with database credentials must see ciphertext only. The admin uses web and mobile clients, and the backend still has to compute landing cost, profit, dues and P&L.

## Decision

- **Envelope encryption.** One random 256-bit **data key** (DEK) per business encrypts every finance row with AES-256-GCM. The DEK is never stored in plaintext. `finance_vault` stores it twice, wrapped by a key derived from the **finance key** and by a key derived from an offline **recovery key** (scrypt, N=2¹⁷, r=8, p=1, random salt per wrap). Changing the finance key re-wraps the DEK; no row is re-encrypted.
- **Generated keys.** Setup generates the finance key and the recovery key on the server and shows them once. Losing both means the finance data is permanently unreadable; setup makes the admin confirm the recovery key is stored.
- **Session unlock.** `POST /finance/unlock` derives the key, unwraps the DEK, and stores a session row holding the DEK wrapped by a key derived from a random secret `S`. The client receives `<sessionId>.<S>` and sends it as `X-Finance-Session`. `S` is never stored, so the database alone cannot unwrap the DEK. Sessions expire after 30 minutes idle and 8 hours in total, and end on lock, key change or recovery.
- **Crypto runs in the application layer**, through a `FinanceCipher` port that only `FinanceSessionService` can hand out. Repositories store and return sealed records. Clients do no crypto.
- **Row format.** Each finance row has plaintext metadata needed for SQL filtering (ids, showroom, car, kind, dates, timestamps, `deleted_at`) and one encrypted `payload` (amounts, purpose, tag ids, names, notes). Encryption is bound to `table:rowId` so ciphertext can't be moved between rows, and plaintext is padded to 256-byte buckets so length doesn't reveal amounts.
- **Plaintext by design:** `vehicle_financials.listed_price` (future marketplace, lead matching), lead `budget`, and `vehicle_financials.sold_at`.
- **Hardening.** Unlock is blocked for 15 minutes after 5 failures. Audit rows record finance actions without values. Finance keys, recovery keys, session tokens and payloads are redacted from logs. Finance responses send `Cache-Control: no-store`. Finance tables have RLS on with no policies.

## Consequences

- Anything that needs finance amounts runs inside an unlocked admin request. No background job, SQL view or other feature can read them. Other features never import finance; car screens compose car data and finance data on the client.
- Reports decrypt the rows in range and aggregate in memory. List endpoints require a bounded date range (≤ 366 days) except when scoped to one car.
- **Honest limit:** whoever deploys backend code is trusted while an admin is unlocked, because the DEK is in server memory during the request. This is covered by process controls (protected `main`, required review on `src/features/finance/**`, redaction tests), not by code.

## Considered Options

- **Server-held key (env var, KMS, Supabase Vault/pgsodium).** Rejected. The server, its operators and anyone with the key could read the data without the admin.
- **Client-side end-to-end encryption.** Rejected for now. The server could not compute profit or reports, and web and mobile would each need the same crypto and reporting code.
- **Admin-chosen passphrase as the finance key.** Rejected as the default: weaker against guessing. Can be revisited.
