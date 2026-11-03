-- Finance car deal and quotes (ADR-0015, docs/plans/finance-phase-3-car-money.md).
--
-- vehicle_financials keeps one row per car but its prices move into an
-- encrypted `payload` (purchase rate, owner-expected and minimum prices,
-- finalised price, note) sealed with the vault's data key and bound to the
-- car id. Plaintext by design: listed_price (future marketplace, lead
-- matching), and sold_on / sold_by so SQL can find sold cars without a
-- recorded sale and reports can bucket by month. The dropped price and
-- commission columns held seed data only.
--
-- vehicle_quotes records each price offered to a person; the amount and who
-- it was offered to are sealed. RLS on, no policies: backend only.

alter table public.vehicle_financials
  drop constraint vehicle_financials_commission_percent_check,
  drop column owner_expected_price,
  drop column company_purchase_price,
  drop column expected_selling_price,
  drop column minimum_selling_price,
  drop column commission_amount,
  drop column commission_percent,
  drop column other_costs,
  drop column actual_selling_price,
  drop column sold_at,
  add column payload text,
  add column key_version integer,
  add column sold_on date,
  add constraint vehicle_financials_payload_check check (
    (payload is null) = (key_version is null)
  );

create table public.vehicle_quotes (
  id uuid primary key,
  vehicle_id uuid not null references public.vehicles (id),
  lead_id uuid references public.leads (id),
  quoted_on date not null,
  payload text not null,
  key_version integer not null,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vehicle_quotes_vehicle_date_idx
  on public.vehicle_quotes (vehicle_id, quoted_on)
  where deleted_at is null;

alter table public.vehicle_quotes enable row level security;
