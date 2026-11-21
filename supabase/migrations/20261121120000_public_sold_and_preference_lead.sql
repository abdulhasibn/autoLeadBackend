-- Public site: recently sold cars + "tell us what you want" preference lead.
--
-- 1. public_vehicle_list also lists cars sold in the last 90 days, tagged with
--    public_status ('available' | 'sold') and sold_on. Two columns appended, so
--    the view is replaced in place (grants and security_invoker are kept).
--    Sold cars expose no more than available ones: same columns, same
--    listed_price, no sold_lead_id.
-- 2. submit_public_preference_lead: a buyer leaves a contact plus optional
--    preferences (budget, body, fuel, transmission, make/model, a reference car).
--    Same rate limiting, contact find-or-create and attribution as
--    submit_public_test_drive.
--
-- Dedupe rule: a contact's most recent open WEB lead with no vehicle (source
-- website/instagram/facebook, status 'new', not deleted) is merged into rather
-- than duplicated. Leads from other sources, tied to a car, or already worked
-- (not_now, booking_confirmed, converted, lost) are never touched; a new lead
-- is created instead, so a returning buyer resurfaces.

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. View
-- ---------------------------------------------------------------------------

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
    when v.status = 'sold' then coalesce(f.sold_on, v.updated_at::date)
  end as sold_on
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id
left join public.vehicle_financials f on f.vehicle_id = v.id
where v.deleted_at is null
  and (
    v.status in ('open', 'linked')
    or (
      v.status = 'sold'
      and coalesce(f.sold_on, v.updated_at::date) >= current_date - 90
    )
  );

revoke all on public.public_vehicle_list from anon, authenticated;
grant select on public.public_vehicle_list to service_role;

-- ---------------------------------------------------------------------------
-- 2. Preference lead
-- ---------------------------------------------------------------------------

-- p_budget_max is in rupees. Array values outside the leads CHECK lists are
-- discarded (case-insensitive). p_attribution as in submit_public_test_drive.
create function private.submit_public_preference_lead(
  p_full_name text,
  p_phone text,
  p_ip_hash text,
  p_attribution jsonb default null,
  p_budget_max numeric default null,
  p_body_types text[] default null,
  p_fuel_types text[] default null,
  p_transmissions text[] default null,
  p_make text default null,
  p_model text default null,
  p_reference_vehicle_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_system constant uuid := '0b5e0000-0000-4000-8000-000000000001';
  c_ip_limit constant int := 5;          -- per IP per hour
  c_phone_limit constant int := 6;       -- per phone per day (the form posts twice: contact, then picks)
  v_showroom_id uuid;
  v_contact_id uuid;
  v_contact_name text;
  v_lead_id uuid;
  v_assignee uuid;
  v_created boolean;
  v_note text;
  v_showroom jsonb;
  v_first jsonb := p_attribution -> 'firstTouch';
  v_last jsonb := p_attribution -> 'lastTouch';
  v_source text := 'website';
  v_budget numeric(12, 2) := case when p_budget_max > 0 then round(p_budget_max, 2) end;
  v_body text[];
  v_fuel text[];
  v_trans text[];
  -- Free text lands in staff notes: control characters out, length capped.
  v_make_text text := nullif(left(trim(regexp_replace(p_make, '[[:cntrl:]]', ' ', 'g')), 60), '');
  v_model_text text := nullif(left(trim(regexp_replace(p_model, '[[:cntrl:]]', ' ', 'g')), 60), '');
  v_make_id uuid;
  v_model_id uuid;
  v_make_name text;
  v_model_name text;
  v_ref_car text;
  v_parts text[] := '{}';
begin
  -- Valid, de-duplicated values only.
  select coalesce(array_agg(distinct lower(trim(x))), '{}') into v_body
  from unnest(coalesce(p_body_types, '{}')) x
  where lower(trim(x)) = any (array[
    'hatchback', 'sedan', 'suv', 'muv', 'mpv', 'crossover', 'coupe', 'convertible', 'sports', 'pick-up'
  ]);
  select coalesce(array_agg(distinct lower(trim(x))), '{}') into v_fuel
  from unnest(coalesce(p_fuel_types, '{}')) x
  where lower(trim(x)) = any (array['petrol', 'diesel', 'cng', 'electric', 'hybrid']);
  select coalesce(array_agg(distinct lower(trim(x))), '{}') into v_trans
  from unnest(coalesce(p_transmissions, '{}')) x
  where lower(trim(x)) = any (array['manual', 'automatic', 'amt', 'cvt', 'dct']);

  delete from public.public_request_log where created_at < now() - interval '2 days';

  if (
    select count(*) from public.public_request_log
    where kind = 'preference_ip' and key = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= c_ip_limit or (
    select count(*) from public.public_request_log
    where kind = 'preference_phone' and key = p_phone and created_at > now() - interval '1 day'
  ) >= c_phone_limit then
    raise exception 'public request rate limited' using errcode = 'P0429';
  end if;

  insert into public.public_request_log (kind, key)
  values ('preference_ip', p_ip_hash), ('preference_phone', p_phone);

  select s.id into v_showroom_id
  from public.showrooms s
  where s.is_active
  order by s.created_at
  limit 1;

  -- Catalog match, case-insensitive. A model only counts under its make.
  if v_make_text is not null then
    select mk.id, mk.name into v_make_id, v_make_name
    from public.makes mk
    where lower(mk.name) = lower(v_make_text)
    order by mk.name
    limit 1;
    if v_make_id is not null and v_model_text is not null then
      select mo.id, mo.name into v_model_id, v_model_name
      from public.models mo
      where mo.make_id = v_make_id and lower(mo.name) = lower(v_model_text)
      order by mo.name
      limit 1;
    end if;
  end if;

  if p_reference_vehicle_id is not null then
    select v.year || ' ' || mk.name || ' ' || mo.name
      || case when va.name is not null and upper(va.name) <> 'NA' then ' ' || va.name else '' end
      into v_ref_car
    from public.vehicles v
    join public.variants va on va.id = v.variant_id
    join public.models mo on mo.id = va.model_id
    join public.makes mk on mk.id = mo.make_id
    where v.id = p_reference_vehicle_id and v.deleted_at is null;
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

  if v_budget is not null then
    v_parts := v_parts || ('budget up to ₹' || case
      when v_budget >= 10000000 then trim(to_char(v_budget / 10000000, 'FM999990.##')) || ' Cr'
      when v_budget >= 100000 then trim(to_char(v_budget / 100000, 'FM999990.##')) || ' L'
      else trim(to_char(v_budget, 'FM999999990'))
    end);
  end if;
  if cardinality(v_body) > 0 then
    v_parts := v_parts || ('body: ' || array_to_string(v_body, ', '));
  end if;
  if cardinality(v_fuel) > 0 then
    v_parts := v_parts || ('fuel: ' || array_to_string(v_fuel, ', '));
  end if;
  if cardinality(v_trans) > 0 then
    v_parts := v_parts || ('transmission: ' || array_to_string(v_trans, ', '));
  end if;
  if v_make_text is not null or v_model_text is not null then
    v_parts := v_parts || ('make/model: ' || concat_ws(' ', v_make_text, v_model_text));
  end if;

  v_note := 'Website preference form'
    || case when cardinality(v_parts) > 0 then ': ' || array_to_string(v_parts, '; ') else '' end
    || case when v_ref_car is not null then '. Wants a car like ' || v_ref_car else '' end
    || case
      when lower(v_contact_name) <> lower(p_full_name) then ' — submitted name: ' || p_full_name
      else ''
    end;

  select l.id, l.assigned_to into v_lead_id, v_assignee
  from public.leads l
  where l.contact_id = v_contact_id
    and l.vehicle_id is null
    and l.deleted_at is null
    and l.source in ('website', 'instagram', 'facebook')
    and l.status = 'new'
  order by l.created_at desc
  limit 1;

  if v_lead_id is not null then
    update public.leads l
    -- Add-only: an unauthenticated caller may fill gaps and add picks, never
    -- overwrite what staff (or an earlier visit) already recorded.
    set budget = coalesce(l.budget, v_budget),
      preferred_body_types = (
        select coalesce(array_agg(distinct x), '{}') from unnest(l.preferred_body_types || v_body) x
      ),
      preferred_fuel_types = (
        select coalesce(array_agg(distinct x), '{}') from unnest(l.preferred_fuel_types || v_fuel) x
      ),
      preferred_transmissions = (
        select coalesce(array_agg(distinct x), '{}') from unnest(l.preferred_transmissions || v_trans) x
      ),
      preferred_model_id = case
        when l.preferred_make_id is null then v_model_id
        else l.preferred_model_id
      end,
      preferred_make_id = coalesce(l.preferred_make_id, v_make_id),
      notes = concat_ws(
        e'\n',
        nullif(l.notes, ''),
        to_char(now() at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') || ': ' || v_note || ' (repeat)'
      ),
      updated_at = now()
    where l.id = v_lead_id;
    v_created := false;
  else
    -- A Meta last touch credits the lead to that network; anything else
    -- (or no attribution) stays a plain website lead.
    if v_last ->> 'channel' in ('instagram_ads', 'instagram_organic') then
      v_source := 'instagram';
    elsif v_last ->> 'channel' in ('facebook_ads', 'facebook_organic') then
      v_source := 'facebook';
    end if;

    insert into public.leads (
      showroom_id, vehicle_id, contact_id, source, status, budget,
      preferred_vehicle, preferred_make_id, preferred_model_id,
      preferred_body_types, preferred_fuel_types, preferred_transmissions,
      notes, created_by
    )
    values (
      v_showroom_id, null, v_contact_id, v_source, 'new', v_budget,
      nullif(concat_ws(' ', v_make_name, v_model_name), ''), v_make_id, v_model_id,
      v_body, v_fuel, v_trans,
      v_note, c_system
    )
    returning id into v_lead_id;

    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, notes)
    values (v_lead_id, null, 'new', c_system, 'Website preference form');

    if p_attribution is not null then
      insert into public.lead_attribution (
        lead_id, visitor_id, session_id, channel, first_channel,
        first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term,
        first_referrer_host, first_landing_path,
        last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term,
        last_referrer_host, last_landing_path
      )
      values (
        v_lead_id,
        (p_attribution ->> 'visitorId')::uuid,
        (p_attribution ->> 'sessionId')::uuid,
        v_last ->> 'channel',
        v_first ->> 'channel',
        v_first ->> 'utmSource',
        v_first ->> 'utmMedium',
        v_first ->> 'utmCampaign',
        v_first ->> 'utmContent',
        v_first ->> 'utmTerm',
        v_first ->> 'referrerHost',
        v_first ->> 'landingPath',
        v_last ->> 'utmSource',
        v_last ->> 'utmMedium',
        v_last ->> 'utmCampaign',
        v_last ->> 'utmContent',
        v_last ->> 'utmTerm',
        v_last ->> 'referrerHost',
        v_last ->> 'landingPath'
      );
    end if;
    v_created := true;
  end if;

  -- Tell whoever owns it: the assignee, or every admin while it is unassigned.
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select
    r.user_id,
    'website_lead',
    'Website preference request',
    v_contact_name || ' told us what they are looking for',
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
    'created', v_created,
    'outcome', case when v_created then 'created' else 'updated' end,
    'showroom', v_showroom
  );
end;
$$;

create function public.submit_public_preference_lead(
  p_full_name text,
  p_phone text,
  p_ip_hash text,
  p_attribution jsonb default null,
  p_budget_max numeric default null,
  p_body_types text[] default null,
  p_fuel_types text[] default null,
  p_transmissions text[] default null,
  p_make text default null,
  p_model text default null,
  p_reference_vehicle_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_public_preference_lead(
    p_full_name, p_phone, p_ip_hash, p_attribution, p_budget_max,
    p_body_types, p_fuel_types, p_transmissions, p_make, p_model, p_reference_vehicle_id
  );
$$;

revoke all on function private.submit_public_preference_lead(
  text, text, text, jsonb, numeric, text[], text[], text[], text, text, uuid
) from public, anon, authenticated;
revoke all on function public.submit_public_preference_lead(
  text, text, text, jsonb, numeric, text[], text[], text[], text, text, uuid
) from public, anon, authenticated;
grant execute on function private.submit_public_preference_lead(
  text, text, text, jsonb, numeric, text[], text[], text[], text, text, uuid
) to service_role;
grant execute on function public.submit_public_preference_lead(
  text, text, text, jsonb, numeric, text[], text[], text[], text, text, uuid
) to service_role;
