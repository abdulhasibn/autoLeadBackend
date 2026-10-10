-- Dealer app handoff, round 2 (2026-10-07 / 2026-10-08):
--   * notifications carry the lead they are about, so a follow_up_due item can
--     open its lead. A BEFORE INSERT trigger derives it from the entity, so
--     schedule_follow_up and save_lead keep their current signatures.
--   * vehicle_list flattens a vehicle with its catalog lineage, so GET /vehicles
--     can search plate + make/model/variant names and filter by make/model in
--     one query (PostgREST cannot OR across a column and an embed).

-- ---------------------------------------------------------------------------
-- notifications.lead_id
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column lead_id uuid references public.leads (id) on delete cascade;

create function public.notifications_set_lead_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lead_id is null then
    if new.entity_type = 'lead' then
      new.lead_id := new.entity_id;
    elsif new.entity_type = 'follow_up' then
      select f.lead_id into new.lead_id
      from public.follow_ups f
      where f.id = new.entity_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger notifications_set_lead_id
  before insert on public.notifications
  for each row execute function public.notifications_set_lead_id();

update public.notifications n
set lead_id = n.entity_id
where n.entity_type = 'lead'
  and n.lead_id is null
  and exists (select 1 from public.leads l where l.id = n.entity_id);

update public.notifications n
set lead_id = f.lead_id
from public.follow_ups f
where n.entity_type = 'follow_up'
  and n.lead_id is null
  and f.id = n.entity_id;

-- ---------------------------------------------------------------------------
-- vehicle_list
-- ---------------------------------------------------------------------------

-- security_invoker: callers see only what RLS on the base tables lets them see.
create view public.vehicle_list
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
  v.deleted_at
from public.vehicles v
join public.variants va on va.id = v.variant_id
join public.models mo on mo.id = va.model_id
join public.makes mk on mk.id = mo.make_id;

revoke all on public.vehicle_list from anon, authenticated;
