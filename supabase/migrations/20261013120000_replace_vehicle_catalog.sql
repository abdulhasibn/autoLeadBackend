-- Make room for the master make / model / variant catalog.
--
-- Rows are loaded by scripts/import-vehicle-catalog.mjs from the master
-- data export (brands.json, models.json, variants.json); this migration
-- only shapes the tables. source_id keeps the export's own id so a re-run
-- upserts instead of duplicating.
--
-- The export repeats model and variant names (one row per generation /
-- launch window), so (make_id, name) and (model_id, name) stop being
-- unique. Make names stay unique.

drop index public.models_make_name_active_uidx;
drop index public.variants_model_name_active_uidx;

create index models_make_name_idx
  on public.models (make_id, name)
  where deleted_at is null;

create index variants_model_name_idx
  on public.variants (model_id, name)
  where deleted_at is null;

alter table public.makes
  add column source_id integer,
  add column logo_url text,
  add constraint makes_source_id_key unique (source_id);

alter table public.models
  add column source_id integer,
  add column body_type text,
  add column segment_type text,
  add column logo_url text,
  add constraint models_source_id_key unique (source_id);

alter table public.variants
  add column source_id integer,
  add column launch_year smallint,
  add column discontinued_year smallint,
  add constraint variants_source_id_key unique (source_id),
  drop constraint variants_fuel_type_check,
  add constraint variants_fuel_type_check check (
    fuel_type is null
    or fuel_type in (
      'petrol', 'diesel', 'cng', 'electric', 'hybrid', 'cng_petrol', 'lpg', 'lpg_petrol'
    )
  );
