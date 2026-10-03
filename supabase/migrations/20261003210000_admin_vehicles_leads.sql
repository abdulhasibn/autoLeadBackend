-- Admin first phase: seed a showroom, add notification due times,
-- and atomic RPCs for vehicles, leads, and follow-up reminders.

insert into public.showrooms (id, name, address, city, phone, is_active)
values (
  'b0000000-0000-4000-8000-000000000001',
  'AutoLead Bengaluru',
  '1 MG Road',
  'Bengaluru',
  '+918000000001',
  true
)
on conflict (id) do nothing;

alter table public.notifications
  add column due_at timestamptz;

create index notifications_user_due_idx
  on public.notifications (user_id, due_at);

-- ---------------------------------------------------------------------------
-- save_vehicle
-- ---------------------------------------------------------------------------

create or replace function private.save_vehicle(
  p_id uuid,
  p_showroom_id uuid,
  p_owner_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_registration_number text,
  p_fuel_type text,
  p_transmission text,
  p_km_driven integer,
  p_num_previous_owners smallint,
  p_colour text,
  p_insurance_valid_until date,
  p_rc_status text,
  p_service_history text,
  p_accident_history boolean,
  p_loan_status text,
  p_location text,
  p_description text,
  p_status text,
  p_acquisition_type text,
  p_submitted_by uuid,
  p_deleted_at timestamptz,
  p_actor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_status text;
begin
  select v.status
    into v_existing_status
  from public.vehicles v
  where v.id = p_id;

  insert into public.vehicles as veh (
    id,
    showroom_id,
    owner_id,
    variant_id,
    year,
    registration_number,
    fuel_type,
    transmission,
    km_driven,
    num_previous_owners,
    colour,
    insurance_valid_until,
    rc_status,
    service_history,
    accident_history,
    loan_status,
    location,
    description,
    status,
    acquisition_type,
    submitted_by,
    deleted_at
  )
  values (
    p_id,
    p_showroom_id,
    p_owner_id,
    p_variant_id,
    p_year,
    p_registration_number,
    p_fuel_type,
    p_transmission,
    p_km_driven,
    p_num_previous_owners,
    p_colour,
    p_insurance_valid_until,
    p_rc_status,
    p_service_history,
    p_accident_history,
    p_loan_status,
    p_location,
    p_description,
    p_status,
    p_acquisition_type,
    p_submitted_by,
    p_deleted_at
  )
  on conflict (id) do update set
    year = excluded.year,
    registration_number = excluded.registration_number,
    fuel_type = excluded.fuel_type,
    transmission = excluded.transmission,
    km_driven = excluded.km_driven,
    num_previous_owners = excluded.num_previous_owners,
    colour = excluded.colour,
    insurance_valid_until = excluded.insurance_valid_until,
    rc_status = excluded.rc_status,
    service_history = excluded.service_history,
    accident_history = excluded.accident_history,
    loan_status = excluded.loan_status,
    location = excluded.location,
    description = excluded.description,
    status = excluded.status,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  if v_existing_status is distinct from p_status then
    insert into public.vehicle_status_history (
      vehicle_id,
      from_status,
      to_status,
      changed_by
    )
    values (
      p_id,
      v_existing_status,
      p_status,
      p_actor_id
    );
  end if;
end;
$$;

create or replace function public.save_vehicle(
  p_id uuid,
  p_showroom_id uuid,
  p_owner_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_registration_number text,
  p_fuel_type text,
  p_transmission text,
  p_km_driven integer,
  p_num_previous_owners smallint,
  p_colour text,
  p_insurance_valid_until date,
  p_rc_status text,
  p_service_history text,
  p_accident_history boolean,
  p_loan_status text,
  p_location text,
  p_description text,
  p_status text,
  p_acquisition_type text,
  p_submitted_by uuid,
  p_deleted_at timestamptz,
  p_actor_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_vehicle(
    p_id,
    p_showroom_id,
    p_owner_id,
    p_variant_id,
    p_year,
    p_registration_number,
    p_fuel_type,
    p_transmission,
    p_km_driven,
    p_num_previous_owners,
    p_colour,
    p_insurance_valid_until,
    p_rc_status,
    p_service_history,
    p_accident_history,
    p_loan_status,
    p_location,
    p_description,
    p_status,
    p_acquisition_type,
    p_submitted_by,
    p_deleted_at,
    p_actor_id
  );
$$;

revoke all on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
) from public, anon, authenticated;

revoke all on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
) from public, anon, authenticated;

grant execute on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
) to service_role;

grant execute on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- save_lead
-- ---------------------------------------------------------------------------

create or replace function private.save_lead(
  p_id uuid,
  p_showroom_id uuid,
  p_vehicle_id uuid,
  p_contact_id uuid,
  p_contact_full_name text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_created_by uuid,
  p_source text,
  p_status text,
  p_budget numeric,
  p_preferred_vehicle text,
  p_purchase_timeline text,
  p_finance_required boolean,
  p_current_vehicle text,
  p_trade_in_required boolean,
  p_notes text,
  p_created_by uuid,
  p_deleted_at timestamptz,
  p_write_history boolean,
  p_status_notes text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_status text;
begin
  if p_contact_full_name is not null then
    insert into public.contacts as c (
      id,
      full_name,
      phone,
      email,
      created_by
    )
    values (
      p_contact_id,
      p_contact_full_name,
      p_contact_phone,
      p_contact_email,
      p_contact_created_by
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      email = excluded.email,
      updated_at = now();
  end if;

  select l.status
    into v_existing_status
  from public.leads l
  where l.id = p_id;

  insert into public.leads as l (
    id,
    showroom_id,
    vehicle_id,
    user_id,
    contact_id,
    source,
    status,
    budget,
    preferred_vehicle,
    purchase_timeline,
    finance_required,
    current_vehicle,
    trade_in_required,
    notes,
    created_by,
    deleted_at
  )
  values (
    p_id,
    p_showroom_id,
    p_vehicle_id,
    null,
    p_contact_id,
    p_source,
    p_status,
    p_budget,
    p_preferred_vehicle,
    p_purchase_timeline,
    p_finance_required,
    p_current_vehicle,
    p_trade_in_required,
    p_notes,
    p_created_by,
    p_deleted_at
  )
  on conflict (id) do update set
    vehicle_id = excluded.vehicle_id,
    contact_id = excluded.contact_id,
    source = excluded.source,
    status = excluded.status,
    budget = excluded.budget,
    preferred_vehicle = excluded.preferred_vehicle,
    purchase_timeline = excluded.purchase_timeline,
    finance_required = excluded.finance_required,
    current_vehicle = excluded.current_vehicle,
    trade_in_required = excluded.trade_in_required,
    notes = excluded.notes,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  if p_write_history and v_existing_status is distinct from p_status then
    insert into public.lead_status_history (
      lead_id,
      from_status,
      to_status,
      changed_by,
      notes
    )
    values (
      p_id,
      v_existing_status,
      p_status,
      p_created_by,
      p_status_notes
    );
  end if;
end;
$$;

create or replace function public.save_lead(
  p_id uuid,
  p_showroom_id uuid,
  p_vehicle_id uuid,
  p_contact_id uuid,
  p_contact_full_name text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_created_by uuid,
  p_source text,
  p_status text,
  p_budget numeric,
  p_preferred_vehicle text,
  p_purchase_timeline text,
  p_finance_required boolean,
  p_current_vehicle text,
  p_trade_in_required boolean,
  p_notes text,
  p_created_by uuid,
  p_deleted_at timestamptz,
  p_write_history boolean,
  p_status_notes text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_lead(
    p_id,
    p_showroom_id,
    p_vehicle_id,
    p_contact_id,
    p_contact_full_name,
    p_contact_phone,
    p_contact_email,
    p_contact_created_by,
    p_source,
    p_status,
    p_budget,
    p_preferred_vehicle,
    p_purchase_timeline,
    p_finance_required,
    p_current_vehicle,
    p_trade_in_required,
    p_notes,
    p_created_by,
    p_deleted_at,
    p_write_history,
    p_status_notes
  );
$$;

revoke all on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text
) from public, anon, authenticated;

revoke all on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text
) from public, anon, authenticated;

grant execute on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text
) to service_role;

grant execute on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text
) to service_role;

-- ---------------------------------------------------------------------------
-- schedule_follow_up (follow-up + due notification in one transaction)
-- ---------------------------------------------------------------------------

create or replace function private.schedule_follow_up(
  p_id uuid,
  p_lead_id uuid,
  p_assigned_to uuid,
  p_task_type text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_created_by uuid,
  p_notification_id uuid,
  p_due_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.deleted_at is null
  ) then
    raise exception 'Lead not found' using errcode = '23503';
  end if;

  insert into public.follow_ups (
    id,
    lead_id,
    assigned_to,
    task_type,
    scheduled_at,
    notes,
    created_by
  )
  values (
    p_id,
    p_lead_id,
    p_assigned_to,
    p_task_type,
    p_scheduled_at,
    p_notes,
    p_created_by
  );

  insert into public.notifications (
    id,
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    due_at
  )
  values (
    p_notification_id,
    p_assigned_to,
    'follow_up_due',
    'Follow-up due',
    concat('Follow-up (', p_task_type, ') is scheduled'),
    'follow_up',
    p_id,
    p_due_at
  );
end;
$$;

create or replace function public.schedule_follow_up(
  p_id uuid,
  p_lead_id uuid,
  p_assigned_to uuid,
  p_task_type text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_created_by uuid,
  p_notification_id uuid,
  p_due_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.schedule_follow_up(
    p_id,
    p_lead_id,
    p_assigned_to,
    p_task_type,
    p_scheduled_at,
    p_notes,
    p_created_by,
    p_notification_id,
    p_due_at
  );
$$;

revoke all on function private.schedule_follow_up(
  uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) from public, anon, authenticated;

revoke all on function public.schedule_follow_up(
  uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function private.schedule_follow_up(
  uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) to service_role;

grant execute on function public.schedule_follow_up(
  uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) to service_role;
