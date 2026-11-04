-- Website analytics, capture side (ADR-0016).
--
-- 1. web_sessions / web_events: first-party visits and events from the
--    customer site. The backend classifies the traffic channel before writing,
--    so these tables only ever hold a known channel.
-- 2. lead_attribution: where a website test-drive lead came from (first and
--    last touch), one row per lead.
-- 3. listed_price_history: every change to the plaintext listed price, so
--    demand can be compared before and after a price change.
-- 4. ingest_web_events: upserts the session and appends events, capped per
--    session per hour, and prunes events older than 13 months.
-- 5. submit_public_test_drive gains an optional p_attribution. Callers that
--    omit it behave exactly as before.
--
-- RLS on with no policies: backend (service_role) only.

-- ---------------------------------------------------------------------------
-- 1. Sessions and events
-- ---------------------------------------------------------------------------

create table public.web_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  channel text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  has_fbclid boolean not null default false,
  has_gclid boolean not null default false,
  referrer_host text,
  landing_path text not null,
  device text not null,
  in_app_browser text,
  city text,
  ip_hash text not null,
  constraint web_sessions_channel_check check (
    channel in (
      'instagram_ads',
      'instagram_organic',
      'facebook_ads',
      'facebook_organic',
      'google_ads',
      'google_organic',
      'whatsapp',
      'direct',
      'referral',
      'other'
    )
  ),
  constraint web_sessions_device_check check (device in ('mobile', 'desktop')),
  constraint web_sessions_in_app_browser_check check (
    in_app_browser is null or in_app_browser in ('instagram', 'facebook')
  )
);

create index web_sessions_started_idx on public.web_sessions (started_at);
create index web_sessions_visitor_idx on public.web_sessions (visitor_id);

alter table public.web_sessions enable row level security;

create table public.web_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.web_sessions (id) on delete cascade,
  visitor_id uuid not null,
  type text not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  path text not null,
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint web_events_type_check check (
    type in (
      'page_view',
      'car_view',
      'gallery_open',
      'filter_apply',
      'test_drive_open',
      'whatsapp_click',
      'call_click',
      'directions_click'
    )
  )
);

create index web_events_vehicle_type_occurred_idx
  on public.web_events (vehicle_id, type, occurred_at)
  where vehicle_id is not null;
create index web_events_occurred_idx on public.web_events (occurred_at);
create index web_events_visitor_idx on public.web_events (visitor_id);
-- The per-session hourly cap counts recent rows.
create index web_events_session_received_idx on public.web_events (session_id, received_at);

alter table public.web_events enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Lead attribution
-- ---------------------------------------------------------------------------

-- No foreign key to web_sessions: a visitor who blocks beacons can still
-- submit a test drive, so the session row may never exist.
create table public.lead_attribution (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  visitor_id uuid not null,
  session_id uuid not null,
  -- Last-touch channel: the one the lead is credited to.
  channel text not null,
  first_channel text not null,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_utm_term text,
  first_referrer_host text,
  first_landing_path text,
  last_utm_source text,
  last_utm_medium text,
  last_utm_campaign text,
  last_utm_content text,
  last_utm_term text,
  last_referrer_host text,
  last_landing_path text,
  created_at timestamptz not null default now(),
  constraint lead_attribution_channel_check check (
    channel in (
      'instagram_ads', 'instagram_organic', 'facebook_ads', 'facebook_organic',
      'google_ads', 'google_organic', 'whatsapp', 'direct', 'referral', 'other'
    )
    and first_channel in (
      'instagram_ads', 'instagram_organic', 'facebook_ads', 'facebook_organic',
      'google_ads', 'google_organic', 'whatsapp', 'direct', 'referral', 'other'
    )
  )
);

create index lead_attribution_visitor_idx on public.lead_attribution (visitor_id);

alter table public.lead_attribution enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Listed price history
-- ---------------------------------------------------------------------------

create table public.listed_price_history (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  -- null: the price was cleared (car taken off public pricing).
  price numeric(12, 2),
  changed_at timestamptz not null default now(),
  -- Writes come through the service role, so this is null unless a caller
  -- runs with a user JWT.
  changed_by uuid references public.users (id)
);

create index listed_price_history_vehicle_changed_idx
  on public.listed_price_history (vehicle_id, changed_at);

alter table public.listed_price_history enable row level security;

create function private.record_listed_price_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.listed_price is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.listed_price is not distinct from old.listed_price then
    return new;
  end if;

  insert into public.listed_price_history (vehicle_id, price, changed_by)
  values (
    new.vehicle_id,
    new.listed_price,
    (select u.id from public.users u where u.id = auth.uid())
  );
  return new;
end;
$$;

create trigger vehicle_financials_listed_price_history
  after insert or update of listed_price on public.vehicle_financials
  for each row execute function private.record_listed_price_change();

-- Today's prices become each car's first entry.
insert into public.listed_price_history (vehicle_id, price, changed_at)
select f.vehicle_id, f.listed_price, f.updated_at
from public.vehicle_financials f
where f.listed_price is not null;

revoke all on function private.record_listed_price_change() from public, anon, authenticated;
grant execute on function private.record_listed_price_change() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Event ingestion
-- ---------------------------------------------------------------------------

-- p_session: { id, visitorId, channel, utmSource, utmMedium, utmCampaign,
--   utmContent, utmTerm, hasFbclid, hasGclid, referrerHost, landingPath,
--   device, inAppBrowser, city } — already validated and classified.
-- p_events: [{ type, at, path, vehicleId, props }].
-- Returns the number of events stored.
create function private.ingest_web_events(
  p_session jsonb,
  p_events jsonb,
  p_ip_hash text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_hourly_cap constant int := 500;      -- events per session per hour
  v_session_id uuid := (p_session ->> 'id')::uuid;
  v_visitor_id uuid := (p_session ->> 'visitorId')::uuid;
  v_owner uuid;
  v_room int;
  v_inserted int;
begin
  -- Retention: 13 months of events; sessions go once they have nothing left.
  delete from public.web_events where occurred_at < now() - interval '13 months';
  delete from public.web_sessions where last_seen_at < now() - interval '13 months';

  insert into public.web_sessions (
    id, visitor_id, channel,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    has_fbclid, has_gclid, referrer_host, landing_path,
    device, in_app_browser, city, ip_hash
  )
  values (
    v_session_id,
    v_visitor_id,
    p_session ->> 'channel',
    p_session ->> 'utmSource',
    p_session ->> 'utmMedium',
    p_session ->> 'utmCampaign',
    p_session ->> 'utmContent',
    p_session ->> 'utmTerm',
    coalesce((p_session ->> 'hasFbclid')::boolean, false),
    coalesce((p_session ->> 'hasGclid')::boolean, false),
    p_session ->> 'referrerHost',
    p_session ->> 'landingPath',
    p_session ->> 'device',
    p_session ->> 'inAppBrowser',
    p_session ->> 'city',
    p_ip_hash
  )
  -- The landing touch is fixed at the first batch; later batches only extend it.
  on conflict (id) do update
    set last_seen_at = now(),
      city = coalesce(public.web_sessions.city, excluded.city)
    where public.web_sessions.visitor_id = excluded.visitor_id;

  -- A session id reused by a different visitor is ignored, not merged.
  select s.visitor_id into v_owner from public.web_sessions s where s.id = v_session_id;
  if v_owner is distinct from v_visitor_id then
    return 0;
  end if;

  select c_hourly_cap - count(*) into v_room
  from public.web_events e
  where e.session_id = v_session_id and e.received_at > now() - interval '1 hour';

  if v_room <= 0 then
    return 0;
  end if;

  insert into public.web_events (session_id, visitor_id, type, vehicle_id, path, props, occurred_at)
  select
    v_session_id,
    v_visitor_id,
    ev ->> 'type',
    -- An id that is not (or no longer) a vehicle is kept as a plain event.
    (select v.id from public.vehicles v where v.id = (ev ->> 'vehicleId')::uuid),
    ev ->> 'path',
    coalesce(ev -> 'props', '{}'::jsonb),
    -- Client clocks drift: keep the time within the last day, never future.
    least(greatest((ev ->> 'at')::timestamptz, now() - interval '1 day'), now())
  from jsonb_array_elements(p_events) with ordinality as t (ev, n)
  order by t.n
  limit v_room;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create function public.ingest_web_events(
  p_session jsonb,
  p_events jsonb,
  p_ip_hash text
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.ingest_web_events(p_session, p_events, p_ip_hash);
$$;

revoke all on function private.ingest_web_events(jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.ingest_web_events(jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.ingest_web_events(jsonb, jsonb, text) to service_role;
grant execute on function public.ingest_web_events(jsonb, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Test-drive intake with attribution
-- ---------------------------------------------------------------------------

-- Replaced rather than overloaded: two signatures that differ only by a
-- defaulted argument would make 4-argument calls ambiguous. Existing callers
-- (named 4-argument RPC) resolve to the new function unchanged.
drop function public.submit_public_test_drive(uuid, text, text, text);
drop function private.submit_public_test_drive(uuid, text, text, text);

-- p_attribution: { visitorId, sessionId, firstTouch, lastTouch }, each touch
-- { channel, utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
--   referrerHost, landingPath } — classified by the backend.
create function private.submit_public_test_drive(
  p_vehicle_id uuid,
  p_full_name text,
  p_phone text,
  p_ip_hash text,
  p_attribution jsonb default null
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
  v_first jsonb := p_attribution -> 'firstTouch';
  v_last jsonb := p_attribution -> 'lastTouch';
  v_source text := 'website';
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
    -- A Meta last touch credits the lead to that network; anything else
    -- (or no attribution) stays a plain website lead.
    if v_last ->> 'channel' in ('instagram_ads', 'instagram_organic') then
      v_source := 'instagram';
    elsif v_last ->> 'channel' in ('facebook_ads', 'facebook_organic') then
      v_source := 'facebook';
    end if;

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
      v_source,
      'new',
      v_car,
      v_note,
      c_system
    )
    returning id into v_lead_id;

    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, notes)
    values (v_lead_id, null, 'new', c_system, 'Website test-drive request');

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
  p_ip_hash text,
  p_attribution jsonb default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_public_test_drive(p_vehicle_id, p_full_name, p_phone, p_ip_hash, p_attribution);
$$;

revoke all on function private.submit_public_test_drive(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_public_test_drive(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.submit_public_test_drive(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.submit_public_test_drive(uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Grants: backend only
-- ---------------------------------------------------------------------------

revoke all on public.web_sessions, public.web_events, public.lead_attribution,
  public.listed_price_history from anon, authenticated;
grant select, insert, update, delete on public.web_sessions, public.web_events,
  public.lead_attribution, public.listed_price_history to service_role;
