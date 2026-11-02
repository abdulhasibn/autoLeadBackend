-- Finance vault and unlock sessions (ADR-0014, docs/plans/finance-phase-1-vault.md).
--
-- finance_vault holds the business data key (DEK) wrapped twice: by a key
-- derived from the admin's finance key and by one derived from the offline
-- recovery key. It never holds a key in plaintext. Salts and wrapped keys are
-- base64 text. One row per business, enforced by the singleton column.
--
-- finance_sessions holds the DEK wrapped by a key derived from a per-session
-- secret that only the client has, so the database alone cannot unwrap it.
--
-- Both tables are reached only by the backend's service role: RLS on, no
-- policies.

create table public.finance_vault (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  status text not null default 'pending',
  kdf jsonb not null,
  finance_salt text not null,
  finance_wrapped_dek text not null,
  recovery_salt text not null,
  recovery_wrapped_dek text not null,
  key_version integer not null default 1,
  failed_unlocks integer not null default 0,
  last_failed_unlock_at timestamptz,
  unlock_blocked_until timestamptz,
  created_by uuid not null references public.users (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_vault_singleton_check check (singleton),
  constraint finance_vault_singleton_key unique (singleton),
  constraint finance_vault_status_check check (status in ('pending', 'active')),
  constraint finance_vault_failed_unlocks_check check (failed_unlocks >= 0)
);

alter table public.finance_vault enable row level security;

create table public.finance_sessions (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  wrapped_dek text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  expires_at timestamptz not null
);

create index finance_sessions_user_id_idx
  on public.finance_sessions (user_id);

create index finance_sessions_expires_at_idx
  on public.finance_sessions (expires_at);

alter table public.finance_sessions enable row level security;
