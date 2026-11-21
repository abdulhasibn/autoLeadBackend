-- Validate the widened web_events_type_check added NOT VALID in
-- 20261121120100_web_events_preference_types. Its own file, so its own
-- transaction: VALIDATE takes SHARE UPDATE EXCLUSIVE and scans the table
-- without blocking event inserts or the insights reads.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.web_events validate constraint web_events_type_check;
