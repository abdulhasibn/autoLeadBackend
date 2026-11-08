-- Insights read functions (owner Insights page, ADR-0016 read side).
--
-- Read-only: no tables or columns change. Each function returns raw counts
-- in one round-trip; rates, signals, bands and labels are computed in the API
-- (features/insights), like dashboard_summary (ADR-0012).
--
-- Windows are half-open: [p_from, p_until).
-- Website sessions belong to no showroom, so p_showroom_id filters leads and
-- vehicles only. Listed prices come from vehicle_financials.listed_price, the
-- plaintext column; the encrypted finance payload is never read (ADR-0014).
--
-- Backend only: service_role, private.fn wrapped by public.fn.

-- Lead journeys look up a visitor's sessions and events.
create index if not exists web_sessions_visitor_started_idx
  on public.web_sessions (visitor_id, started_at);

-- ---------------------------------------------------------------------------
-- 1. Traffic: visitors, sessions, attributed leads, channels, campaigns
-- ---------------------------------------------------------------------------

create function private.insights_traffic(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_prev_from timestamptz,
  p_prev_until timestamptz,
  p_campaign_limit int
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  cur_sessions as (
    select s.id, s.visitor_id, s.channel, s.utm_campaign, s.utm_content, s.device, s.city
    from public.web_sessions s
    where s.started_at >= p_from and s.started_at < p_until
  ),
  prev_sessions as (
    select s.id, s.visitor_id
    from public.web_sessions s
    where s.started_at >= p_prev_from and s.started_at < p_prev_until
  ),
  attributed as (
    select
      la.channel,
      la.last_utm_campaign as campaign,
      la.last_utm_content as content,
      l.created_at,
      (
        l.status in ('booking_confirmed', 'converted')
        or exists (
          select 1 from public.lead_status_history h
          where h.lead_id = l.id and h.to_status in ('booking_confirmed', 'converted')
        )
      ) as booked,
      l.status = 'converted' as sold
    from public.lead_attribution la
    join public.leads l on l.id = la.lead_id
    where l.deleted_at is null
      and (p_showroom_id is null or l.showroom_id = p_showroom_id)
      and (
        (l.created_at >= p_from and l.created_at < p_until)
        or (l.created_at >= p_prev_from and l.created_at < p_prev_until)
      )
  ),
  cur_leads as (
    select * from attributed where created_at >= p_from and created_at < p_until
  ),
  prev_leads as (
    select * from attributed where created_at >= p_prev_from and created_at < p_prev_until
  ),
  channel_visitors as (
    select channel, count(distinct visitor_id) as visitors from cur_sessions group by channel
  ),
  channel_events as (
    select
      s.channel,
      count(*) filter (where e.type = 'car_view') as car_views,
      count(*) filter (where e.type = 'test_drive_open') as test_drive_opens
    from public.web_events e
    join cur_sessions s on s.id = e.session_id
    where e.type in ('car_view', 'test_drive_open')
    group by s.channel
  ),
  channel_leads as (
    select
      channel,
      count(*) as leads,
      count(*) filter (where booked) as bookings,
      count(*) filter (where sold) as sold
    from cur_leads
    group by channel
  ),
  channels as (
    select
      c.channel,
      coalesce(v.visitors, 0) as visitors,
      coalesce(e.car_views, 0) as car_views,
      coalesce(e.test_drive_opens, 0) as test_drive_opens,
      coalesce(l.leads, 0) as leads,
      coalesce(l.bookings, 0) as bookings,
      coalesce(l.sold, 0) as sold
    from (select channel from channel_visitors union select channel from channel_leads) c
    left join channel_visitors v on v.channel = c.channel
    left join channel_events e on e.channel = c.channel
    left join channel_leads l on l.channel = c.channel
  ),
  campaign_visits as (
    select utm_campaign as campaign, utm_content as content, count(*) as visits
    from cur_sessions
    where utm_campaign is not null
    group by 1, 2
  ),
  campaign_leads as (
    select campaign, content, count(*) as leads, count(*) filter (where booked) as bookings
    from cur_leads
    where campaign is not null
    group by 1, 2
  ),
  campaigns as (
    select
      coalesce(v.campaign, l.campaign) as campaign,
      coalesce(v.content, l.content) as content,
      coalesce(v.visits, 0) as visits,
      coalesce(l.leads, 0) as leads,
      coalesce(l.bookings, 0) as bookings
    from campaign_visits v
    full join campaign_leads l
      on l.campaign = v.campaign and coalesce(l.content, '') = coalesce(v.content, '')
    order by visits desc, leads desc, campaign
    limit p_campaign_limit
  ),
  cities as (
    select city, count(distinct visitor_id) as visitors
    from cur_sessions
    group by city
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from cur_sessions),
      'sessions', (select count(*) from cur_sessions),
      'leads', (select count(*) from cur_leads)
    ),
    'previous', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from prev_sessions),
      'sessions', (select count(*) from prev_sessions),
      'leads', (select count(*) from prev_leads)
    ),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'channel', channel,
        'visitors', visitors,
        'car_views', car_views,
        'test_drive_opens', test_drive_opens,
        'leads', leads,
        'bookings', bookings,
        'sold', sold
      ) order by visitors desc, leads desc, channel), '[]'::jsonb)
      from channels
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'campaign', campaign,
        'content', content,
        'visits', visits,
        'leads', leads,
        'bookings', bookings
      )), '[]'::jsonb)
      from campaigns
    ),
    'devices', jsonb_build_object(
      'mobile', (select count(distinct visitor_id) from cur_sessions where device = 'mobile'),
      'desktop', (select count(distinct visitor_id) from cur_sessions where device = 'desktop')
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'city', city,
        'visitors', visitors
      ) order by visitors desc, city), '[]'::jsonb)
      from cities
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Vehicle stats: live stock (plus one named vehicle) with website demand
-- ---------------------------------------------------------------------------

create function private.insights_vehicle_stats(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_vehicle_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  stock as (
    select
      v.id,
      v.year,
      mk.name as make,
      mo.name as model,
      va.name as variant,
      coalesce(mo.body_type, va.body_type) as body_type,
      f.listed_price,
      v.created_at
    from public.vehicles v
    join public.variants va on va.id = v.variant_id
    join public.models mo on mo.id = va.model_id
    join public.makes mk on mk.id = mo.make_id
    left join public.vehicle_financials f on f.vehicle_id = v.id
    where v.deleted_at is null
      and (p_showroom_id is null or v.showroom_id = p_showroom_id)
      and (v.status in ('open', 'linked') or v.id = p_vehicle_id)
  ),
  ev as (
    select e.vehicle_id, e.type, e.visitor_id, e.session_id, s.channel
    from public.web_events e
    join public.web_sessions s on s.id = e.session_id
    where e.vehicle_id in (select id from stock)
      and e.occurred_at >= p_from and e.occurred_at < p_until
      and e.type in ('car_view', 'test_drive_open', 'whatsapp_click', 'call_click')
  ),
  views as (
    select vehicle_id, count(*) as views, count(distinct visitor_id) as unique_viewers
    from ev where type = 'car_view'
    group by vehicle_id
  ),
  repeats as (
    select vehicle_id, count(*) as repeat_viewers
    from (
      select vehicle_id, visitor_id
      from ev where type = 'car_view'
      group by vehicle_id, visitor_id
      having count(distinct session_id) >= 2
    ) r
    group by vehicle_id
  ),
  actions as (
    select
      vehicle_id,
      count(*) filter (where type = 'test_drive_open') as test_drive_opens,
      count(*) filter (where type in ('whatsapp_click', 'call_click')) as contact_clicks
    from ev
    group by vehicle_id
  ),
  top_channel as (
    select distinct on (vehicle_id) vehicle_id, channel
    from (
      select vehicle_id, channel, count(*) as n
      from ev where type = 'car_view'
      group by vehicle_id, channel
    ) c
    order by vehicle_id, n desc, channel
  ),
  lead_counts as (
    select l.vehicle_id, count(*) as leads
    from public.leads l
    where l.vehicle_id in (select id from stock)
      and l.deleted_at is null
      and l.created_at >= p_from and l.created_at < p_until
    group by l.vehicle_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'vehicle_id', s.id,
    'year', s.year,
    'make', s.make,
    'model', s.model,
    'variant', s.variant,
    'body_type', s.body_type,
    'listed_price', s.listed_price,
    'created_at', s.created_at,
    'views', coalesce(vw.views, 0),
    'unique_viewers', coalesce(vw.unique_viewers, 0),
    'repeat_viewers', coalesce(r.repeat_viewers, 0),
    'test_drive_opens', coalesce(a.test_drive_opens, 0),
    'contact_clicks', coalesce(a.contact_clicks, 0),
    'leads', coalesce(lc.leads, 0),
    'top_channel', tc.channel
  ) order by coalesce(vw.views, 0) desc, s.created_at), '[]'::jsonb)
  from stock s
  left join views vw on vw.vehicle_id = s.id
  left join repeats r on r.vehicle_id = s.id
  left join actions a on a.vehicle_id = s.id
  left join top_channel tc on tc.vehicle_id = s.id
  left join lead_counts lc on lc.vehicle_id = s.id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Vehicle detail: daily views and leads, price history, channels
-- ---------------------------------------------------------------------------

-- Daily rows are sparse (days with no activity are left out) and cover
-- [p_series_from, p_until), which starts before the period so price changes
-- early in it still have a "before" span. Channels cover [p_from, p_until).
create function private.insights_vehicle_detail(
  p_vehicle_id uuid,
  p_series_from timestamptz,
  p_from timestamptz,
  p_until timestamptz,
  p_time_zone text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  daily_views as (
    select (e.occurred_at at time zone p_time_zone)::date as day, count(*) as views
    from public.web_events e
    where e.vehicle_id = p_vehicle_id
      and e.type = 'car_view'
      and e.occurred_at >= p_series_from and e.occurred_at < p_until
    group by 1
  ),
  daily_leads as (
    select (l.created_at at time zone p_time_zone)::date as day, count(*) as leads
    from public.leads l
    where l.vehicle_id = p_vehicle_id
      and l.deleted_at is null
      and l.created_at >= p_series_from and l.created_at < p_until
    group by 1
  ),
  daily as (
    select
      coalesce(v.day, l.day) as day,
      coalesce(v.views, 0) as views,
      coalesce(l.leads, 0) as leads
    from daily_views v
    full join daily_leads l on l.day = v.day
  ),
  channels as (
    select s.channel, count(*) as views
    from public.web_events e
    join public.web_sessions s on s.id = e.session_id
    where e.vehicle_id = p_vehicle_id
      and e.type = 'car_view'
      and e.occurred_at >= p_from and e.occurred_at < p_until
    group by s.channel
  )
  select jsonb_build_object(
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(day, 'YYYY-MM-DD'),
        'views', views,
        'leads', leads
      ) order by day), '[]'::jsonb)
      from daily
    ),
    'price_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'price', h.price,
        'changed_at', h.changed_at
      ) order by h.changed_at, h.id), '[]'::jsonb)
      from public.listed_price_history h
      where h.vehicle_id = p_vehicle_id and h.changed_at < p_until
    ),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'channel', channel,
        'views', views
      ) order by views desc, channel), '[]'::jsonb)
      from channels
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Demand: what visitors search for against what is in stock
-- ---------------------------------------------------------------------------

-- Searches are the site's filter_apply events (props: makeId, modelId,
-- bodyType, fuelType, transmission, priceMax, resultCount). Props are
-- client-supplied, so only values of the expected JSON type are counted and
-- ids are compared as text (a bad id simply matches nothing).
create function private.insights_demand(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_top_limit int
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  searches as (
    select e.props
    from public.web_events e
    where e.type = 'filter_apply'
      and e.occurred_at >= p_from and e.occurred_at < p_until
  ),
  zero as (
    select
      case when jsonb_typeof(props -> 'makeId') = 'string' then props ->> 'makeId' end as make_id,
      case when jsonb_typeof(props -> 'modelId') = 'string' then props ->> 'modelId' end as model_id,
      case when jsonb_typeof(props -> 'bodyType') = 'string' then props ->> 'bodyType' end as body_type,
      case when jsonb_typeof(props -> 'fuelType') = 'string' then props ->> 'fuelType' end as fuel_type,
      case when jsonb_typeof(props -> 'transmission') = 'string' then props ->> 'transmission' end
        as transmission,
      case when jsonb_typeof(props -> 'priceMax') = 'number' then (props ->> 'priceMax')::numeric end
        as price_max
    from searches
    where jsonb_typeof(props -> 'resultCount') = 'number'
      and (props ->> 'resultCount')::numeric = 0
  ),
  zero_top as (
    select make_id, model_id, body_type, fuel_type, transmission, price_max, count(*) as searches
    from zero
    group by 1, 2, 3, 4, 5, 6
    order by searches desc, make_id, model_id, body_type, price_max
    limit p_top_limit
  ),
  stock as (
    select coalesce(mo.body_type, va.body_type) as body_type, f.listed_price
    from public.vehicles v
    join public.variants va on va.id = v.variant_id
    join public.models mo on mo.id = va.model_id
    left join public.vehicle_financials f on f.vehicle_id = v.id
    where v.deleted_at is null
      and v.status in ('open', 'linked')
      and (p_showroom_id is null or v.showroom_id = p_showroom_id)
  )
  select jsonb_build_object(
    'search_prices', (
      select coalesce(jsonb_agg(jsonb_build_object('price', price, 'count', n)), '[]'::jsonb)
      from (
        select (props ->> 'priceMax')::numeric as price, count(*) as n
        from searches
        where jsonb_typeof(props -> 'priceMax') = 'number'
        group by 1
      ) p
    ),
    'search_body_types', (
      select coalesce(jsonb_agg(jsonb_build_object('body_type', body_type, 'count', n)), '[]'::jsonb)
      from (
        select lower(props ->> 'bodyType') as body_type, count(*) as n
        from searches
        where jsonb_typeof(props -> 'bodyType') = 'string'
        group by 1
      ) b
    ),
    'stock_prices', (
      select coalesce(jsonb_agg(jsonb_build_object('price', listed_price, 'count', n)), '[]'::jsonb)
      from (
        select listed_price, count(*) as n from stock where listed_price is not null group by 1
      ) sp
    ),
    'stock_body_types', (
      select coalesce(jsonb_agg(jsonb_build_object('body_type', body_type, 'count', n)), '[]'::jsonb)
      from (
        select body_type, count(*) as n from stock where body_type is not null group by 1
      ) sb
    ),
    'zero_result_count', (select count(*) from zero),
    'zero_result_top', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'make', mk.name,
        'model', mo.name,
        'body_type', z.body_type,
        'fuel_type', z.fuel_type,
        'transmission', z.transmission,
        'price_max', z.price_max,
        'count', z.searches
      ) order by z.searches desc), '[]'::jsonb)
      from zero_top z
      left join public.makes mk on mk.id::text = z.make_id
      left join public.models mo on mo.id::text = z.model_id
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Lead journey: the website visits behind one attributed lead
-- ---------------------------------------------------------------------------

-- Null when the lead does not exist (or is deleted). A lead with no
-- attribution row returns has_attribution = false and zero counts.
create function private.insights_lead_journey(p_lead_id uuid, p_other_limit int)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  the_lead as (
    select l.id, l.vehicle_id
    from public.leads l
    where l.id = p_lead_id and l.deleted_at is null
  ),
  attr as (
    select la.visitor_id, la.channel, la.last_utm_campaign, la.last_utm_content
    from public.lead_attribution la
    where la.lead_id = p_lead_id
  ),
  sessions as (
    select s.started_at
    from public.web_sessions s
    where s.visitor_id = (select visitor_id from attr)
  ),
  events as (
    select e.type, e.vehicle_id
    from public.web_events e
    where e.visitor_id = (select visitor_id from attr)
      and e.type in ('car_view', 'gallery_open')
  ),
  others as (
    select e.vehicle_id, count(*) as views
    from events e
    where e.type = 'car_view'
      and e.vehicle_id is not null
      and e.vehicle_id is distinct from (select vehicle_id from the_lead)
    group by e.vehicle_id
    order by views desc, e.vehicle_id
    limit p_other_limit
  )
  select case when not exists (select 1 from the_lead) then null else jsonb_build_object(
    'has_attribution', exists (select 1 from attr),
    'channel', (select channel from attr),
    'campaign', (select last_utm_campaign from attr),
    'content', (select last_utm_content from attr),
    'first_visit_at', (select min(started_at) from sessions),
    'visits', (select count(*) from sessions),
    'views_of_this_car', (
      select count(*) from events
      where type = 'car_view' and vehicle_id = (select vehicle_id from the_lead)
    ),
    'gallery_opens', (
      select count(*) from events
      where type = 'gallery_open' and vehicle_id = (select vehicle_id from the_lead)
    ),
    'other_cars', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'vehicle_id', o.vehicle_id,
        'year', v.year,
        'make', mk.name,
        'model', mo.name,
        'variant', va.name,
        'listed_price', f.listed_price,
        'views', o.views
      ) order by o.views desc, o.vehicle_id), '[]'::jsonb)
      from others o
      join public.vehicles v on v.id = o.vehicle_id
      join public.variants va on va.id = v.variant_id
      join public.models mo on mo.id = va.model_id
      join public.makes mk on mk.id = mo.make_id
      left join public.vehicle_financials f on f.vehicle_id = v.id
    )
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers and grants: backend only
-- ---------------------------------------------------------------------------

create function public.insights_traffic(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_prev_from timestamptz,
  p_prev_until timestamptz,
  p_campaign_limit int
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.insights_traffic(
    p_showroom_id, p_from, p_until, p_prev_from, p_prev_until, p_campaign_limit
  );
$$;

create function public.insights_vehicle_stats(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_vehicle_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.insights_vehicle_stats(p_showroom_id, p_from, p_until, p_vehicle_id);
$$;

create function public.insights_vehicle_detail(
  p_vehicle_id uuid,
  p_series_from timestamptz,
  p_from timestamptz,
  p_until timestamptz,
  p_time_zone text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.insights_vehicle_detail(p_vehicle_id, p_series_from, p_from, p_until, p_time_zone);
$$;

create function public.insights_demand(
  p_showroom_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_top_limit int
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.insights_demand(p_showroom_id, p_from, p_until, p_top_limit);
$$;

create function public.insights_lead_journey(p_lead_id uuid, p_other_limit int)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.insights_lead_journey(p_lead_id, p_other_limit);
$$;

revoke all on function private.insights_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz, int)
  from public, anon, authenticated;
revoke all on function public.insights_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz, int)
  from public, anon, authenticated;
revoke all on function private.insights_vehicle_stats(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.insights_vehicle_stats(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function private.insights_vehicle_detail(uuid, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.insights_vehicle_detail(uuid, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function private.insights_demand(uuid, timestamptz, timestamptz, int)
  from public, anon, authenticated;
revoke all on function public.insights_demand(uuid, timestamptz, timestamptz, int)
  from public, anon, authenticated;
revoke all on function private.insights_lead_journey(uuid, int)
  from public, anon, authenticated;
revoke all on function public.insights_lead_journey(uuid, int)
  from public, anon, authenticated;

grant execute on function private.insights_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz, int)
  to service_role;
grant execute on function public.insights_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz, int)
  to service_role;
grant execute on function private.insights_vehicle_stats(uuid, timestamptz, timestamptz, uuid)
  to service_role;
grant execute on function public.insights_vehicle_stats(uuid, timestamptz, timestamptz, uuid)
  to service_role;
grant execute on function private.insights_vehicle_detail(uuid, timestamptz, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.insights_vehicle_detail(uuid, timestamptz, timestamptz, timestamptz, text)
  to service_role;
grant execute on function private.insights_demand(uuid, timestamptz, timestamptz, int)
  to service_role;
grant execute on function public.insights_demand(uuid, timestamptz, timestamptz, int)
  to service_role;
grant execute on function private.insights_lead_journey(uuid, int)
  to service_role;
grant execute on function public.insights_lead_journey(uuid, int)
  to service_role;
