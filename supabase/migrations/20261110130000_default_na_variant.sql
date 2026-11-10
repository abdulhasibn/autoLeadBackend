-- Default "NA" variant
--
-- vehicles.variant_id is required, so a model with no variants could not be
-- picked when adding a car. Every model now has at least one variant: models
-- without any get an "NA" variant, and new models get one automatically.
-- NA carries no fuel type or transmission, so the form leaves those to the user.

insert into public.variants (model_id, name)
select m.id, 'NA'
from public.models m
where m.deleted_at is null
  and not exists (
    select 1
    from public.variants v
    where v.model_id = m.id
      and v.deleted_at is null
  )
on conflict do nothing;

create or replace function public.add_default_variant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.variants (model_id, name)
  values (new.id, 'NA')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.add_default_variant() from public, anon, authenticated;

drop trigger if exists models_default_variant on public.models;

create trigger models_default_variant
  after insert on public.models
  for each row
  execute function public.add_default_variant();
