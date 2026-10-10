-- Lead match preferences: the attributes a buyer wants, mirroring what a vehicle
-- records (colour, fuel, transmission, body type, year window, km ceiling,
-- previous owners). Every field is optional; empty arrays and nulls mean "any".
-- Together with the catalog preference and budget (the price ceiling) they feed
-- the lead <-> vehicle match score computed in the application (ADR-0013).
-- save_lead is recreated with eight trailing defaulted params.

alter table public.leads
  add column preferred_colours text[] not null default '{}',
  add column preferred_fuel_types text[] not null default '{}',
  add column preferred_transmissions text[] not null default '{}',
  add column preferred_body_types text[] not null default '{}',
  add column preferred_year_min smallint,
  add column preferred_year_max smallint,
  add column preferred_km_max integer,
  add column preferred_max_owners smallint,
  add constraint leads_preferred_colours_check check (
    array_position(preferred_colours, null) is null
    and cardinality(preferred_colours) <= 20
  ),
  add constraint leads_preferred_fuel_types_check check (
    preferred_fuel_types <@ array['petrol', 'diesel', 'cng', 'electric', 'hybrid']::text[]
  ),
  add constraint leads_preferred_transmissions_check check (
    preferred_transmissions <@ array['manual', 'automatic', 'amt', 'cvt', 'dct']::text[]
  ),
  add constraint leads_preferred_body_types_check check (
    preferred_body_types <@ array[
      'hatchback', 'sedan', 'suv', 'muv', 'mpv', 'crossover', 'coupe', 'convertible', 'sports', 'pick-up'
    ]::text[]
  ),
  add constraint leads_preferred_year_range_check check (
    (preferred_year_min is null or preferred_year_min between 1950 and 2100)
    and (preferred_year_max is null or preferred_year_max between 1950 and 2100)
    and (
      preferred_year_min is null
      or preferred_year_max is null
      or preferred_year_min <= preferred_year_max
    )
  ),
  add constraint leads_preferred_km_max_check check (
    preferred_km_max is null or preferred_km_max >= 0
  ),
  add constraint leads_preferred_max_owners_check check (
    preferred_max_owners is null or preferred_max_owners >= 0
  );

drop function if exists public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
);

drop function if exists private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
);

create function private.save_lead(
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

  select l.status, l.assigned_to
    into v_existing_status, v_existing_assignee
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

create function public.save_lead(
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
    p_status_notes,
    p_assigned_to,
    p_update_assignee,
    p_actor_id,
    p_preferred_make_id,
    p_preferred_model_id,
    p_preferred_variant_id,
    p_preferred_colours,
    p_preferred_fuel_types,
    p_preferred_transmissions,
    p_preferred_body_types,
    p_preferred_year_min,
    p_preferred_year_max,
    p_preferred_km_max,
    p_preferred_max_owners
  );
$$;

revoke all on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid, text[], text[], text[], text[], smallint, smallint, integer, smallint
) from public, anon, authenticated;

revoke all on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid, text[], text[], text[], text[], smallint, smallint, integer, smallint
) from public, anon, authenticated;

grant execute on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid, text[], text[], text[], text[], smallint, smallint, integer, smallint
) to service_role;

grant execute on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid, text[], text[], text[], text[], smallint, smallint, integer, smallint
) to service_role;
