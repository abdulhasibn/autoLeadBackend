-- Dashboard summary read function (ADR-0012).
--
-- One round-trip returns every count and capped list the dashboard shows.
-- It returns raw counts only: ratios and labels are computed in the API.
--
-- Windows: current = [p_from, p_now), previous = [p_prev_from, p_prev_until).
-- Follow-ups are judged per active lead using its latest open follow-up, so a
-- newly scheduled follow-up supersedes older ones (there is no completion
-- endpoint yet).

create index if not exists vehicle_status_history_to_status_changed_idx
  on public.vehicle_status_history (to_status, changed_at);

create index if not exists lead_status_history_to_status_changed_idx
  on public.lead_status_history (to_status, changed_at);

create index if not exists follow_ups_open_lead_schedule_idx
  on public.follow_ups (lead_id, scheduled_at desc)
  where completed_at is null and deleted_at is null;

create function private.dashboard_vehicle_label(p_vehicle_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'year', v.year,
    'make', mk.name,
    'model', md.name,
    'variant', vr.name,
    'registration_number', v.registration_number
  )
    from public.vehicles v
    join public.variants vr on vr.id = v.variant_id
    join public.models md on md.id = vr.model_id
    join public.makes mk on mk.id = md.make_id
   where v.id = p_vehicle_id;
$$;

create function private.dashboard_summary(
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
    select * from scoped_leads where status in ('new', 'not_now', 'booking_confirmed')
  ),
  current_follow_ups as (
    select distinct on (f.lead_id)
           f.id, f.lead_id, f.task_type, f.scheduled_at,
           a.contact_name, a.contact_phone, a.vehicle_id
      from public.follow_ups f
      join active_leads a on a.id = f.lead_id
     where f.completed_at is null
       and f.deleted_at is null
     order by f.lead_id, f.scheduled_at desc
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
                          and l.status in ('new', 'not_now', 'booking_confirmed')
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

create function public.dashboard_summary(
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
security invoker
set search_path = ''
as $$
  select private.dashboard_summary(
    p_showroom_id,
    p_assignee_id,
    p_from,
    p_now,
    p_prev_from,
    p_prev_until,
    p_today_end,
    p_aged_before,
    p_list_limit
  );
$$;

revoke all on function private.dashboard_vehicle_label(uuid) from public, anon, authenticated;

revoke all on function private.dashboard_summary(
  uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, integer
) from public, anon, authenticated;

revoke all on function public.dashboard_summary(
  uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, integer
) from public, anon, authenticated;

grant execute on function private.dashboard_vehicle_label(uuid) to service_role;

grant execute on function private.dashboard_summary(
  uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, integer
) to service_role;

grant execute on function public.dashboard_summary(
  uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, integer
) to service_role;
