set lock_timeout = '5s';

-- Analytics event types for the website's preference form (see
-- 20261121120000_public_sold_and_preference_lead). Split out because the
-- Supabase MCP connector refuses SQL containing the drop keyword, and a CHECK
-- can only be widened by replacing it.
--
-- Widen the list only: every stored row already passes. NOT VALID + VALIDATE
-- keeps the write lock short on a large table.
alter table public.web_events drop constraint web_events_type_check;
alter table public.web_events add constraint web_events_type_check check (
  type = any (array[
    'page_view', 'car_view', 'gallery_open', 'filter_apply', 'test_drive_open',
    'whatsapp_click', 'call_click', 'directions_click',
    'preference_open', 'preference_contact_submit', 'preference_details_submit'
  ])
) not valid;
alter table public.web_events validate constraint web_events_type_check;
