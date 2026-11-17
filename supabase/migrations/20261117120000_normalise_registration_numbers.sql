-- Issue #30: plates were stored with dashes, so "QA01-AB0001" and
-- "QA01AB0001" counted as different cars and slipped past
-- vehicles_registration_active_uidx. The API now stores letters and digits
-- only (spaces, dashes, dots and slashes removed); this rewrites the plates
-- already stored the same way.
--
-- No constraint is added here: the old backend can still write a dashed plate
-- until the new one is deployed. A later migration repeats this rewrite and
-- adds the format CHECK once the new backend is live everywhere.
--
-- Stops without changing anything if the rewrite would put two live cars on
-- the same plate (real duplicates: resolve them by hand first) or leave a
-- plate empty.

do $$
declare
  collisions text;
  empties text;
begin
  select string_agg(format('%s (vehicles %s)', plate, ids), '; ')
  into collisions
  from (
    select upper(regexp_replace(registration_number, '[\s./-]', '', 'g')) as plate,
           string_agg(id::text, ', ' order by created_at) as ids
    from public.vehicles
    where deleted_at is null
    group by 1
    having count(*) > 1
  ) dup;

  if collisions is not null then
    raise exception 'Live vehicles share a plate once normalised: %. Soft-delete or fix the duplicates, then re-run.', collisions;
  end if;

  select string_agg(id::text, ', ')
  into empties
  from public.vehicles
  where upper(regexp_replace(registration_number, '[\s./-]', '', 'g')) = '';

  if empties is not null then
    raise exception 'Vehicles whose plate is only separators: %. Fix them, then re-run.', empties;
  end if;
end;
$$;

update public.vehicles
set registration_number = upper(regexp_replace(registration_number, '[\s./-]', '', 'g'))
where registration_number <> upper(regexp_replace(registration_number, '[\s./-]', '', 'g'));
