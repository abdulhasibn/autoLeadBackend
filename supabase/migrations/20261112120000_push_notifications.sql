-- Push notifications: per-device Expo push tokens + a dispatch trigger.
--
-- Every in-app notification (any SQL function or backend insert into
-- public.notifications) becomes a push to each of the recipient's enabled
-- devices. Flow:
--   1. insert into notifications  -> statement trigger asks the API to dispatch
--      (pg_net, async, never blocks or fails the write)
--   2. POST /internal/push/dispatch -> claim_pending_pushes() -> Expo push API
--   3. pg_cron sweeps every minute, which also delivers reminders whose
--      due_at was in the future at insert time, and retries a missed trigger.
--
-- Until public.push_dispatch_config has a row, steps 1 and 3 are no-ops
-- (see docs/push-notifications.md for the one-time setup).

create extension if not exists pg_net with schema extensions;

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- The in-app switch. A device that turns pushes off keeps its row so the
  -- switch survives; only enabled rows receive pushes.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_push_tokens_user_enabled_idx
  on public.device_push_tokens (user_id)
  where enabled;

alter table public.device_push_tokens enable row level security;

alter table public.notifications add column push_sent_at timestamptz;

-- History predates push; never replay it. Everything already due is marked
-- skipped. Reminders still due in the future are left alone so they push on time.
update public.notifications
set push_sent_at = now()
where push_sent_at is null
  and (due_at is null or due_at <= now());

create index notifications_push_pending_idx
  on public.notifications (created_at)
  where push_sent_at is null;

-- One row: where the database tells the API to dispatch, and the shared secret.
create table public.push_dispatch_config (
  singleton boolean primary key default true check (singleton),
  url text not null,
  secret text not null
);

alter table public.push_dispatch_config enable row level security;

-- Atomically takes the notifications that are due, unread and not yet pushed,
-- so two overlapping dispatches never send the same one twice.
create or replace function public.claim_pending_pushes(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  type text,
  title text,
  body text,
  entity_type text,
  entity_id uuid
)
language sql
as $$
  update public.notifications n
  set push_sent_at = now()
  where n.id in (
    select p.id
    from public.notifications p
    where p.push_sent_at is null
      and p.is_read = false
      -- Measured from when it became due, so a reminder set weeks ahead still pushes.
      and coalesce(p.due_at, p.created_at) > now() - interval '1 day'
      and (p.due_at is null or p.due_at <= now())
    order by p.created_at
    limit p_limit
    for update skip locked
  )
  returning n.id, n.user_id, n.type, n.title, n.body, n.entity_type, n.entity_id;
$$;

create or replace function public.request_push_dispatch()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config public.push_dispatch_config;
begin
  select * into v_config from public.push_dispatch_config;
  if not found then
    return;
  end if;

  perform net.http_post(
    url := v_config.url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_config.secret
    )
  );
exception when others then
  -- Pushes are best effort; the notification itself must always be saved.
  null;
end;
$$;

create or replace function public.notifications_request_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.request_push_dispatch();
  return null;
end;
$$;

create trigger notifications_request_push_trg
  after insert on public.notifications
  for each statement
  execute function public.notifications_request_push();

-- Sweep every minute (due reminders, missed triggers). pg_cron is optional on
-- local setups, so a missing extension must not fail the migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'push-dispatch-sweep',
    '* * * * *',
    'select public.request_push_dispatch()'
  );
exception when others then
  raise notice 'pg_cron unavailable; schedule push-dispatch-sweep manually: %', sqlerrm;
end;
$$;
