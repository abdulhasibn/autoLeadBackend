-- Vehicle and lead status lifecycle (ADR-0011).
--
-- Vehicles: open, linked, dropped, sold. Leads: new, not_now, booking_confirmed,
-- converted, lost, vehicle_unavailable. vehicles.sold_lead_id records the lead
-- that bought the vehicle.
--
-- Compatibility plan (destructive status remap):
-- * Forward-only. Ship together with the API release that uses the new
--   statuses: the old API writes statuses this CHECK now rejects, and the new
--   API rejects the old values when it maps rows.
-- * Apply 20261004120000_lead_assignment first.
-- * Existing rows are remapped in place. Status history keeps the old values
--   (from_status/to_status have no CHECK) and no history rows are written for
--   the remap itself.

alter table public.vehicles drop constraint vehicles_status_check;
alter table public.leads drop constraint leads_status_check;

update public.leads
   set status = case status
     when 'sold' then 'converted'
     when 'contacted' then 'new'
     when 'interested' then 'new'
     when 'follow_up' then 'new'
     when 'test_drive' then 'new'
     when 'negotiation' then 'new'
     when 'no_response' then 'not_now'
     when 'not_interested' then 'lost'
     else status
   end
 where status in (
   'sold', 'contacted', 'interested', 'follow_up', 'test_drive', 'negotiation',
   'no_response', 'not_interested'
 );

update public.vehicles
   set status = case
     when status = 'sold' then 'sold'
     when status in ('rejected', 'removed') then 'dropped'
     else 'open'
   end
 where status not in ('open', 'linked', 'dropped', 'sold');

update public.vehicles v
   set status = 'linked'
 where v.status = 'open'
   and exists (
     select 1
       from public.leads l
      where l.vehicle_id = v.id
        and l.deleted_at is null
        and l.status in ('new', 'not_now', 'booking_confirmed')
   );

alter table public.vehicles
  add column sold_lead_id uuid references public.leads (id);

update public.vehicles v
   set sold_lead_id = buyer.id
  from (
    select distinct on (l.vehicle_id) l.vehicle_id, l.id
      from public.leads l
     where l.status = 'converted'
       and l.deleted_at is null
       and l.vehicle_id is not null
     order by l.vehicle_id, l.updated_at desc
  ) buyer
 where buyer.vehicle_id = v.id
   and v.status = 'sold';

create unique index vehicles_sold_lead_id_uidx
  on public.vehicles (sold_lead_id)
  where sold_lead_id is not null;

alter table public.vehicles alter column status set default 'open';

alter table public.vehicles
  add constraint vehicles_status_check
  check (status in ('open', 'linked', 'dropped', 'sold'));

alter table public.vehicles
  add constraint vehicles_sold_lead_status_check
  check (sold_lead_id is null or status = 'sold');

alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new', 'not_now', 'booking_confirmed', 'converted', 'lost', 'vehicle_unavailable'
  ));

-- save_vehicle gains p_sold_lead_id.

drop function if exists public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
);

drop function if exists private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
);

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
  p_sold_lead_id uuid default null
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
    p_sold_lead_id
  );
$$;

revoke all on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid
) from public, anon, authenticated;

revoke all on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid
) from public, anon, authenticated;

grant execute on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid
) to service_role;

grant execute on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text, uuid
) to service_role;
