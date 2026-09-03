-- Stint 3: Buyers — buyer profiles, preferences, saved vehicles, recently viewed

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  preferred_contact_method text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyers_preferred_contact_method_check check (
    preferred_contact_method is null
    or preferred_contact_method in ('phone', 'email', 'whatsapp')
  ),
  constraint buyers_budget_range_check check (
    budget_min is null
    or budget_max is null
    or budget_min <= budget_max
  )
);

alter table public.buyers enable row level security;

create table public.buyer_preferences (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete cascade,
  preference_type text not null,
  value text not null,
  created_at timestamptz not null default now(),
  constraint buyer_preferences_type_check check (
    preference_type in ('fuel_type', 'transmission', 'make')
  )
);

create index buyer_preferences_buyer_id_idx
  on public.buyer_preferences (buyer_id);

alter table public.buyer_preferences enable row level security;

create table public.saved_vehicles (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  saved_at timestamptz not null default now()
);

create unique index saved_vehicles_buyer_vehicle_uidx
  on public.saved_vehicles (buyer_id, vehicle_id);

alter table public.saved_vehicles enable row level security;

create table public.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index recently_viewed_buyer_viewed_idx
  on public.recently_viewed (buyer_id, viewed_at desc);

alter table public.recently_viewed enable row level security;
