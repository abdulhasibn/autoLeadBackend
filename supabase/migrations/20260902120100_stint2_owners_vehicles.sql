-- Stint 2: Owners & Vehicles — catalog, owners, vehicles, financials, media, docs, status history

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.makes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deleted_at timestamptz
);

create unique index makes_name_active_uidx
  on public.makes (name)
  where deleted_at is null;

alter table public.makes enable row level security;

create table public.models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid not null references public.makes (id),
  name text not null,
  deleted_at timestamptz
);

create unique index models_make_name_active_uidx
  on public.models (make_id, name)
  where deleted_at is null;

alter table public.models enable row level security;

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id),
  name text not null,
  deleted_at timestamptz
);

create unique index variants_model_name_active_uidx
  on public.variants (model_id, name)
  where deleted_at is null;

alter table public.variants enable row level security;

-- ---------------------------------------------------------------------------
-- Owners
-- ---------------------------------------------------------------------------

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id),
  full_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  preferred_contact_method text,
  alt_phone text,
  id_info text,
  notes text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint owners_preferred_contact_method_check check (
    preferred_contact_method is null
    or preferred_contact_method in ('phone', 'email', 'whatsapp')
  )
);

create unique index owners_phone_active_uidx
  on public.owners (phone)
  where deleted_at is null;

create unique index owners_user_id_uidx
  on public.owners (user_id)
  where user_id is not null;

alter table public.owners enable row level security;

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references public.showrooms (id),
  owner_id uuid not null references public.owners (id),
  variant_id uuid not null references public.variants (id),
  year smallint not null,
  registration_number text not null,
  fuel_type text not null,
  transmission text not null,
  km_driven integer not null,
  num_previous_owners smallint not null default 0,
  colour text not null,
  insurance_valid_until date,
  rc_status text,
  service_history text,
  accident_history boolean not null default false,
  loan_status text,
  location text,
  description text,
  status text not null default 'submitted',
  acquisition_type text not null,
  submitted_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicles_fuel_type_check check (
    fuel_type in ('petrol', 'diesel', 'cng', 'electric', 'hybrid')
  ),
  constraint vehicles_transmission_check check (
    transmission in ('manual', 'automatic', 'amt', 'cvt', 'dct')
  ),
  constraint vehicles_rc_status_check check (
    rc_status is null
    or rc_status in ('clear', 'hypothecation', 'under_transfer')
  ),
  constraint vehicles_service_history_check check (
    service_history is null
    or service_history in ('full', 'partial', 'none', 'unknown')
  ),
  constraint vehicles_loan_status_check check (
    loan_status is null or loan_status in ('clear', 'active')
  ),
  constraint vehicles_status_check check (
    status in (
      'submitted',
      'inspection_pending',
      'under_inspection',
      'approved',
      'available',
      'reserved',
      'sold',
      'rejected',
      'on_hold',
      'removed'
    )
  ),
  constraint vehicles_acquisition_type_check check (
    acquisition_type in ('dealership_purchase', 'consignment', 'intermediary_sale')
  ),
  constraint vehicles_year_check check (year >= 1900 and year <= 2100),
  constraint vehicles_km_driven_check check (km_driven >= 0),
  constraint vehicles_num_previous_owners_check check (num_previous_owners >= 0)
);

create unique index vehicles_registration_active_uidx
  on public.vehicles (registration_number)
  where deleted_at is null;

create index vehicles_showroom_status_idx
  on public.vehicles (showroom_id, status);

create index vehicles_owner_id_idx
  on public.vehicles (owner_id);

create index vehicles_status_created_at_idx
  on public.vehicles (status, created_at desc);

alter table public.vehicles enable row level security;

-- ---------------------------------------------------------------------------
-- vehicle_financials (1:1)
-- ---------------------------------------------------------------------------

create table public.vehicle_financials (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null unique references public.vehicles (id) on delete cascade,
  owner_expected_price numeric(12, 2),
  company_purchase_price numeric(12, 2),
  expected_selling_price numeric(12, 2),
  minimum_selling_price numeric(12, 2),
  listed_price numeric(12, 2),
  commission_amount numeric(12, 2),
  commission_percent numeric(5, 2),
  other_costs numeric(12, 2),
  actual_selling_price numeric(12, 2),
  sold_at timestamptz,
  sold_by uuid references public.users (id),
  updated_at timestamptz not null default now(),
  constraint vehicle_financials_commission_percent_check check (
    commission_percent is null
    or (commission_percent >= 0 and commission_percent <= 100)
  )
);

alter table public.vehicle_financials enable row level security;

-- ---------------------------------------------------------------------------
-- vehicle_media
-- ---------------------------------------------------------------------------

create table public.vehicle_media (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  storage_path text not null,
  category text,
  sort_order smallint not null default 0,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  constraint vehicle_media_category_check check (
    category is null
    or category in (
      'front',
      'rear',
      'left',
      'right',
      'interior',
      'dashboard',
      'engine',
      'tyres',
      'other'
    )
  )
);

create index vehicle_media_vehicle_sort_idx
  on public.vehicle_media (vehicle_id, sort_order);

alter table public.vehicle_media enable row level security;

-- ---------------------------------------------------------------------------
-- vehicle_documents
-- ---------------------------------------------------------------------------

create table public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  doc_type text,
  storage_path text not null,
  is_sensitive boolean not null default true,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  constraint vehicle_documents_doc_type_check check (
    doc_type is null
    or doc_type in (
      'rc',
      'insurance',
      'service_record',
      'loan_clearance',
      'inspection_report',
      'other'
    )
  )
);

create index vehicle_documents_vehicle_type_idx
  on public.vehicle_documents (vehicle_id, doc_type);

alter table public.vehicle_documents enable row level security;

-- ---------------------------------------------------------------------------
-- vehicle_status_history (append-only)
-- ---------------------------------------------------------------------------

create table public.vehicle_status_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references public.users (id),
  reason text,
  changed_at timestamptz not null default now()
);

create index vehicle_status_history_vehicle_changed_idx
  on public.vehicle_status_history (vehicle_id, changed_at desc);

alter table public.vehicle_status_history enable row level security;
