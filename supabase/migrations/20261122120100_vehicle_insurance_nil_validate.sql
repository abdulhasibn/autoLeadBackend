-- Validates vehicles_insurance_nil_no_date_check in its own transaction
-- (SHARE UPDATE EXCLUSIVE: reads and writes on vehicles keep going).

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.vehicles
  validate constraint vehicles_insurance_nil_no_date_check;
