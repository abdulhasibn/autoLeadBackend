set lock_timeout = '5s';
set statement_timeout = '60s';

-- `in_progress` is an active lead status (20261124120000). The two functions
-- that hard-code the active list now include it:
--   * dashboard_summary: active leads, the pipeline counts (adds
--     `in_progress`) and each aged car's active-lead count. Body otherwise
--     identical to 20261011120000_follow_up_completion.sql.
--   * submit_public_test_drive: a repeat request for the same car merges into
--     the customer's open lead instead of creating a duplicate. Body otherwise
--     identical to 20261104120000_website_analytics.sql.
-- Same signatures, so create or replace keeps the grants.

-- ---------------------------------------------------------------------------
-- dashboard_summary
-- ---------------------------------------------------------------------------

create or replace function private.dashboard_summary(
  p_showroom_id uuid,
  p_assignee_id uuid,
  p_from timestamptz,
  p_now timestamptz,
  p_prev_from timestamptz,
  p_prev_until timestamptz,
  p_today_end timestamptz,
  p_aged_before timestamptz,
  p_list_limit integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scoped_leads as (
    select l.id, l.status, l.source, l.vehicle_id, l.created_at,
           coalesce(c.full_name, u.full_name) as contact_name,
           coalesce(c.phone, u.phone) as contact_phone
      from public.leads l
      left join public.contacts c on c.id = l.contact_id
      left join public.users u on u.id = l.user_id
     where l.deleted_at is null
       and (p_showroom_id is null or l.showroom_id = p_showroom_id)
       and (p_assignee_id is null or l.assigned_to = p_assignee_id)
  ),
  active_leads as (
    select * from scoped_leads where status in ('new', 'in_progress', 'not_now', 'booking_confirmed')
  ),
  current_follow_ups as (
    select distinct on (f.lead_id)
           f.id, f.lead_id, f.task_type, f.scheduled_at,
           a.contact_name, a.contact_phone, a.vehicle_id
      from public.follow_ups f
      join active_leads a on a.id = f.lead_id
     where f.completed_at is null
       and f.deleted_at is null
     order by f.lead_id, f.scheduled_at asc
  ),
  overdue as (
    select * from current_follow_ups where scheduled_at < p_now
  ),
  due_today as (
    select * from current_follow_ups where scheduled_at >= p_now and scheduled_at < p_today_end
  ),
  without_follow_up as (
    select a.*
      from active_leads a
     where not exists (select 1 from current_follow_ups f where f.lead_id = a.id)
  ),
  scoped_vehicles as (
    select v.id, v.status, v.created_at, v.sold_lead_id
      from public.vehicles v
     where v.deleted_at is null
       and (p_showroom_id is null or v.showroom_id = p_showroom_id)
  ),
  aged as (
    select v.id, v.status, v.created_at
      from scoped_vehicles v
     where v.status in ('open', 'linked')
       and v.created_at < p_aged_before
  ),
  sales as (
    select distinct h.vehicle_id, h.changed_at
      from public.vehicle_status_history h
      join scoped_vehicles v on v.id = h.vehicle_id
     where h.to_status = 'sold'
       and h.changed_at >= p_prev_from
       and h.changed_at < p_now
       and (
         p_assignee_id is null
         or exists (
           select 1 from public.leads sl
            where sl.id = v.sold_lead_id and sl.assigned_to = p_assignee_id
         )
       )
  ),
  closures as (
    select h.lead_id, h.to_status, h.changed_at
      from public.lead_status_history h
      join scoped_leads l on l.id = h.lead_id
     where h.to_status in ('converted', 'lost')
       and h.changed_at >= p_prev_from
       and h.changed_at < p_now
  )
  select jsonb_build_object(
    'cars_sold', (
      select jsonb_build_object(
        'current', count(distinct vehicle_id) filter (where changed_at >= p_from),
        'previous', count(distinct vehicle_id) filter (where changed_at < p_prev_until)
      ) from sales
    ),
    'new_leads', (
      select jsonb_build_object(
        'current', count(*) filter (where created_at >= p_from and created_at < p_now),
        'previous', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_until)
      ) from scoped_leads
    ),
    'converted', (
      select jsonb_build_object(
        'current', count(distinct lead_id) filter (where changed_at >= p_from),
        'previous', count(distinct lead_id) filter (where changed_at < p_prev_until)
      ) from closures where to_status = 'converted'
    ),
    'lost', (
      select jsonb_build_object(
        'current', count(distinct lead_id) filter (where changed_at >= p_from),
        'previous', count(distinct lead_id) filter (where changed_at < p_prev_until)
      ) from closures where to_status = 'lost'
    ),
    'inventory', (
      select jsonb_build_object(
        'open', count(*) filter (where status = 'open'),
        'linked', count(*) filter (where status = 'linked')
      ) from scoped_vehicles
    ),
    'pipeline', (
      select jsonb_build_object(
        'new', count(*) filter (where status = 'new'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'not_now', count(*) filter (where status = 'not_now'),
        'booking_confirmed', count(*) filter (where status = 'booking_confirmed')
      ) from active_leads
    ),
    'overdue_follow_ups', jsonb_build_object(
      'total', (select count(*) from overdue),
      'items', (
        select coalesce(jsonb_agg(card order by scheduled_at), '[]'::jsonb)
          from (
            select f.scheduled_at,
                   jsonb_build_object(
                     'follow_up_id', f.id,
                     'lead_id', f.lead_id,
                     'task_type', f.task_type,
                     'scheduled_at', f.scheduled_at,
                     'contact_name', f.contact_name,
                     'contact_phone', f.contact_phone,
                     'vehicle', private.dashboard_vehicle_label(f.vehicle_id)
                   ) as card
              from overdue f
             order by f.scheduled_at
             limit p_list_limit
          ) cards
      )
    ),
    'today_follow_ups', jsonb_build_object(
      'total', (select count(*) from due_today),
      'items', (
        select coalesce(jsonb_agg(card order by scheduled_at), '[]'::jsonb)
          from (
            select f.scheduled_at,
                   jsonb_build_object(
                     'follow_up_id', f.id,
                     'lead_id', f.lead_id,
                     'task_type', f.task_type,
                     'scheduled_at', f.scheduled_at,
                     'contact_name', f.contact_name,
                     'contact_phone', f.contact_phone,
                     'vehicle', private.dashboard_vehicle_label(f.vehicle_id)
                   ) as card
              from due_today f
             order by f.scheduled_at
             limit p_list_limit
          ) cards
      )
    ),
    'leads_without_follow_up', jsonb_build_object(
      'total', (select count(*) from without_follow_up),
      'items', (
        select coalesce(jsonb_agg(card order by created_at), '[]'::jsonb)
          from (
            select l.created_at,
                   jsonb_build_object(
                     'lead_id', l.id,
                     'status', l.status,
                     'source', l.source,
                     'contact_name', l.contact_name,
                     'contact_phone', l.contact_phone,
                     'vehicle', private.dashboard_vehicle_label(l.vehicle_id),
                     'created_at', l.created_at
                   ) as card
              from without_follow_up l
             order by l.created_at
             limit p_list_limit
          ) cards
      )
    ),
    'aged_stock', jsonb_build_object(
      'total', (select count(*) from aged),
      'items', (
        select coalesce(jsonb_agg(card order by created_at), '[]'::jsonb)
          from (
            select v.created_at,
                   jsonb_build_object(
                     'vehicle_id', v.id,
                     'status', v.status,
                     'active_leads', (
                       select count(*) from public.leads l
                        where l.vehicle_id = v.id
                          and l.deleted_at is null
                          and l.status in ('new', 'in_progress', 'not_now', 'booking_confirmed')
                     ),
                     'created_at', v.created_at,
                     'vehicle', private.dashboard_vehicle_label(v.id)
                   ) as card
              from aged v
             order by v.created_at
             limit p_list_limit
          ) cards
      )
    )
  );
$$;


-- ---------------------------------------------------------------------------
-- submit_public_test_drive (private body; the public wrapper is unchanged)
-- ---------------------------------------------------------------------------

create or replace function private.submit_public_test_drive(
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
      and l.status in ('new', 'in_progress', 'not_now', 'booking_confirmed')
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

