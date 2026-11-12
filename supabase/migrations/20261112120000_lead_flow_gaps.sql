-- Lead flow gaps (lead ↔ car consistency).
--   * private.save_lead (body only; signature and grants unchanged):
--       - moving a lead to converted or lost cancels its open follow-ups and
--         marks their reminders read, the same way cancel_follow_up does;
--       - the assignee is notified when someone else's write makes their lead
--         vehicle_unavailable (lead_vehicle_unavailable) or clears its car
--         without a status change (lead_vehicle_removed). notifications.lead_id
--         is filled by the notifications_set_lead_id trigger.
--   * private.save_vehicle (body only): an update now also writes
--     acquisition_type, so staff can correct purchase vs commission on an
--     unsold car (the entity refuses it once sold).
--   * One-off: cancel open follow-ups already left on converted / lost leads.
-- Backward-compatible: old code calls save_lead with the same arguments.

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
  p_status_notes text,
  p_assigned_to uuid default null,
  p_update_assignee boolean default false,
  p_actor_id uuid default null,
  p_preferred_make_id uuid default null,
  p_preferred_model_id uuid default null,
  p_preferred_variant_id uuid default null,
  p_preferred_colours text[] default '{}',
  p_preferred_fuel_types text[] default '{}',
  p_preferred_transmissions text[] default '{}',
  p_preferred_body_types text[] default '{}',
  p_preferred_year_min smallint default null,
  p_preferred_year_max smallint default null,
  p_preferred_km_max integer default null,
  p_preferred_max_owners smallint default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_new boolean;
  v_existing_status text;
  v_existing_assignee uuid;
  v_existing_vehicle uuid;
  v_assignee uuid;
  v_actor uuid := coalesce(p_actor_id, p_created_by);
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

  select l.status, l.assigned_to, l.vehicle_id
    into v_existing_status, v_existing_assignee, v_existing_vehicle
  from public.leads l
  where l.id = p_id;
  v_is_new := not found;

  insert into public.leads as l (
    id,
    showroom_id,
    vehicle_id,
    user_id,
    contact_id,
    assigned_to,
    source,
    status,
    budget,
    preferred_vehicle,
    preferred_make_id,
    preferred_model_id,
    preferred_variant_id,
    preferred_colours,
    preferred_fuel_types,
    preferred_transmissions,
    preferred_body_types,
    preferred_year_min,
    preferred_year_max,
    preferred_km_max,
    preferred_max_owners,
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
    case when p_update_assignee then p_assigned_to else null end,
    p_source,
    p_status,
    p_budget,
    p_preferred_vehicle,
    p_preferred_make_id,
    p_preferred_model_id,
    p_preferred_variant_id,
    coalesce(p_preferred_colours, '{}'),
    coalesce(p_preferred_fuel_types, '{}'),
    coalesce(p_preferred_transmissions, '{}'),
    coalesce(p_preferred_body_types, '{}'),
    p_preferred_year_min,
    p_preferred_year_max,
    p_preferred_km_max,
    p_preferred_max_owners,
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
    assigned_to = case when p_update_assignee then excluded.assigned_to else l.assigned_to end,
    source = excluded.source,
    status = excluded.status,
    budget = excluded.budget,
    preferred_vehicle = excluded.preferred_vehicle,
    preferred_make_id = excluded.preferred_make_id,
    preferred_model_id = excluded.preferred_model_id,
    preferred_variant_id = excluded.preferred_variant_id,
    preferred_colours = excluded.preferred_colours,
    preferred_fuel_types = excluded.preferred_fuel_types,
    preferred_transmissions = excluded.preferred_transmissions,
    preferred_body_types = excluded.preferred_body_types,
    preferred_year_min = excluded.preferred_year_min,
    preferred_year_max = excluded.preferred_year_max,
    preferred_km_max = excluded.preferred_km_max,
    preferred_max_owners = excluded.preferred_max_owners,
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
      v_actor,
      p_status_notes
    );
  end if;

  -- Closing a lead closes its open follow-ups, as cancel_follow_up does.
  if not v_is_new
     and v_existing_status is distinct from p_status
     and p_status in ('converted', 'lost') then
    update public.notifications n
       set is_read = true
      from public.follow_ups f
     where n.entity_type = 'follow_up'
       and n.entity_id = f.id
       and f.lead_id = p_id
       and f.completed_at is null
       and f.deleted_at is null;

    update public.follow_ups
       set deleted_at = now(),
           cancelled_by = v_actor,
           updated_at = now()
     where lead_id = p_id
       and completed_at is null
       and deleted_at is null;
  end if;

  -- Tell the assignee when someone else takes their lead's car away.
  v_assignee := case when p_update_assignee then p_assigned_to else v_existing_assignee end;
  if not v_is_new and v_assignee is not null and v_assignee is distinct from v_actor then
    if v_existing_status is distinct from p_status and p_status = 'vehicle_unavailable' then
      insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
      values (
        v_assignee,
        'lead_vehicle_unavailable',
        'Car no longer available',
        coalesce(p_status_notes, 'The car on your lead is no longer available'),
        'lead',
        p_id
      );
    elsif v_existing_status is not distinct from p_status
          and v_existing_vehicle is not null
          and p_vehicle_id is null then
      insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
      values (
        v_assignee,
        'lead_vehicle_removed',
        'Car removed from lead',
        coalesce(p_status_notes, 'The car was removed from your lead'),
        'lead',
        p_id
      );
    end if;
  end if;

  if p_update_assignee and (
    (v_is_new and p_assigned_to is not null)
    or (not v_is_new and v_existing_assignee is distinct from p_assigned_to)
  ) then
    insert into public.audit_logs (
      entity_type,
      entity_id,
      action,
      actor_id,
      before_value,
      after_value
    )
    values (
      'lead',
      p_id,
      'lead.assigned',
      v_actor,
      jsonb_build_object('assigned_to', v_existing_assignee),
      jsonb_build_object('assigned_to', p_assigned_to)
    );

    if p_assigned_to is not null and p_assigned_to is distinct from v_actor then
      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        entity_type,
        entity_id
      )
      values (
        p_assigned_to,
        'lead_assigned',
        'New lead assigned',
        'A lead has been assigned to you',
        'lead',
        p_id
      );
    end if;
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- save_vehicle: acquisition_type is updatable. Body otherwise unchanged from
-- 20261005120000_vehicle_lead_status_lifecycle.sql.
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
  p_actor_id uuid,
  p_reason text default null,
  p_sold_lead_id uuid default null
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
    sold_lead_id,
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
    p_sold_lead_id,
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
    sold_lead_id = excluded.sold_lead_id,
    acquisition_type = excluded.acquisition_type,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  if v_existing_status is distinct from p_status then
    insert into public.vehicle_status_history (
      vehicle_id,
      from_status,
      to_status,
      changed_by,
      reason
    )
    values (
      p_id,
      v_existing_status,
      p_status,
      p_actor_id,
      p_reason
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- One-off: open follow-ups on leads that were already closed.
-- ---------------------------------------------------------------------------

update public.notifications n
   set is_read = true
  from public.follow_ups f
  join public.leads l on l.id = f.lead_id
 where n.entity_type = 'follow_up'
   and n.entity_id = f.id
   and l.status in ('converted', 'lost')
   and f.completed_at is null
   and f.deleted_at is null;

update public.follow_ups f
   set deleted_at = now(),
       updated_at = now()
  from public.leads l
 where l.id = f.lead_id
   and l.status in ('converted', 'lost')
   and f.completed_at is null
   and f.deleted_at is null;
