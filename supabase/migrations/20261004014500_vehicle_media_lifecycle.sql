-- Inspection lifecycle reason on save_vehicle, unique storage paths,
-- and private buckets for vehicle photos and documents.

drop function if exists public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
);

drop function if exists private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid
);

create function private.save_vehicle(
  p_id uuid,
  p_showroom_id uuid,
  p_owner_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_registration_number text,
  p_fuel_type text,
  p_transmission text,
  p_km_driven integer,
  p_num_previous_owners smallint,
  p_colour text,
  p_insurance_valid_until date,
  p_rc_status text,
  p_service_history text,
  p_accident_history boolean,
  p_loan_status text,
  p_location text,
  p_description text,
  p_status text,
  p_acquisition_type text,
  p_submitted_by uuid,
  p_deleted_at timestamptz,
  p_actor_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_status text;
begin
  select v.status
    into v_existing_status
    from public.vehicles v
   where v.id = p_id;

  insert into public.vehicles as veh (
    id,
    showroom_id,
    owner_id,
    variant_id,
    year,
    registration_number,
    fuel_type,
    transmission,
    km_driven,
    num_previous_owners,
    colour,
    insurance_valid_until,
    rc_status,
    service_history,
    accident_history,
    loan_status,
    location,
    description,
    status,
    acquisition_type,
    submitted_by,
    deleted_at
  )
  values (
    p_id,
    p_showroom_id,
    p_owner_id,
    p_variant_id,
    p_year,
    p_registration_number,
    p_fuel_type,
    p_transmission,
    p_km_driven,
    p_num_previous_owners,
    p_colour,
    p_insurance_valid_until,
    p_rc_status,
    p_service_history,
    p_accident_history,
    p_loan_status,
    p_location,
    p_description,
    p_status,
    p_acquisition_type,
    p_submitted_by,
    p_deleted_at
  )
  on conflict (id) do update set
    year = excluded.year,
    registration_number = excluded.registration_number,
    fuel_type = excluded.fuel_type,
    transmission = excluded.transmission,
    km_driven = excluded.km_driven,
    num_previous_owners = excluded.num_previous_owners,
    colour = excluded.colour,
    insurance_valid_until = excluded.insurance_valid_until,
    rc_status = excluded.rc_status,
    service_history = excluded.service_history,
    accident_history = excluded.accident_history,
    loan_status = excluded.loan_status,
    location = excluded.location,
    description = excluded.description,
    status = excluded.status,
    deleted_at = excluded.deleted_at,
    updated_at = now();

  if v_existing_status is distinct from p_status then
    insert into public.vehicle_status_history (
      vehicle_id,
      from_status,
      to_status,
      changed_by,
      reason
    )
    values (
      p_id,
      v_existing_status,
      p_status,
      p_actor_id,
      p_reason
    );
  end if;
end;
$$;

create function public.save_vehicle(
  p_id uuid,
  p_showroom_id uuid,
  p_owner_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_registration_number text,
  p_fuel_type text,
  p_transmission text,
  p_km_driven integer,
  p_num_previous_owners smallint,
  p_colour text,
  p_insurance_valid_until date,
  p_rc_status text,
  p_service_history text,
  p_accident_history boolean,
  p_loan_status text,
  p_location text,
  p_description text,
  p_status text,
  p_acquisition_type text,
  p_submitted_by uuid,
  p_deleted_at timestamptz,
  p_actor_id uuid,
  p_reason text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_vehicle(
    p_id,
    p_showroom_id,
    p_owner_id,
    p_variant_id,
    p_year,
    p_registration_number,
    p_fuel_type,
    p_transmission,
    p_km_driven,
    p_num_previous_owners,
    p_colour,
    p_insurance_valid_until,
    p_rc_status,
    p_service_history,
    p_accident_history,
    p_loan_status,
    p_location,
    p_description,
    p_status,
    p_acquisition_type,
    p_submitted_by,
    p_deleted_at,
    p_actor_id,
    p_reason
  );
$$;

revoke all on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
) from public, anon, authenticated;

revoke all on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
) from public, anon, authenticated;

grant execute on function private.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
) to service_role;

grant execute on function public.save_vehicle(
  uuid, uuid, uuid, uuid, smallint, text, text, text, integer, smallint, text, date, text, text, boolean, text, text, text, text, text, uuid, timestamptz, uuid, text
) to service_role;

create unique index vehicle_media_storage_path_uidx
  on public.vehicle_media (storage_path);

create unique index vehicle_documents_storage_path_uidx
  on public.vehicle_documents (storage_path);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-media',
  'vehicle-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-documents',
  'vehicle-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
