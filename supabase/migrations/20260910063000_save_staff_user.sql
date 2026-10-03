-- Atomic save of the staff-user aggregate (profile + role set).
-- Callable only by service_role via PostgREST rpc('save_staff_user').
-- Implementation lives in private; public is a thin invoker wrapper.

create or replace function private.save_staff_user(
  p_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_showroom_id uuid,
  p_deleted_at timestamptz,
  p_role_names text[],
  p_granted_by uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role_id uuid;
  v_role_name text;
begin
  insert into public.users as u (
    id,
    full_name,
    phone,
    email,
    showroom_id,
    deleted_at
  )
  values (
    p_id,
    p_full_name,
    p_phone,
    p_email,
    p_showroom_id,
    p_deleted_at
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    showroom_id = excluded.showroom_id,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  update public.user_roles ur
  set deleted_at = now()
  from public.roles r
  where ur.role_id = r.id
    and ur.user_id = p_id
    and ur.deleted_at is null
    and r.name <> all (coalesce(p_role_names, '{}'));

  foreach v_role_name in array coalesce(p_role_names, '{}')
  loop
    select r.id
    into v_role_id
    from public.roles r
    where r.name = v_role_name;

    if v_role_id is null then
      raise exception 'Unknown role: %', v_role_name
        using errcode = '22023';
    end if;

    insert into public.user_roles (user_id, role_id, granted_by)
    select p_id, v_role_id, p_granted_by
    where not exists (
      select 1
      from public.user_roles existing
      where existing.user_id = p_id
        and existing.role_id = v_role_id
        and existing.deleted_at is null
    );
  end loop;
end;
$$;

create or replace function public.save_staff_user(
  p_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_showroom_id uuid,
  p_deleted_at timestamptz,
  p_role_names text[],
  p_granted_by uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_staff_user(
    p_id,
    p_full_name,
    p_phone,
    p_email,
    p_showroom_id,
    p_deleted_at,
    p_role_names,
    p_granted_by
  );
$$;

revoke all on function private.save_staff_user(
  uuid, text, text, text, uuid, timestamptz, text[], uuid
) from public, anon, authenticated;

revoke all on function public.save_staff_user(
  uuid, text, text, text, uuid, timestamptz, text[], uuid
) from public, anon, authenticated;

grant usage on schema private to service_role;

grant execute on function private.save_staff_user(
  uuid, text, text, text, uuid, timestamptz, text[], uuid
) to service_role;

grant execute on function public.save_staff_user(
  uuid, text, text, text, uuid, timestamptz, text[], uuid
) to service_role;
