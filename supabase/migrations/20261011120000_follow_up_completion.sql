-- Follow-up completion and cancellation.
--
--   * follow_ups gains who completed / cancelled it and the completion notes.
--     `outcome` is now constrained and set exactly when `completed_at` is.
--     A cancelled follow-up is soft-deleted (`deleted_at`, ADR-0005).
--   * complete_follow_up closes a follow-up, marks its due reminder read and,
--     optionally, schedules the next follow-up — all in one transaction.
--   * cancel_follow_up soft-deletes an open follow-up and marks its reminder read.
--   * dashboard_summary now judges each active lead by its earliest open
--     follow-up (it used the latest), matching the lead read model: with
--     completion available, every open follow-up is a real task.

alter table public.follow_ups
  add column completed_by uuid references public.users (id),
  add column cancelled_by uuid references public.users (id),
  add column completion_notes text;

-- Backfill rows completed before this migration (free-text outcome, no actor):
-- keep the text as completion notes, record outcome `done`, credit the assignee.
update public.follow_ups
   set completion_notes = case
         when outcome in ('reached', 'no_answer', 'rescheduled', 'not_interested', 'done')
           then completion_notes
         else coalesce(completion_notes, outcome)
       end,
       outcome = case
         when outcome in ('reached', 'no_answer', 'rescheduled', 'not_interested', 'done')
           then outcome
         else 'done'
       end,
       completed_by = coalesce(completed_by, assigned_to)
 where completed_at is not null
   and (
     outcome is null
     or outcome not in ('reached', 'no_answer', 'rescheduled', 'not_interested', 'done')
     or completed_by is null
   );

-- A free-text outcome on an open row has nowhere to go but the notes.
update public.follow_ups
   set notes = concat_ws(E'\n', notes, outcome),
       outcome = null
 where completed_at is null
   and outcome is not null;

alter table public.follow_ups
  add constraint follow_ups_outcome_check check (
    outcome in ('reached', 'no_answer', 'rescheduled', 'not_interested', 'done')
  ),
  add constraint follow_ups_completion_check check (
    (completed_at is null and outcome is null and completed_by is null)
    or (completed_at is not null and outcome is not null and completed_by is not null)
  ),
  add constraint follow_ups_cancellation_check check (
    cancelled_by is null or deleted_at is not null
  );

-- ---------------------------------------------------------------------------
-- complete_follow_up
-- ---------------------------------------------------------------------------

create function private.complete_follow_up(
  p_id uuid,
  p_completed_by uuid,
  p_completed_at timestamptz,
  p_outcome text,
  p_notes text,
  p_next_id uuid default null,
  p_next_lead_id uuid default null,
  p_next_assigned_to uuid default null,
  p_next_task_type text default null,
  p_next_scheduled_at timestamptz default null,
  p_next_notes text default null,
  p_next_created_by uuid default null,
  p_next_notification_id uuid default null,
  p_next_due_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.follow_ups
     set completed_at = p_completed_at,
         completed_by = p_completed_by,
         outcome = p_outcome,
         completion_notes = p_notes,
         updated_at = p_completed_at
   where id = p_id
     and completed_at is null
     and deleted_at is null;

  if not found then
    raise exception 'Follow-up is not open' using errcode = '55000';
  end if;

  update public.notifications
     set is_read = true
   where entity_type = 'follow_up'
     and entity_id = p_id;

  if p_next_id is not null then
    perform private.schedule_follow_up(
      p_next_id,
      p_next_lead_id,
      p_next_assigned_to,
      p_next_task_type,
      p_next_scheduled_at,
      p_next_notes,
      p_next_created_by,
      p_next_notification_id,
      p_next_due_at
    );
  end if;
end;
$$;

create function public.complete_follow_up(
  p_id uuid,
  p_completed_by uuid,
  p_completed_at timestamptz,
  p_outcome text,
  p_notes text,
  p_next_id uuid default null,
  p_next_lead_id uuid default null,
  p_next_assigned_to uuid default null,
  p_next_task_type text default null,
  p_next_scheduled_at timestamptz default null,
  p_next_notes text default null,
  p_next_created_by uuid default null,
  p_next_notification_id uuid default null,
  p_next_due_at timestamptz default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_follow_up(
    p_id,
    p_completed_by,
    p_completed_at,
    p_outcome,
    p_notes,
    p_next_id,
    p_next_lead_id,
    p_next_assigned_to,
    p_next_task_type,
    p_next_scheduled_at,
    p_next_notes,
    p_next_created_by,
    p_next_notification_id,
    p_next_due_at
  );
$$;

-- ---------------------------------------------------------------------------
-- cancel_follow_up
-- ---------------------------------------------------------------------------

create function private.cancel_follow_up(
  p_id uuid,
  p_cancelled_by uuid,
  p_cancelled_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.follow_ups
     set deleted_at = p_cancelled_at,
         cancelled_by = p_cancelled_by,
         updated_at = p_cancelled_at
   where id = p_id
     and completed_at is null
     and deleted_at is null;

  if not found then
    raise exception 'Follow-up is not open' using errcode = '55000';
  end if;

  update public.notifications
     set is_read = true
   where entity_type = 'follow_up'
     and entity_id = p_id;
end;
$$;

create function public.cancel_follow_up(
  p_id uuid,
  p_cancelled_by uuid,
  p_cancelled_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_follow_up(p_id, p_cancelled_by, p_cancelled_at);
$$;

revoke all on function private.complete_follow_up(
  uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) from public, anon, authenticated;

revoke all on function public.complete_follow_up(
  uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) from public, anon, authenticated;

revoke all on function private.cancel_follow_up(uuid, uuid, timestamptz)
  from public, anon, authenticated;

revoke all on function public.cancel_follow_up(uuid, uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function private.complete_follow_up(
  uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) to service_role;

grant execute on function public.complete_follow_up(
  uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, timestamptz, text, uuid, uuid, timestamptz
) to service_role;

grant execute on function private.cancel_follow_up(uuid, uuid, timestamptz) to service_role;

grant execute on function public.cancel_follow_up(uuid, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- dashboard_summary: earliest open follow-up per lead (was latest)
-- Body unchanged from 20261005130000_dashboard_summary.sql except the
-- current_follow_ups ordering. Grants carry over with create or replace.
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

