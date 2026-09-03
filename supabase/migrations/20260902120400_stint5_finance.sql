-- Stint 5: Finance — unified expenses + income

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references public.showrooms (id),
  type text not null,
  vehicle_id uuid references public.vehicles (id),
  category text not null,
  amount numeric(12, 2) not null,
  description text,
  incurred_on date not null,
  recorded_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_type_check check (type in ('vehicle', 'business')),
  constraint expenses_vehicle_fk_check check (
    (type = 'vehicle' and vehicle_id is not null)
    or (type = 'business' and vehicle_id is null)
  ),
  constraint expenses_amount_check check (amount >= 0)
);

create index expenses_showroom_type_date_idx
  on public.expenses (showroom_id, type, incurred_on);

create index expenses_vehicle_id_idx
  on public.expenses (vehicle_id);

alter table public.expenses enable row level security;

create table public.income (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references public.showrooms (id),
  category text not null,
  vehicle_id uuid references public.vehicles (id),
  amount numeric(12, 2) not null,
  description text,
  received_on date not null,
  recorded_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint income_category_check check (
    category in (
      'vehicle_sale',
      'commission',
      'finance_commission',
      'insurance_commission',
      'other'
    )
  ),
  constraint income_amount_check check (amount >= 0)
);

create index income_showroom_category_date_idx
  on public.income (showroom_id, category, received_on);

alter table public.income enable row level security;
