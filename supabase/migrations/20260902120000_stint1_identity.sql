-- Stint 1: Identity — showrooms, roles, users, user_roles, custom access token hook
-- RLS enabled (deny-by-default for anon/authenticated); service_role bypasses for API.

create schema if not exists private;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- showrooms
-- ---------------------------------------------------------------------------

create table public.showrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  phone text not null,
  opening_hours jsonb,
  google_maps_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.showrooms enable row level security;

-- ---------------------------------------------------------------------------
-- roles (frozen catalog)
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  constraint roles_name_check check (
    name in ('admin', 'salesperson', 'owner', 'buyer')
  )
);

alter table public.roles enable row level security;

insert into public.roles (id, name, description) values
  ('a0000000-0000-4000-8000-000000000001', 'admin', 'Full operational control'),
  ('a0000000-0000-4000-8000-000000000002', 'salesperson', 'Vehicle intake and lead management'),
  ('a0000000-0000-4000-8000-000000000003', 'owner', 'Car owner portal access'),
  ('a0000000-0000-4000-8000-000000000004', 'buyer', 'Marketplace buyer account');

-- ---------------------------------------------------------------------------
-- users (app profile; id mirrors auth.users.id)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  avatar_url text,
  showroom_id uuid references public.showrooms (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index users_phone_active_uidx
  on public.users (phone)
  where deleted_at is null and phone is not null;

create index users_showroom_id_idx
  on public.users (showroom_id);

alter table public.users enable row level security;

-- ---------------------------------------------------------------------------
-- user_roles (additive multi-role)
-- ---------------------------------------------------------------------------

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  granted_by uuid references public.users (id),
  granted_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index user_roles_user_role_active_uidx
  on public.user_roles (user_id, role_id)
  where deleted_at is null;

create index user_roles_user_id_idx
  on public.user_roles (user_id);

alter table public.user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook
-- Injects active role names into claims.app_metadata.roles (never user_metadata).
-- Enable this function under Authentication → Hooks in the Supabase dashboard
-- (or config.toml [auth.hook.custom_access_token] for local).
-- ---------------------------------------------------------------------------

create or replace function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  role_names text[];
begin
  select coalesce(array_agg(r.name order by r.name), '{}')
  into role_names
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = (event->>'user_id')::uuid
    and ur.deleted_at is null;

  claims := event->'claims';

  -- Merge roles into app_metadata without wiping existing keys
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('roles', to_jsonb(role_names)),
    true
  );

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function private.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.user_roles to supabase_auth_admin;
grant select on table public.roles to supabase_auth_admin;

create policy "Allow auth admin to read user roles"
  on public.user_roles
  as permissive
  for select
  to supabase_auth_admin
  using (true);

create policy "Allow auth admin to read roles"
  on public.roles
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- Authenticated users may read the frozen roles catalog
create policy "Authenticated can read roles"
  on public.roles
  as permissive
  for select
  to authenticated
  using (true);
