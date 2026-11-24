-- Validate the widened leads_status_check added NOT VALID in
-- 20261124120000_lead_status_in_progress. Its own file, so its own
-- transaction: VALIDATE takes SHARE UPDATE EXCLUSIVE and scans the table
-- without blocking lead reads or writes.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.leads validate constraint leads_status_check;
