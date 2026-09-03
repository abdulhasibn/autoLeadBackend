-- Stint 4: Leads & Sales — contacts, leads, lead status history, follow-ups

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  merged_into_user_id uuid references public.users (id),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index contacts_phone_active_unmerged_uidx
  on public.contacts (phone)
  where deleted_at is null and merged_into_user_id is null;

alter table public.contacts enable row level security;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references public.showrooms (id),
  vehicle_id uuid references public.vehicles (id),
  user_id uuid references public.users (id),
  contact_id uuid references public.contacts (id),
  assigned_to uuid references public.users (id),
  source text not null,
  status text not null default 'new',
  budget numeric(12, 2),
  preferred_vehicle text,
  purchase_timeline text,
  finance_required boolean,
  current_vehicle text,
  trade_in_required boolean,
  notes text,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leads_buyer_xor_check check (
    (user_id is not null and contact_id is null)
    or (user_id is null and contact_id is not null)
  ),
  constraint leads_source_check check (
    source in (
      'marketplace',
      'mobile_app',
      'website',
      'phone',
      'walkin',
      'whatsapp',
      'instagram',
      'facebook',
      'referral',
      'other'
    )
  ),
  constraint leads_status_check check (
    status in (
      'new',
      'contacted',
      'interested',
      'follow_up',
      'test_drive',
      'negotiation',
      'booking_confirmed',
      'sold',
      'lost',
      'not_interested',
      'no_response'
    )
  )
);

create index leads_showroom_status_created_idx
  on public.leads (showroom_id, status, created_at desc);

create index leads_assigned_status_idx
  on public.leads (assigned_to, status);

create index leads_vehicle_id_idx
  on public.leads (vehicle_id);

alter table public.leads enable row level security;

create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references public.users (id),
  notes text,
  changed_at timestamptz not null default now()
);

create index lead_status_history_lead_changed_idx
  on public.lead_status_history (lead_id, changed_at desc);

alter table public.lead_status_history enable row level security;

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  assigned_to uuid not null references public.users (id),
  task_type text not null,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  notes text,
  outcome text,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint follow_ups_task_type_check check (
    task_type in (
      'call',
      'whatsapp',
      'meeting',
      'test_drive',
      'send_quotation',
      'other'
    )
  )
);

create index follow_ups_assigned_schedule_idx
  on public.follow_ups (assigned_to, scheduled_at, completed_at);

create index follow_ups_lead_id_idx
  on public.follow_ups (lead_id);

alter table public.follow_ups enable row level security;
