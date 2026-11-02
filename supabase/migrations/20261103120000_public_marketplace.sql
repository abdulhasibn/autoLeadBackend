-- Public marketplace (ADR-0010): anonymous visitors browse Listed vehicles and
-- request a test drive, which lands as a `website` lead.
--
-- 1. A system user ("Website") that public writes are attributed to, because
--    leads.created_by, lead_status_history.changed_by and vehicle status
--    history all require a real actor. It has no roles and cannot sign in.
-- 2. public_vehicle_list: the only columns a visitor may ever see, limited to
--    Listed (open | linked), live vehicles.
-- 3. public_request_log + submit_public_test_drive: rate-limited, dedupe-aware
--    lead intake in one transaction. It never overwrites a stored contact.

-- ---------------------------------------------------------------------------
-- 1. System user
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  banned_until,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '0b5e0000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'website@system.autolead.local',
  '',
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"], "system": true}'::jsonb,
  '{"full_name": "Website"}'::jsonb,
  '2999-12-31 00:00:00+00',
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.users (id, full_name, email)
values ('0b5e0000-0000-4000-8000-000000000001', 'Website', 'website@system.autolead.local')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Public vehicle projection
-- ---------------------------------------------------------------------------

create view public.public_vehicle_list
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
  v.created_at
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id
left join public.vehicle_financials f on f.vehicle_id = v.id
where v.deleted_at is null
  and v.status in ('open', 'linked');

revoke all on public.public_vehicle_list from anon, authenticated;
grant select on public.public_vehicle_list to service_role;

-- Staff read the listed price alongside the vehicle (appended column, so the
-- view can be replaced in place).
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
  f.listed_price
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id
left join public.vehicle_financials f on f.vehicle_id = v.id;

revoke all on public.vehicle_list from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rate limit log + test-drive intake
-- ---------------------------------------------------------------------------

create table public.public_request_log (
  id bigint generated always as identity primary key,
  kind text not null,
  key text not null,
  created_at timestamptz not null default now()
);

create index public_request_log_kind_key_created_idx
  on public.public_request_log (kind, key, created_at desc);

alter table public.public_request_log enable row level security;

create function private.submit_public_test_drive(
  p_vehicle_id uuid,
  p_full_name text,
  p_phone text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_system constant uuid := '0b5e0000-0000-4000-8000-000000000001';
  c_ip_limit constant int := 5;          -- per IP per hour
  c_phone_limit constant int := 3;       -- per phone + vehicle per day
  v_phone_key text := p_phone || ':' || coalesce(p_vehicle_id::text, '-');
  v_listed boolean := false;
  v_car text;
  v_showroom_id uuid;
  v_contact_id uuid;
  v_contact_name text;
  v_lead_id uuid;
  v_assignee uuid;
  v_outcome text;
  v_note text;
  v_showroom jsonb;
begin
  delete from public.public_request_log where created_at < now() - interval '2 days';

  if (
    select count(*) from public.public_request_log
    where kind = 'test_drive_ip' and key = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= c_ip_limit or (
    select count(*) from public.public_request_log
    where kind = 'test_drive_phone' and key = v_phone_key and created_at > now() - interval '1 day'
  ) >= c_phone_limit then
    raise exception 'public request rate limited' using errcode = 'P0429';
  end if;

  insert into public.public_request_log (kind, key)
  values ('test_drive_ip', p_ip_hash), ('test_drive_phone', v_phone_key);

  -- The vehicle may have been sold or removed since the visitor loaded the page.
  select
    v.year || ' ' || mk.name || ' ' || mo.name,
    v.showroom_id,
    v.status in ('open', 'linked')
    into v_car, v_showroom_id, v_listed
  from public.vehicles v
  join public.variants va on va.id = v.variant_id
  join public.models mo on mo.id = va.model_id
  join public.makes mk on mk.id = mo.make_id
  where v.id = p_vehicle_id and v.deleted_at is null;

  if v_showroom_id is null then
    select s.id into v_showroom_id
    from public.showrooms s
    where s.is_active
    order by s.created_at
    limit 1;
  end if;

  select c.id, c.full_name into v_contact_id, v_contact_name
  from public.contacts c
  where c.phone = p_phone and c.deleted_at is null and c.merged_into_user_id is null;

  if v_contact_id is null then
    insert into public.contacts (full_name, phone, created_by)
    values (p_full_name, p_phone, c_system)
    returning id into v_contact_id;
    v_contact_name := p_full_name;
  end if;

  v_note := 'Website test-drive request'
    || case
      when v_car is null then ''
      when v_listed then ' for ' || v_car
      else ' for ' || v_car || ' (no longer available)'
    end
    || case
      when lower(v_contact_name) <> lower(p_full_name) then ' — submitted name: ' || p_full_name
      else ''
    end;

  if v_listed then
    select l.id, l.assigned_to into v_lead_id, v_assignee
    from public.leads l
    where l.contact_id = v_contact_id
      and l.vehicle_id = p_vehicle_id
      and l.deleted_at is null
      and l.status in ('new', 'not_now', 'booking_confirmed')
    order by l.created_at desc
    limit 1;
  end if;

  if v_lead_id is not null then
    update public.leads
    set notes = concat_ws(
        e'\n',
        nullif(notes, ''),
        to_char(now() at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') || ': ' || v_note || ' (repeat)'
      ),
      updated_at = now()
    where id = v_lead_id;
    v_outcome := 'updated';
  else
    insert into public.leads (
      showroom_id,
      vehicle_id,
      contact_id,
      source,
      status,
      preferred_vehicle,
      notes,
      created_by
    )
    values (
      v_showroom_id,
      case when v_listed then p_vehicle_id end,
      v_contact_id,
      'website',
      'new',
      v_car,
      v_note,
      c_system
    )
    returning id into v_lead_id;

    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, notes)
    values (v_lead_id, null, 'new', c_system, 'Website test-drive request');
    v_outcome := 'created';
  end if;

  -- Tell whoever owns it: the assignee, or every admin while it is unassigned.
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select
    r.user_id,
    'website_lead',
    'Website test-drive request',
    v_contact_name || coalesce(' wants to test drive the ' || v_car, ' requested a test drive'),
    'lead',
    v_lead_id
  from (
    select v_assignee as user_id
    where v_assignee is not null
    union
    select u.id
    from public.users u
    join public.user_roles ur on ur.user_id = u.id and ur.deleted_at is null
    join public.roles ro on ro.id = ur.role_id and ro.name = 'admin'
    where v_assignee is null and u.deleted_at is null
  ) r;

  select jsonb_build_object(
    'name', s.name,
    'address', s.address,
    'city', s.city,
    'phone', s.phone,
    'openingHours', s.opening_hours,
    'googleMapsUrl', s.google_maps_url
  )
    into v_showroom
  from public.showrooms s
  where s.id = v_showroom_id;

  return jsonb_build_object(
    'leadId', v_lead_id,
    'outcome', v_outcome,
    'vehicleAvailable', coalesce(v_listed, false),
    'linkedVehicleId', case when v_listed then p_vehicle_id end,
    'showroom', v_showroom
  );
end;
$$;

create function public.submit_public_test_drive(
  p_vehicle_id uuid,
  p_full_name text,
  p_phone text,
  p_ip_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_public_test_drive(p_vehicle_id, p_full_name, p_phone, p_ip_hash);
$$;

revoke all on function private.submit_public_test_drive(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.submit_public_test_drive(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function private.submit_public_test_drive(uuid, text, text, text) to service_role;
grant execute on function public.submit_public_test_drive(uuid, text, text, text) to service_role;
