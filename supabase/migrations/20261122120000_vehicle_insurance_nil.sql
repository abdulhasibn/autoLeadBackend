-- Insurance "Nil": staff can record that a car has no insurance, distinct from
-- "not filled in" (insurance_valid_until null, insurance_nil false).
--
-- 1. vehicles.insurance_nil boolean not null default false, never together
--    with a valid-until date.
-- 2. save_vehicle gains p_insurance_nil (default null). Null keeps the stored
--    flag (cleared if a date is now set), so the older backend, which does not
--    send it, never wipes it. Drops the 25-argument functions and recreates
--    them with 26; named-argument callers keep working.
-- 3. vehicle_list and public_vehicle_list append insurance_nil; the public view
--    also appends insurance_valid_until, rc_status, service_history and
--    accident_history for the showroom site's detail page.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.vehicles
  add column insurance_nil boolean not null default false;

-- Validated in 20261122120100_vehicle_insurance_nil_validate.sql.
alter table public.vehicles
  add constraint vehicles_insurance_nil_no_date_check
  check (not (insurance_nil and insurance_valid_until is not null)) not valid;

-- squawk-ignore ban-drop-function -- replaced below with one extra defaulted argument
drop function if exists public.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid);

-- squawk-ignore ban-drop-function -- replaced below with one extra defaulted argument
drop function if exists private.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid);

create function private.save_vehicle(
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
  p_sold_lead_id uuid default null,
  p_insurance_nil boolean default null
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
    insurance_nil,
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
    coalesce(p_insurance_nil, false) and p_insurance_valid_until is null,
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
    insurance_nil = excluded.insurance_valid_until is null
      and coalesce(p_insurance_nil, veh.insurance_nil),
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

create function public.save_vehicle(
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
  p_sold_lead_id uuid default null,
  p_insurance_nil boolean default null
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
    p_actor_id,
    p_reason,
    p_sold_lead_id,
    p_insurance_nil
  );
$$;

revoke all on function private.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid, boolean) from public, anon, authenticated;

revoke all on function public.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid, boolean) from public, anon, authenticated;

grant execute on function private.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid, boolean) to service_role;

grant execute on function public.save_vehicle(uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid, boolean) to service_role;


-- Views: body unchanged from the latest definitions, columns appended.

create or replace view public.vehicle_list
with (security_invoker = true)
as
select
  v.id,
  v.showroom_id,
  v.owner_id,
  v.variant_id,
  va.model_id,
  mo.make_id,
  mk.name as make_name,
  mo.name as model_name,
  va.name as variant_name,
  v.year,
  v.registration_number,
  v.fuel_type,
  v.transmission,
  v.km_driven,
  v.num_previous_owners,
  v.colour,
  v.insurance_valid_until,
  v.rc_status,
  v.service_history,
  v.accident_history,
  v.loan_status,
  v.location,
  v.description,
  v.status,
  v.sold_lead_id,
  v.acquisition_type,
  v.submitted_by,
  v.created_at,
  v.updated_at,
  v.deleted_at,
  f.listed_price,
  v.insurance_nil
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id
left join public.vehicle_financials f on f.vehicle_id = v.id;

revoke all on public.vehicle_list from anon, authenticated;

create or replace view public.public_vehicle_list
with (security_invoker = true)
as
select
  v.id,
  mo.make_id,
  va.model_id,
  mk.name as make_name,
  mo.name as model_name,
  va.name as variant_name,
  -- Catalog cells may list two styles ("crossover, suv"); expose them as an array.
  array(
    select lower(trim(part))
    from unnest(string_to_array(coalesce(va.body_type, mo.body_type), ',')) as part
    where trim(part) <> ''
  ) as body_types,
  v.year,
  v.fuel_type,
  v.transmission,
  v.km_driven,
  v.num_previous_owners,
  v.colour,
  v.description,
  f.listed_price,
  v.created_at,
  case when v.status = 'sold' then 'sold' else 'available' end as public_status,
  case
    when v.status = 'sold' then coalesce(f.sold_on, conv.converted_on, v.updated_at::date)
  end as sold_on,
  v.insurance_valid_until,
  v.insurance_nil,
  v.rc_status,
  v.service_history,
  v.accident_history
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id
left join public.vehicle_financials f on f.vehicle_id = v.id
-- When no sale date was recorded, the day the buying lead converted; a later
-- edit to the car (updated_at) must not move it back into the window.
left join lateral (
  select max(h.changed_at)::date as converted_on
  from public.lead_status_history h
  where h.lead_id = v.sold_lead_id and h.to_status = 'converted'
) conv on v.status = 'sold'
where v.deleted_at is null
  and (
    v.status in ('open', 'linked')
    or (
      v.status = 'sold'
      and coalesce(f.sold_on, conv.converted_on, v.updated_at::date) >= current_date - 90
    )
  );

revoke all on public.public_vehicle_list from anon, authenticated;
grant select on public.public_vehicle_list to service_role;
