-- Two sale models only (ADR-0017): bought outright (`dealership_purchase`) or
-- sold for a commission (`consignment`). `intermediary_sale` is retired and
-- its cars become commission cars.

update public.vehicles
set acquisition_type = 'consignment'
where acquisition_type = 'intermediary_sale';

alter table public.vehicles drop constraint vehicles_acquisition_type_check;

alter table public.vehicles
  add constraint vehicles_acquisition_type_check
  check (acquisition_type in ('dealership_purchase', 'consignment'));
