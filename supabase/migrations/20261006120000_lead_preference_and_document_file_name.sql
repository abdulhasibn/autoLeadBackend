-- Dealer app handoff gaps (2026-10-05):
--   * leads carry a structured catalog preference (make → model → variant)
--     alongside the legacy free-text preferred_vehicle, so the pipeline can be
--     filtered by catalog id instead of by string.
--   * vehicle_documents keep the uploader's original file name for display.
--
-- save_lead gains three trailing preference parameters. Like every other
-- lead column they are written on each save, so callers pass the lead's
-- current preference every time (the defaults exist only to keep the
-- parameter list ordered after the existing defaulted ones).

alter table public.leads
  add column preferred_make_id uuid references public.makes (id),
  add column preferred_model_id uuid references public.models (id),
  add column preferred_variant_id uuid references public.variants (id),
  add constraint leads_preferred_catalog_chain_check check (
    (preferred_variant_id is null or preferred_model_id is not null)
    and (preferred_model_id is null or preferred_make_id is not null)
  );

create index leads_preferred_make_idx
  on public.leads (preferred_make_id)
  where deleted_at is null and preferred_make_id is not null;

create index leads_preferred_model_idx
  on public.leads (preferred_model_id)
  where deleted_at is null and preferred_model_id is not null;

create index leads_preferred_variant_idx
  on public.leads (preferred_variant_id)
  where deleted_at is null and preferred_variant_id is not null;

alter table public.vehicle_documents
  add column file_name text,
  add constraint vehicle_documents_file_name_check check (
    file_name is null or char_length(file_name) between 1 and 255
  );

drop function if exists public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid
);

drop function if exists private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid
);

create function private.save_lead(
  p_id uuid,
  p_showroom_id uuid,
  p_vehicle_id uuid,
  p_contact_id uuid,
  p_contact_full_name text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_created_by uuid,
  p_source text,
  p_status text,
  p_budget numeric,
  p_preferred_vehicle text,
  p_purchase_timeline text,
  p_finance_required boolean,
  p_current_vehicle text,
  p_trade_in_required boolean,
  p_notes text,
  p_created_by uuid,
  p_deleted_at timestamptz,
  p_write_history boolean,
  p_status_notes text,
  p_assigned_to uuid default null,
  p_update_assignee boolean default false,
  p_actor_id uuid default null,
  p_preferred_make_id uuid default null,
  p_preferred_model_id uuid default null,
  p_preferred_variant_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_new boolean;
  v_existing_status text;
  v_existing_assignee uuid;
  v_actor uuid := coalesce(p_actor_id, p_created_by);
begin
  if p_contact_full_name is not null then
    insert into public.contacts as c (
      id,
      full_name,
      phone,
      email,
      created_by
    )
    values (
      p_contact_id,
      p_contact_full_name,
      p_contact_phone,
      p_contact_email,
      p_contact_created_by
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      email = excluded.email,
      updated_at = now();
  end if;

  select l.status, l.assigned_to
    into v_existing_status, v_existing_assignee
  from public.leads l
  where l.id = p_id;
  v_is_new := not found;

  insert into public.leads as l (
    id,
    showroom_id,
    vehicle_id,
    user_id,
    contact_id,
    assigned_to,
    source,
    status,
    budget,
    preferred_vehicle,
    preferred_make_id,
    preferred_model_id,
    preferred_variant_id,
    purchase_timeline,
    finance_required,
    current_vehicle,
    trade_in_required,
    notes,
    created_by,
    deleted_at
  )
  values (
    p_id,
    p_showroom_id,
    p_vehicle_id,
    null,
    p_contact_id,
    case when p_update_assignee then p_assigned_to else null end,
    p_source,
    p_status,
    p_budget,
    p_preferred_vehicle,
    p_preferred_make_id,
    p_preferred_model_id,
    p_preferred_variant_id,
    p_purchase_timeline,
    p_finance_required,
    p_current_vehicle,
    p_trade_in_required,
    p_notes,
    p_created_by,
    p_deleted_at
  )
  on conflict (id) do update set
    vehicle_id = excluded.vehicle_id,
    contact_id = excluded.contact_id,
    assigned_to = case when p_update_assignee then excluded.assigned_to else l.assigned_to end,
    source = excluded.source,
    status = excluded.status,
    budget = excluded.budget,
    preferred_vehicle = excluded.preferred_vehicle,
    preferred_make_id = excluded.preferred_make_id,
    preferred_model_id = excluded.preferred_model_id,
    preferred_variant_id = excluded.preferred_variant_id,
    purchase_timeline = excluded.purchase_timeline,
    finance_required = excluded.finance_required,
    current_vehicle = excluded.current_vehicle,
    trade_in_required = excluded.trade_in_required,
    notes = excluded.notes,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  if p_write_history and v_existing_status is distinct from p_status then
    insert into public.lead_status_history (
      lead_id,
      from_status,
      to_status,
      changed_by,
      notes
    )
    values (
      p_id,
      v_existing_status,
      p_status,
      v_actor,
      p_status_notes
    );
  end if;

  if p_update_assignee and (
    (v_is_new and p_assigned_to is not null)
    or (not v_is_new and v_existing_assignee is distinct from p_assigned_to)
  ) then
    insert into public.audit_logs (
      entity_type,
      entity_id,
      action,
      actor_id,
      before_value,
      after_value
    )
    values (
      'lead',
      p_id,
      'lead.assigned',
      v_actor,
      jsonb_build_object('assigned_to', v_existing_assignee),
      jsonb_build_object('assigned_to', p_assigned_to)
    );

    if p_assigned_to is not null and p_assigned_to is distinct from v_actor then
      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        entity_type,
        entity_id
      )
      values (
        p_assigned_to,
        'lead_assigned',
        'New lead assigned',
        'A lead has been assigned to you',
        'lead',
        p_id
      );
    end if;
  end if;
end;
$$;

create function public.save_lead(
  p_id uuid,
  p_showroom_id uuid,
  p_vehicle_id uuid,
  p_contact_id uuid,
  p_contact_full_name text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_created_by uuid,
  p_source text,
  p_status text,
  p_budget numeric,
  p_preferred_vehicle text,
  p_purchase_timeline text,
  p_finance_required boolean,
  p_current_vehicle text,
  p_trade_in_required boolean,
  p_notes text,
  p_created_by uuid,
  p_deleted_at timestamptz,
  p_write_history boolean,
  p_status_notes text,
  p_assigned_to uuid default null,
  p_update_assignee boolean default false,
  p_actor_id uuid default null,
  p_preferred_make_id uuid default null,
  p_preferred_model_id uuid default null,
  p_preferred_variant_id uuid default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_lead(
    p_id,
    p_showroom_id,
    p_vehicle_id,
    p_contact_id,
    p_contact_full_name,
    p_contact_phone,
    p_contact_email,
    p_contact_created_by,
    p_source,
    p_status,
    p_budget,
    p_preferred_vehicle,
    p_purchase_timeline,
    p_finance_required,
    p_current_vehicle,
    p_trade_in_required,
    p_notes,
    p_created_by,
    p_deleted_at,
    p_write_history,
    p_status_notes,
    p_assigned_to,
    p_update_assignee,
    p_actor_id,
    p_preferred_make_id,
    p_preferred_model_id,
    p_preferred_variant_id
  );
$$;

revoke all on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

revoke all on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function private.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
) to service_role;

grant execute on function public.save_lead(
  uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, text, text, boolean, text, boolean, text, uuid, timestamptz, boolean, text, uuid, boolean, uuid, uuid, uuid, uuid
) to service_role;
