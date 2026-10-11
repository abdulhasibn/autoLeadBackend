-- Demo data: 30 leads with contacts, status history and follow-ups, spread
-- around now() so every dashboard card has something to show (new leads this
-- vs last period, pipeline, conversions/losses, overdue / today / upcoming
-- follow-ups, leads without a follow-up).
--
-- Every seeded contact's phone starts with +91984500, which is how the
-- cleanup below finds them. Leads go to the showroom's first staff user.
--
-- Cleanup:
--   delete from public.leads l using public.contacts c
--    where c.id = l.contact_id and c.phone like '+91984500%';
--   delete from public.contacts where phone like '+91984500%';

do $$
declare
  v_showroom uuid := 'b0000000-0000-4000-8000-000000000001';
  v_actor uuid;
  v_contact uuid;
  v_lead uuid;
  v_make uuid;
  v_model uuid;
  v_variant uuid;
  v_created timestamptz;
  v_closed timestamptz;
  v_fu timestamptz;
  v_today_end timestamptz :=
    (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '23 hours 30 minutes')
      at time zone 'Asia/Kolkata';
  r record;
  i integer := 0;
begin
  if exists (select 1 from public.contacts where phone like '+91984500%') then
    raise exception 'demo leads already seeded; run the cleanup first';
  end if;

  select u.id into v_actor
    from public.users u
   where u.deleted_at is null
   order by u.created_at
   limit 1;

  -- fu: 'overdue' | 'today' | 'upcoming' | 'none' | 'done' (closed leads)
  -- fu_n: hours ago (overdue), slot (today) or days ahead (upcoming)
  for r in
    select * from (values
      ('Arjun Reddy',        'arjun.reddy@gmail.com',     'website',   'new',               1150000, '1 month',   true,  'Maruti Swift 2016',    true,  'Wants a compact SUV, prefers diesel.',                 2, 'Hyundai',       'Creta',     'today',    1, 'call',           'Share Creta options under 12L', null),
      ('Priya Sharma',       'priya.s@outlook.com',       'instagram', 'new',                650000, 'immediate', true,  null,                   false, 'First car. Asked about EMI plans.',                    1, 'Maruti Suzuki', 'Baleno',    'today',    2, 'whatsapp',       'Send Baleno photos and EMI sheet', null),
      ('Mohammed Irfan',     null,                        'walkin',    'new',                900000, '2 weeks',   false, 'Honda City 2012',      true,  'Walked in on Saturday, liked the Seltos.',             4, 'Kia',           'Seltos',    'overdue', 20, 'test_drive',     'Test drive Seltos', null),
      ('Sneha Kulkarni',     'sneha.k@yahoo.in',          'facebook',  'new',                550000, '3 months',  true,  null,                   false, 'Budget conscious, open to hatchbacks.',                6, 'Tata',          'Altroz',    'upcoming', 3, 'call',           'Check budget after salary hike', null),
      ('Rahul Verma',        'rahul.verma@gmail.com',     'phone',     'new',               2200000, '1 month',   false, 'Toyota Innova 2014',   true,  'Family of six, needs a 7-seater.',                     3, 'Toyota',        'Innova',    'today',    3, 'meeting',        'Showroom visit with family', null),
      ('Kavya Nair',         null,                        'whatsapp',  'new',                780000, '2 weeks',   true,  null,                   false, 'Asked for automatic only.',                            0, 'Hyundai',       'Venue',     'none',     0, null,             null, null),
      ('Vikram Singh',       'vikram.singh@rediffmail.com','marketplace','new',              1450000, 'immediate', false, 'Mahindra XUV500 2015', true,  'Ready buyer, wants best trade-in value.',              8, 'Mahindra',      'XUV500',    'overdue', 52, 'send_quotation', 'Send trade-in quotation', null),
      ('Ananya Iyer',        'ananya.iyer@gmail.com',     'referral',  'new',                700000, '1 month',   true,  null,                   false, 'Referred by Rahul Verma.',                             5, 'Honda',         'Jazz',      'upcoming', 1, 'call',           'Follow up on Jazz VX', null),
      ('Suresh Babu',        null,                        'walkin',    'new',                450000, '3 months',  true,  'Maruti Alto 2011',     true,  'Upgrading from Alto.',                                12, 'Maruti Suzuki', 'Wagon R',   'none',     0, null,             null, null),
      ('Deepika Rao',        'deepika.rao@gmail.com',     'mobile_app','new',               1250000, '2 weeks',   false, null,                   false, 'Saved three Skoda listings in the app.',               9, 'Skoda',         'Octavia',   'today',    4, 'call',           'Confirm Octavia viewing time', null),
      ('Karthik Menon',      'karthik.m@icloud.com',      'website',   'new',                980000, '1 month',   true,  'Hyundai i20 2017',     true,  'Comparing Nexon and Venue.',                          16, 'Tata',          'Nexon',     'overdue',  4, 'whatsapp',       'Send Nexon vs Venue comparison', null),
      ('Fatima Sheikh',      null,                        'instagram', 'new',                600000, '3 months',  true,  null,                   false, 'DM enquiry from the reel.',                           21, 'Maruti Suzuki', 'Baleno',    'upcoming', 6, 'whatsapp',       'Share new arrivals', null),

      ('Rohit Gupta',        'rohit.gupta@gmail.com',     'phone',     'not_now',           1800000, '6 months',  false, 'Honda City 2015',      true,  'Wants to buy after Diwali bonus.',                    25, 'Honda',         'Accord',    'upcoming',14, 'call',           'Call after Diwali', null),
      ('Meera Joshi',        'meera.joshi@gmail.com',     'website',   'not_now',            500000, '6 months',  true,  null,                   false, 'Shifting cities, will decide later.',                 33, 'Hyundai',       'Venue',     'overdue', 30, 'call',           'Check if relocation is done', null),
      ('Imran Khan',         null,                        'walkin',    'not_now',            850000, '3 months',  true,  'Tata Indica 2010',     true,  'Waiting on loan approval.',                           19, 'Toyota',        'Yaris',     'upcoming', 9, 'call',           'Ask about loan status', null),
      ('Lakshmi Prasad',     'lakshmi.p@gmail.com',       'facebook',  'not_now',            720000, '3 months',  false, null,                   false, 'Not reachable for last two calls.',                   41, 'Volkswagen',    'Ameo',      'none',     0, null,             null, null),
      ('Aditya Bose',        'aditya.bose@gmail.com',     'referral',  'not_now',           3500000, '6 months',  false, 'BMW 3-Series 2014',    true,  'Looking at luxury sedans, no rush.',                  47, 'Mercedes-Benz', 'E-Class',   'upcoming',21, 'meeting',        'Invite for the luxury showcase', null),
      ('Nisha Thomas',       null,                        'whatsapp',  'not_now',            650000, '1 month',   true,  null,                   false, 'Asked to follow up next week.',                       14, 'Hyundai',       'Verna',     'overdue', 75, 'whatsapp',       'Weekly check-in', null),

      ('Sanjay Patel',       'sanjay.patel@gmail.com',    'marketplace','booking_confirmed',1350000, 'immediate', true,  'Maruti Ciaz 2016',     true,  'Booking amount paid, loan in process.',               11, 'Kia',           'Seltos',    'today',    5, 'call',           'Confirm loan disbursal date', null),
      ('Pooja Desai',        'pooja.desai@gmail.com',     'website',   'booking_confirmed',  880000, 'immediate', false, null,                   false, 'Paid token, delivery next week.',                      7, 'Maruti Suzuki', 'Ciaz',      'upcoming', 2, 'meeting',        'Delivery and paperwork', null),
      ('Harish Kumar',       null,                        'walkin',    'booking_confirmed', 1100000, 'immediate', true,  'Hyundai Santro 2012',  true,  'Trade-in agreed at 1.8L.',                           18, 'Hyundai',       'Creta',     'overdue',  8, 'send_quotation', 'Send final on-road quote', null),
      ('Divya Menon',        'divya.menon@gmail.com',     'referral',  'booking_confirmed',  950000, 'immediate', true,  null,                   false, 'Insurance quote pending.',                            13, 'Honda',         'Jazz',      'upcoming', 4, 'call',           'Share insurance options', null),
      ('Arvind Rao',         'arvind.rao@gmail.com',      'phone',     'booking_confirmed', 2600000, 'immediate', false, 'Toyota Fortuner 2013', true,  'Booked Kodiaq, wants accessories bundle.',            22, 'Skoda',         'Kodiaq',    'none',     0, null,             null, null),

      ('Ganesh Hegde',       'ganesh.hegde@gmail.com',    'website',   'converted',         1200000, 'immediate', true,  null,                   false, 'Delivered. Happy customer.',                          28, 'Hyundai',       'Creta',     'done',     0, 'meeting',        'Delivery done',  6),
      ('Shalini Reddy',      null,                        'referral',  'converted',          700000, 'immediate', false, 'Maruti Alto 2013',     true,  'Delivered with trade-in.',                            20, 'Maruti Suzuki', 'Baleno',    'done',     0, 'call',           'Post-delivery check', 3),
      ('Naveen Chandra',     'naveen.c@gmail.com',        'walkin',    'converted',          950000, 'immediate', true,  null,                   false, 'Converted after test drive.',                         52, 'Tata',          'Nexon',     'done',     0, 'test_drive',     'Test drive done', 38),
      ('Ayesha Siddiqui',    'ayesha.s@gmail.com',        'instagram', 'converted',          820000, 'immediate', true,  null,                   false, 'Converted from Instagram campaign.',                  35, 'Honda',         'Jazz',      'done',     0, 'whatsapp',       'Sent delivery photos', 12),

      ('Manoj Pillai',       null,                        'facebook',  'lost',               600000, '1 month',   true,  null,                   false, 'Bought from another dealer.',                         24, 'Hyundai',       'Venue',     'done',     0, 'call',           'Customer bought elsewhere', 4),
      ('Ritika Agarwal',     'ritika.a@gmail.com',        'website',   'lost',               450000, '3 months',  true,  null,                   false, 'Budget too low for available stock.',                 44, 'Tata',          'Nano',      'done',     0, 'call',           'Budget mismatch', 36),
      ('Tarun Malhotra',     'tarun.m@gmail.com',         'marketplace','lost',             1600000, '1 month',   false, 'Hyundai Verna 2016',   true,  'Went with a new car instead.',                        30, 'Toyota',        'Innova',    'done',     0, 'meeting',        'Chose a new car', 9)
    ) as t(full_name, email, source, status, budget, timeline, finance, current_vehicle, trade_in, notes,
           days_ago, make_name, model_name, fu, fu_n, task_type, fu_note, closed_days_ago)
  loop
    i := i + 1;
    v_created := now() - make_interval(days => r.days_ago, hours => (i * 7) % 9 + 1);

    select mk.id, md.id, vr.id into v_make, v_model, v_variant
      from public.makes mk
      join public.models md on md.make_id = mk.id
      left join public.variants vr on vr.model_id = md.id
     where mk.name = r.make_name and md.name ilike '%' || r.model_name || '%'
     order by md.name, vr.name
     limit 1;

    insert into public.contacts (full_name, phone, email, created_by, created_at, updated_at)
    values (r.full_name, '+91984500' || lpad((1000 + i * 37)::text, 4, '0'), r.email, v_actor, v_created, v_created)
    returning id into v_contact;

    insert into public.leads (
      showroom_id, contact_id, assigned_to, source, status, budget, preferred_vehicle,
      purchase_timeline, finance_required, current_vehicle, trade_in_required, notes,
      preferred_make_id, preferred_model_id, preferred_variant_id,
      created_by, created_at, updated_at
    )
    values (
      v_showroom, v_contact, v_actor, r.source, r.status, r.budget, r.make_name || ' ' || r.model_name,
      r.timeline, r.finance, r.current_vehicle, r.trade_in, r.notes,
      v_make, v_model, v_variant,
      v_actor, v_created, v_created
    )
    returning id into v_lead;

    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, changed_at)
    values (v_lead, null, 'new', v_actor, v_created);

    if r.status <> 'new' then
      v_closed := case
        when r.closed_days_ago is not null then now() - make_interval(days => r.closed_days_ago, hours => 2)
        else v_created + (now() - v_created) / 2
      end;
      insert into public.lead_status_history (lead_id, from_status, to_status, changed_by, notes, changed_at)
      values (v_lead, 'new', r.status, v_actor, r.notes, v_closed);
      update public.leads set updated_at = v_closed where id = v_lead;
    end if;

    -- an earlier, completed touchpoint on older leads
    if r.days_ago >= 7 then
      insert into public.follow_ups (lead_id, assigned_to, task_type, scheduled_at, completed_at,
                                     completed_by, notes, outcome, completion_notes,
                                     created_by, created_at, updated_at)
      values (v_lead, v_actor, 'call', v_created + interval '1 day', v_created + interval '1 day 20 minutes',
              v_actor, 'Intro call', 'reached', 'Interested, shared requirements',
              v_actor, v_created, v_created + interval '1 day');
    end if;

    if r.fu = 'none' then
      continue;
    end if;

    v_fu := case r.fu
      when 'overdue' then now() - make_interval(hours => r.fu_n)
      when 'today' then least(now() + make_interval(mins => 30 + r.fu_n * 45), v_today_end - make_interval(mins => 6 - r.fu_n))
      when 'upcoming' then date_trunc('hour', now()) + make_interval(days => r.fu_n, hours => 2)
      else v_closed - interval '1 day'
    end;

    -- Completed rows need completed_by and an outcome from follow_ups_outcome_check;
    -- the closing note goes in completion_notes.
    insert into public.follow_ups (lead_id, assigned_to, task_type, scheduled_at, completed_at,
                                   completed_by, notes, outcome, completion_notes,
                                   created_by, created_at, updated_at)
    values (v_lead, v_actor, r.task_type, v_fu,
            case when r.fu = 'done' then v_fu + interval '30 minutes' end,
            case when r.fu = 'done' then v_actor end,
            r.fu_note,
            case when r.fu = 'done' then 'done' end,
            case when r.fu = 'done' then r.notes end,
            v_actor, greatest(v_created, v_fu - interval '3 days'), greatest(v_created, v_fu - interval '3 days'));
  end loop;
end
$$;

-- Match preferences for the demo leads (lead_match_preferences migration).
-- Derived from each lead's preferred variant so seeded vehicles of the same
-- model score high, with some variety in colour / year / km / owners.
-- Safe to run on its own against already-seeded leads; it only overwrites the
-- preference columns of +91984500 contacts.
with demo as (
  select l.id,
         row_number() over (order by l.created_at) as n,
         vr.fuel_type,
         vr.transmission,
         split_part(vr.body_type, ',', 1) as body_type
    from public.leads l
    join public.contacts c on c.id = l.contact_id
    left join public.variants vr on vr.id = l.preferred_variant_id
   where c.phone like '+91984500%'
)
update public.leads l
   set preferred_colours = case demo.n % 6
         when 0 then array['white']
         when 1 then array['silver', 'grey']
         when 2 then array['red']
         when 3 then array['black']
         when 4 then '{}'::text[]
         else array['blue', 'white']
       end,
       preferred_fuel_types = case
         when demo.fuel_type in ('petrol', 'diesel', 'cng', 'electric', 'hybrid') and demo.n % 4 <> 0
           then array[demo.fuel_type] else '{}' end,
       preferred_transmissions = case
         when demo.transmission in ('manual', 'automatic', 'amt', 'cvt', 'dct') and demo.n % 3 = 0
           then array[demo.transmission] else '{}' end,
       preferred_body_types = case
         when trim(demo.body_type) in ('hatchback', 'sedan', 'suv', 'muv', 'mpv', 'crossover', 'coupe', 'convertible', 'sports', 'pick-up')
              and demo.n % 2 = 0
           then array[trim(demo.body_type)] else '{}' end,
       preferred_year_min = case when demo.n % 5 <> 0 then (2015 + (demo.n % 5))::smallint end,
       preferred_year_max = case when demo.n % 7 = 0 then 2023::smallint end,
       preferred_km_max = case when demo.n % 3 <> 1 then (40000 + (demo.n % 4) * 15000) end,
       preferred_max_owners = case when demo.n % 4 = 1 then 1::smallint end
  from demo
 where demo.id = l.id;
