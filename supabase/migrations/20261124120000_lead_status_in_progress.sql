set lock_timeout = '5s';
set statement_timeout = '60s';

-- New lead status `in_progress`: the customer has been reached and follow-up
-- has started. Sits between `new` and `booking_confirmed`; counts as an active
-- lead (keeps its vehicle `linked`).
--
-- Widen the list only: the new list is a superset, so every stored row and
-- every value the current backend writes still passes. Added NOT VALID here
-- (no table scan, brief lock); 20261124120100 validates it in its own
-- transaction. The functions that list active statuses are updated in
-- 20261124120200.
-- squawk-ignore ban-drop-constraint -- replaced in the same transaction by a strictly wider CHECK
alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check check (
  status in (
    'new', 'in_progress', 'not_now', 'booking_confirmed', 'converted', 'lost',
    'vehicle_unavailable'
  )
) not valid;
