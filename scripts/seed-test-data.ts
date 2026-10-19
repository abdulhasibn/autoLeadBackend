// Test data: six months of showroom activity, coherent across every table.
//
// Simulates the timeline day by day (vehicle intake, leads, links, status
// changes, sales, drops, re-listings, assignments, follow-ups) and then
// bulk-inserts the result with backdated timestamps. Rows are written
// directly rather than through the RPCs (which stamp now()), so this script
// keeps the RPC / ADR-0011 invariants itself:
//   - a vehicle is `linked` exactly while an active lead points at it
//   - `sold` vehicles carry sold_lead_id and a converted lead
//   - `vehicle_unavailable` leads have no vehicle
//   - status history starts at null -> initial and ends at the current status
//
// Photos are random picks from the demo photo cache
// (.scratch/demo-vehicle-photos, filled by seed-demo-vehicles.ts), resized
// with macOS `sips` into .scratch/seed-photos. Documents are a generated PDF.
//
// Every login it creates uses the password `secret12`; the admin is
// admin@example.com. Refuses to run unless users, vehicles and leads are empty.
//
// Usage:
//   pnpm seed:test-data
//   pnpm seed:test-data --dry-run   (simulate and print a summary only)

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Json, TablesInsert } from '../src/infrastructure/supabase/database.types';
import { createRandom, roundTo } from './lib/random';
import { check, type Db, run, serviceRoleClient } from './lib/supabase';

const SHOWROOM_ID = 'b0000000-0000-4000-8000-000000000001';
const PASSWORD = 'secret12';
const ROLE_IDS = {
  admin: 'a0000000-0000-4000-8000-000000000001',
  salesperson: 'a0000000-0000-4000-8000-000000000002',
  owner: 'a0000000-0000-4000-8000-000000000003',
  buyer: 'a0000000-0000-4000-8000-000000000004',
} as const;
const DAYS = 182;
const VEHICLE_COUNT = 320;
const LEAD_COUNT = 720;
const BUYER_COUNT = 30;
const OWNER_PORTAL_COUNT = 10;
const IDLE_OWNER_COUNT = 15;
const BATCH_SIZE = 500;
const UPLOAD_CONCURRENCY = 12;
const DRY_RUN = process.argv.includes('--dry-run');

const root = join(__dirname, '..');
const photoCacheDir = join(root, '.scratch', 'demo-vehicle-photos');
const photoDir = join(root, '.scratch', 'seed-photos');

const db: Db = serviceRoleClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = keyof typeof ROLE_IDS;
type Tier = 'budget' | 'mid' | 'premium' | 'luxury';
type VehicleStatus = 'open' | 'linked' | 'dropped' | 'sold';
type LeadStatus =
  'new' | 'not_now' | 'booking_confirmed' | 'converted' | 'lost' | 'vehicle_unavailable';
type LeadActionKind =
  'link' | 'unlink' | 'not_now' | 'new' | 'booking_confirmed' | 'converted' | 'lost';
type TaskType = 'call' | 'whatsapp' | 'meeting' | 'test_drive' | 'send_quotation' | 'other';
type Outcome = 'reached' | 'no_answer' | 'rescheduled' | 'not_interested' | 'done';

interface CatalogVariant {
  readonly id: string;
  readonly name: string;
  readonly fuel_type: string | null;
  readonly transmission: string | null;
  readonly body_type: string | null;
  readonly launch_year: number | null;
  readonly discontinued_year: number | null;
  readonly models: {
    readonly id: string;
    readonly name: string;
    readonly makes: { readonly id: string; readonly name: string };
  };
}

interface CatalogModel {
  readonly make: string;
  readonly makeId: string;
  readonly model: string;
  readonly modelId: string;
  readonly tier: Tier;
  readonly weight: number;
  readonly variants: readonly CatalogVariant[];
}

interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roles: readonly Role[];
  readonly day: number;
  readonly leftDay?: number;
  readonly createdAt: number;
  readonly leftAt: number;
}

interface OwnerRow {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  preferred_contact_method: string | null;
  alt_phone: string | null;
  id_info: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ContactRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  merged_into_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface VehicleRow {
  showroom_id: string;
  owner_id: string;
  variant_id: string;
  year: number;
  registration_number: string;
  fuel_type: string;
  transmission: string;
  km_driven: number;
  num_previous_owners: number;
  colour: string;
  insurance_valid_until: string | null;
  rc_status: string | null;
  service_history: string | null;
  accident_history: boolean;
  loan_status: string | null;
  location: string | null;
  description: string | null;
  acquisition_type: string;
  submitted_by: string;
  created_at: string;
  deleted_at: string | null;
}

interface FinancialsRow {
  vehicle_id: string;
  owner_expected_price: number | null;
  company_purchase_price: number | null;
  expected_selling_price: number | null;
  minimum_selling_price: number | null;
  listed_price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  other_costs: number | null;
  actual_selling_price: number | null;
  sold_at: string | null;
  sold_by: string | null;
  updated_at: string;
}

interface SimVehicle {
  readonly id: string;
  readonly model: CatalogModel;
  readonly variant: CatalogVariant;
  readonly created: number;
  status: VehicleStatus;
  deleted: boolean;
  soldLeadId: string | null;
  linkable: boolean;
  readonly row: VehicleRow;
  readonly listed: number;
  expenses: number;
  financials: FinancialsRow | null;
  updated?: number;
  soldAt?: number;
  soldBy?: string;
  soldLead?: SimLead;
}

interface LeadPreference {
  preferred_make_id: string | null;
  preferred_model_id: string | null;
  preferred_variant_id: string | null;
  preferred_colours: string[];
  preferred_fuel_types: string[];
  preferred_transmissions: string[];
  preferred_body_types: string[];
  preferred_year_min: number | null;
  preferred_year_max: number | null;
  preferred_km_max: number | null;
  preferred_max_owners: number | null;
  preferred_vehicle: string | null;
}

interface LeadRow extends LeadPreference {
  showroom_id: string;
  user_id: string | null;
  contact_id: string | null;
  source: string;
  budget: number | null;
  purchase_timeline: string | null;
  finance_required: boolean | null;
  current_vehicle: string | null;
  trade_in_required: boolean | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  deleted_at?: string;
}

interface SimLead {
  readonly id: string;
  readonly created: number;
  status: LeadStatus | null;
  vehicleId: string | null;
  assignedTo: string | null;
  readonly assignments: { t: number; userId: string | null }[];
  deleted: boolean;
  generation: number;
  endActive: number | null;
  readonly buyerLead: boolean;
  readonly contact: ContactRow | null;
  readonly row: LeadRow;
  updated?: number;
}

interface SimBuyer extends TablesInsert<'buyers'> {
  readonly id: string;
  readonly user_id: string;
  readonly user: TablesInsert<'users'>;
  readonly createdAt: number;
}

interface FollowUpRow {
  id: string;
  lead_id: string;
  assigned_to: string;
  task_type: TaskType;
  scheduled_at: string;
  completed_at: string | null;
  notes: string | null;
  outcome: Outcome | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  completed_by: string | null;
  cancelled_by: string | null;
  completion_notes: string | null;
}

interface MoneyRow {
  showroom_id: string;
  vehicle_id: string | null;
  category: string;
  amount: number;
  description: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

type ExpenseRow = MoneyRow & { type: 'vehicle' | 'business'; incurred_on: string };
type IncomeRow = MoneyRow & { received_on: string };

type SimEvent =
  | { t: number; kind: 'vehicle_create' }
  | { t: number; kind: 'lead_create'; buyerLead: boolean }
  | { t: number; kind: 'lead_action'; lead: SimLead; action: LeadActionKind; generation: number }
  | { t: number; kind: 'lead_revive' | 'lead_assign' | 'lead_reassign'; lead: SimLead }
  | { t: number; kind: 'vehicle_drop' | 'vehicle_relist' | 'vehicle_delete'; vehicle: SimVehicle }
  | { t: number; kind: 'staff_leaves'; member: StaffMember };

type LeadEvent = Extract<SimEvent, { lead: SimLead }>;
type VehicleEvent = Extract<SimEvent, { vehicle: SimVehicle }>;

type MediaUpload = {
  bucket: 'vehicle-media';
  path: string;
  contentType: 'image/jpeg';
  row: TablesInsert<'vehicle_media'>;
};
type DocumentUpload = {
  bucket: 'vehicle-documents';
  path: string;
  contentType: 'application/pdf';
  title: string;
  row: TablesInsert<'vehicle_documents'>;
};
type Upload = MediaUpload | DocumentUpload;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { rand, chance, pick, maybePick, between, weighted, sample } = createRandom(20261013);
const isIn = <T>(value: T, list: readonly T[]): boolean => list.includes(value);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IST = 5.5 * HOUR;
const NOW = Date.now();
const START = NOW - DAYS * DAY;
const iso = (ms: number): string => new Date(ms).toISOString();
const dateOnly = (ms: number): string => new Date(ms + IST).toISOString().slice(0, 10);

/** The given day (IST) at hh:mm IST. */
function atIST(ms: number, hour: number, minute = 0): number {
  const d = new Date(ms + IST);
  d.setUTCHours(hour, minute, 0, 0);
  return d.getTime() - IST;
}
/** A working-hours moment on the same IST day. */
const workTime = (ms: number): number => atIST(ms, between(9, 19), between(0, 59));
/** Like workTime, but never in the future. */
function pastWorkTime(ms: number): number {
  const t = workTime(ms);
  return t > NOW ? NOW - between(5, 90) * MINUTE : t;
}
/** Working hours some days after ms, and always after it. May be in the future. */
function afterDays(ms: number, min: number, max: number): number {
  const t = workTime(ms + (min + rand() * (max - min)) * DAY);
  return Math.max(t, ms + between(30, 180) * MINUTE);
}
/** A day offset biased towards recent months: the showroom is ramping up. */
function rampedTime(): number {
  for (;;) {
    const d = rand() * DAYS;
    if (rand() < 0.35 + (0.65 * d) / DAYS) return pastWorkTime(START + d * DAY);
  }
}

/** Min-heap on `t`: the simulation's event queue. */
class Heap<T extends { t: number }> {
  private readonly items: T[] = [];

  push(item: T): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.at(p).t <= this.at(i).t) break;
      this.swap(p, i);
      i = p;
    }
  }

  pop(): T {
    const a = this.items;
    const top = this.at(0);
    const last = a.pop() as T;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.at(l).t < this.at(m).t) m = l;
        if (r < a.length && this.at(r).t < this.at(m).t) m = r;
        if (m === i) break;
        this.swap(m, i);
        i = m;
      }
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }

  private at(i: number): T {
    const item = this.items[i];
    if (item === undefined) throw new Error(`Heap index ${i} out of range`);
    return item;
  }

  private swap(i: number, j: number): void {
    const a = this.items;
    [a[i], a[j]] = [this.at(j), this.at(i)];
  }
}

// ---------------------------------------------------------------------------
// Reference pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Aarav',
  'Aditi',
  'Akash',
  'Ananya',
  'Anil',
  'Anjali',
  'Arjun',
  'Bhavna',
  'Chetan',
  'Deepa',
  'Deepak',
  'Divya',
  'Farhan',
  'Gaurav',
  'Geeta',
  'Harish',
  'Ishaan',
  'Jyoti',
  'Karan',
  'Kavya',
  'Kiran',
  'Lakshmi',
  'Mahesh',
  'Manoj',
  'Meera',
  'Mohammed',
  'Nandini',
  'Naveen',
  'Neha',
  'Nikhil',
  'Pooja',
  'Pradeep',
  'Rahul',
  'Rajesh',
  'Ramya',
  'Ravi',
  'Rekha',
  'Ritika',
  'Sachin',
  'Sahana',
  'Sandeep',
  'Sanjay',
  'Shalini',
  'Shreya',
  'Siddharth',
  'Sneha',
  'Sunil',
  'Suresh',
  'Tanvi',
  'Tarun',
  'Usha',
  'Varun',
  'Vidya',
  'Vijay',
  'Vinod',
  'Yash',
  'Zoya',
  'Ayesha',
  'Imran',
  'Joseph',
  'Mary',
  'Thomas',
  'Priyanka',
  'Abhishek',
  'Swati',
  'Girish',
  'Kavitha',
  'Praveen',
  'Rohini',
  'Sameer',
];
const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Iyer',
  'Nair',
  'Reddy',
  'Rao',
  'Patel',
  'Shah',
  'Mehta',
  'Joshi',
  'Kulkarni',
  'Deshpande',
  'Gowda',
  'Hegde',
  'Shetty',
  'Pillai',
  'Menon',
  'Das',
  'Banerjee',
  'Ghosh',
  'Singh',
  'Khan',
  'Siddiqui',
  'Fernandes',
  "D'Souza",
  'Thomas',
  'Kumar',
  'Prasad',
  'Agarwal',
  'Gupta',
  'Malhotra',
  'Kapoor',
  'Chandra',
  'Bose',
  'Naidu',
  'Krishnan',
  'Subramanian',
  'Varghese',
  'Mishra',
  'Pandey',
];
const CITIES: readonly (readonly [string, readonly string[]])[] = [
  [
    'Bengaluru',
    [
      'Indiranagar',
      'Koramangala',
      'Whitefield',
      'Jayanagar',
      'HSR Layout',
      'Malleshwaram',
      'Hebbal',
      'Electronic City',
      'Yelahanka',
      'BTM Layout',
    ],
  ],
  ['Mysuru', ['Vijayanagar', 'Kuvempunagar', 'Gokulam']],
  ['Mangaluru', ['Kadri', 'Bejai', 'Kankanady']],
  ['Hubballi', ['Vidyanagar', 'Gokul Road']],
  ['Chennai', ['Adyar', 'Anna Nagar', 'T Nagar']],
  ['Hyderabad', ['Gachibowli', 'Kondapur', 'Banjara Hills']],
  ['Pune', ['Kothrud', 'Baner', 'Viman Nagar']],
];
const COLOURS = [
  'White',
  'Pearl White',
  'Silver',
  'Grey',
  'Black',
  'Red',
  'Blue',
  'Brown',
  'Beige',
  'Maroon',
  'Orange',
  'Green',
  'Yellow',
  'Bronze',
  'Red with Black Roof',
];
const REG_STATES: readonly (readonly [string, number, number])[] = [
  ['KA', 53, 70],
  ['MH', 50, 6],
  ['TN', 99, 7],
  ['TS', 15, 6],
  ['DL', 13, 4],
  ['KL', 70, 5],
  ['AP', 39, 2],
];

// [make, [models], tier, weight]
const POPULAR_MODELS: readonly (readonly [string, readonly string[], Tier, number])[] = [
  [
    'Maruti Suzuki',
    [
      'Swift',
      'Baleno',
      'Dzire',
      'Swift Dzire',
      'Wagon R',
      'Ertiga',
      'Brezza',
      'Vitara Brezza',
      'Alto K10',
      'Ciaz',
      'Grand Vitara',
      'Celerio',
    ],
    'budget',
    22,
  ],
  [
    'Hyundai',
    [
      'Creta',
      'Venue',
      'i20',
      'Elite i20',
      'Grand i10 Nios',
      'Grand i10',
      'Verna',
      'Aura',
      'Alcazar',
      'Exter',
    ],
    'mid',
    18,
  ],
  [
    'Tata',
    ['Nexon', 'Punch', 'Tiago', 'Altroz', 'Harrier', 'Safari', 'Nexon EV', 'Tigor'],
    'budget',
    12,
  ],
  ['Mahindra', ['XUV700', 'Scorpio N', 'Thar', 'XUV 300', 'Bolero', 'Scorpio'], 'mid', 9],
  ['Kia', ['Seltos', 'Sonet', 'Carens'], 'mid', 7],
  ['Honda', ['City', 'Amaze', 'Jazz', 'WR-V'], 'mid', 7],
  [
    'Toyota',
    ['Innova Crysta', 'Fortuner', 'Glanza', 'Urban Cruiser Hyryder', 'Innova Hycross'],
    'premium',
    7,
  ],
  ['Volkswagen', ['Polo', 'Virtus', 'Taigun'], 'mid', 3],
  ['Skoda', ['Kushaq', 'Slavia', 'Octavia'], 'mid', 3],
  ['MG Motors', ['Hector', 'ZS EV', 'Astor'], 'mid', 3],
  ['Renault', ['Kwid', 'Kiger', 'Triber'], 'budget', 3],
  ['Nissan', ['Magnite'], 'budget', 1],
  ['Ford', ['EcoSport', 'Figo'], 'budget', 2],
  ['BMW', ['3 Series', 'X1'], 'luxury', 1],
  ['Mercedes-Benz', ['C-Class', 'E-Class', 'GLA'], 'luxury', 1],
  ['Audi', ['A4', 'Q3'], 'luxury', 1],
  ['Jeep', ['Compass'], 'premium', 1],
];
const EV_AND_HYBRID = [
  'Nexon EV',
  'ZS EV',
  'Urban Cruiser Hyryder',
  'Innova Hycross',
  'Grand Vitara',
];
const NEW_PRICE_RANGE: Readonly<Record<Tier, readonly [number, number]>> = {
  budget: [450_000, 1_000_000],
  mid: [800_000, 1_900_000],
  premium: [1_500_000, 3_800_000],
  luxury: [4_200_000, 8_000_000],
};

const BODY_TYPES = [
  'hatchback',
  'sedan',
  'suv',
  'muv',
  'mpv',
  'crossover',
  'coupe',
  'convertible',
  'sports',
  'pick-up',
];
const LEAD_FUELS = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'];
const TRANSMISSIONS = ['manual', 'automatic', 'amt', 'cvt', 'dct'];
const LEAD_SOURCES: readonly (readonly [string, number])[] = [
  ['walkin', 24],
  ['phone', 16],
  ['website', 12],
  ['whatsapp', 12],
  ['referral', 10],
  ['instagram', 8],
  ['facebook', 8],
  ['other', 4],
];
const TIMELINES: readonly (readonly [string | null, number])[] = [
  ['immediate', 30],
  ['1 month', 30],
  ['3 months', 22],
  ['6 months', 10],
  [null, 8],
];
const TASK_TYPES: readonly (readonly [TaskType, number])[] = [
  ['call', 40],
  ['whatsapp', 20],
  ['meeting', 12],
  ['test_drive', 12],
  ['send_quotation', 10],
  ['other', 6],
];
const OUTCOMES: readonly (readonly [Outcome, number])[] = [
  ['reached', 35],
  ['no_answer', 22],
  ['rescheduled', 15],
  ['not_interested', 8],
  ['done', 20],
];
const TASK_NOTES: Readonly<Record<TaskType, readonly string[]>> = {
  call: [
    'Call to check interest',
    'Follow up on pricing discussion',
    'Confirm visit timing',
    'Check loan eligibility',
  ],
  whatsapp: [
    'Share photos on WhatsApp',
    'Send video walkaround',
    'Share brochure and price',
    'Weekly check-in',
  ],
  meeting: [
    'Showroom visit',
    'Discuss trade-in valuation',
    'Paperwork and documentation',
    'Negotiate final price',
  ],
  test_drive: ['Test drive at showroom', 'Home test drive', 'Weekend test drive'],
  send_quotation: [
    'Send on-road quote',
    'Send finance quote with EMI options',
    'Send insurance quotation',
  ],
  other: ['Collect KYC documents', 'Arrange inspection report', 'RC transfer status update'],
};
const COMPLETION_NOTES: Readonly<Record<Outcome, readonly string[]>> = {
  reached: [
    'Spoke to customer, still interested',
    'Customer wants to visit this weekend',
    'Discussed EMI options',
    'Asked for best price',
  ],
  no_answer: ['No answer, will retry', 'Phone switched off', 'Call not picked, sent WhatsApp'],
  rescheduled: ['Customer asked to call later', 'Travelling, call next week', 'Busy, rescheduled'],
  not_interested: ['Not interested anymore', 'Bought from another dealer', 'Budget changed'],
  done: [
    'Completed as planned',
    'Test drive done, positive feedback',
    'Quote shared',
    'Visit done',
  ],
};
const LOST_NOTES = [
  'Bought from another dealer',
  'Budget too low for available stock',
  'Went with a new car instead',
  'Not reachable after several attempts',
  'Postponed purchase indefinitely',
  'Loan not approved',
];
const NOT_NOW_NOTES = [
  'Will decide after Diwali',
  'Waiting on loan approval',
  'Shifting cities, will decide later',
  'Asked to follow up next month',
  'Waiting for bonus',
];
const BOOKING_NOTES = [
  'Token amount paid',
  'Booking amount received, loan in process',
  'Booked, delivery next week',
];
const CONVERT_NOTES = [
  'Delivered. Happy customer',
  'Delivery done with trade-in',
  'Payment received in full, delivered',
];
const LEAD_NOTES = [
  'Looking for a family car',
  'First car, wants low maintenance',
  'Prefers single-owner cars',
  'Needs car for daily office commute',
  'Interested in automatic only',
  'Wants a car with sunroof',
  'Comparing with new car prices',
  'Wants low km driven',
  'Referred by an earlier customer',
  'Asked about warranty options',
  null,
  null,
];
const VEHICLE_DESCRIPTIONS = [
  'Single owner, company serviced',
  'Doctor-owned, driven mostly on weekends',
  'Minor scratches on rear bumper',
  'Second set of keys available',
  'Battery replaced recently',
  'Original paint, no repaints',
  'New tyres fitted',
  'Touchscreen infotainment with reverse camera',
  'Accident repaired, insurance claim done',
  'Extended warranty valid',
  null,
];
const DROP_REASONS = [
  'Owner sold privately',
  'Owner withdrew the listing',
  'Owner wants a higher price',
  'Failed inspection',
];
const RELIST_REASONS = [
  'Owner agreed to revised price',
  'Re-listed after repairs',
  'Owner changed their mind',
];
const CURRENT_VEHICLES = [
  'Maruti Alto 2012',
  'Hyundai Santro 2010',
  'Tata Indica 2011',
  'Honda City 2014',
  'Maruti Swift 2015',
  'Hyundai i10 2013',
  'Toyota Etios 2016',
  'Mahindra Bolero 2012',
];
const VEHICLE_EXPENSES: readonly (readonly [string, number, number])[] = [
  ['refurbishment', 8_000, 45_000],
  ['repair', 3_000, 30_000],
  ['detailing', 1_500, 6_000],
  ['transport', 1_000, 5_000],
  ['inspection', 800, 2_500],
  ['documentation', 1_000, 4_500],
];

// ---------------------------------------------------------------------------
// Identity generators
// ---------------------------------------------------------------------------

const usedPhones = new Set<string>();
function phone(prefix: string): string {
  for (;;) {
    const number = `+91${prefix}${String(between(0, 10 ** (10 - prefix.length) - 1)).padStart(10 - prefix.length, '0')}`;
    if (!usedPhones.has(number)) {
      usedPhones.add(number);
      return number;
    }
  }
}
const usedEmails = new Set<string>();
function emailFor(name: string, domain = 'gmail.com'): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/ +/g, '.');
  for (let n = 0; ; n++) {
    const email = `${base}${n === 0 ? '' : n}@${domain}`;
    if (!usedEmails.has(email)) {
      usedEmails.add(email);
      return email;
    }
  }
}
const personName = (): string => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const usedRegs = new Set<string>();
function registrationNumber(): string {
  for (;;) {
    const [state, rtoMax] = weighted(REG_STATES.map((s) => [s, s[2]] as const));
    const rto = String(between(1, rtoMax)).padStart(2, '0');
    const series = String.fromCharCode(65 + between(0, 25), 65 + between(0, 25));
    const reg = `${state}${rto}${series}${between(1000, 9999)}`;
    if (!usedRegs.has(reg)) {
      usedRegs.add(reg);
      return reg;
    }
  }
}
function place(): { city: string; area: string } {
  const [city, areas] = weighted(CITIES.map((c, i) => [c, i === 0 ? 14 : 1] as const));
  return { city, area: pick(areas) };
}

// ---------------------------------------------------------------------------
// Output rows
// ---------------------------------------------------------------------------

const rows = {
  users: [] as TablesInsert<'users'>[],
  user_roles: [] as TablesInsert<'user_roles'>[],
  owners: [] as OwnerRow[],
  vehicles: [] as TablesInsert<'vehicles'>[],
  vehicle_financials: [] as FinancialsRow[],
  vehicle_status_history: [] as TablesInsert<'vehicle_status_history'>[],
  vehicle_media: [] as TablesInsert<'vehicle_media'>[],
  vehicle_documents: [] as TablesInsert<'vehicle_documents'>[],
  contacts: [] as ContactRow[],
  buyers: [] as TablesInsert<'buyers'>[],
  buyer_preferences: [] as TablesInsert<'buyer_preferences'>[],
  leads: [] as TablesInsert<'leads'>[],
  lead_status_history: [] as TablesInsert<'lead_status_history'>[],
  audit_logs: [] as TablesInsert<'audit_logs'>[],
  follow_ups: [] as FollowUpRow[],
  notifications: [] as TablesInsert<'notifications'>[],
  saved_vehicles: [] as TablesInsert<'saved_vehicles'>[],
  recently_viewed: [] as TablesInsert<'recently_viewed'>[],
  expenses: [] as ExpenseRow[],
  income: [] as IncomeRow[],
};

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

async function assertEmpty(): Promise<void> {
  for (const table of ['users', 'vehicles', 'leads'] as const) {
    const { count, error } = await db.from(table).select('id', { count: 'exact', head: true });
    if (error) throw new Error(`count ${table}: ${error.message}`);
    if (count !== null && count > 0) {
      throw new Error(`${table} already has ${count} rows; this seed expects an empty database`);
    }
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

function vehicleFuel(fuel: string): string {
  if (fuel === 'cng_petrol') return 'cng';
  if (fuel === 'lpg' || fuel === 'lpg_petrol') return 'petrol';
  return fuel;
}
function vehicleTransmission(variant: CatalogVariant): string {
  const name = variant.name.toUpperCase();
  if (/\bAMT\b|\bAGS\b/.test(name)) return 'amt';
  if (/\bCVT\b|\bIVT\b/.test(name)) return 'cvt';
  if (/\bDCT\b|\bDSG\b|\bDCA\b/.test(name)) return 'dct';
  return variant.transmission ?? 'manual';
}

async function loadCatalog(): Promise<CatalogModel[]> {
  const models: CatalogModel[] = [];
  for (const [make, names, tier, weight] of POPULAR_MODELS) {
    const variants: CatalogVariant[] = [];
    for (let from = 0; ; from += 1000) {
      const page = check(
        await db
          .from('variants')
          .select(
            'id, name, fuel_type, transmission, body_type, launch_year, discontinued_year, models!inner(id, name, makes!inner(id, name))',
          )
          .eq('models.makes.name', make)
          .in('models.name', names)
          .is('deleted_at', null)
          .order('id')
          .range(from, from + 999),
        `load ${make} variants`,
      );
      variants.push(...page);
      if (page.length < 1000) break;
    }
    for (const name of names) {
      const own = variants.filter(
        (v) => v.models.name === name && !isIn(v.fuel_type, ['lpg', 'lpg_petrol']),
      );
      const first = own[0];
      if (first === undefined) {
        console.warn(`  no variants for ${make} ${name}, skipping`);
        continue;
      }
      models.push({
        make,
        makeId: first.models.makes.id,
        model: name,
        modelId: first.models.id,
        tier,
        // Extra EVs and hybrids so fuel filters have something to find.
        weight: (weight / names.length) * (EV_AND_HYBRID.includes(name) ? 4 : 1),
        variants: own,
      });
    }
  }
  return models;
}

/** A variant and a model year it was on sale. */
function pickVariantAndYear(model: CatalogModel): { variant: CatalogVariant; year: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const variant = pick(model.variants);
    const launch = Math.max(
      variant.launch_year && variant.launch_year > 1950 ? variant.launch_year : 2008,
      2008,
    );
    const end = Math.min(variant.discontinued_year ?? 2025, 2025);
    if (launch <= end) {
      return { variant, year: between(launch, end) };
    }
  }
  return { variant: pick(model.variants), year: between(2015, 2023) };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function createAuthUser(email: string, fullName: string): Promise<string> {
  if (DRY_RUN) return randomUUID();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`create auth user ${email}: ${error.message}`);
  return data.user.id;
}

interface LoginProfile {
  readonly full_name: string;
  readonly phone: string;
  readonly showroom_id?: string;
  /** Epoch ms the login was deactivated, if it was. */
  readonly deleted_at?: number;
}

async function createLogin(
  email: string,
  profile: LoginProfile,
  roles: readonly Role[],
  createdAt: number,
  grantedBy: string | null,
): Promise<string> {
  const id = await createAuthUser(email, profile.full_name);
  if (profile.deleted_at !== undefined && !DRY_RUN) {
    // Deactivating staff bans their auth user (supabase-auth-user-provisioner).
    check(await db.auth.admin.updateUserById(id, { ban_duration: '876000h' }), `ban ${email}`);
  }
  rows.users.push({
    id,
    full_name: profile.full_name,
    phone: profile.phone,
    email,
    avatar_url: null,
    showroom_id: profile.showroom_id ?? null,
    created_at: iso(createdAt),
    updated_at: iso(profile.deleted_at ?? createdAt),
    deleted_at: profile.deleted_at === undefined ? null : iso(profile.deleted_at),
  });
  for (const role of roles) {
    rows.user_roles.push({
      user_id: id,
      role_id: ROLE_IDS[role],
      granted_by: grantedBy ?? id,
      granted_at: iso(createdAt),
      deleted_at: profile.deleted_at === undefined ? null : iso(profile.deleted_at),
    });
  }
  return id;
}

const staff: StaffMember[] = [];
async function seedStaff(): Promise<void> {
  const defs: { name: string; email: string; roles: Role[]; day: number; leftDay?: number }[] = [
    { name: 'Admin', email: 'admin@example.com', roles: ['admin'], day: 0 },
    {
      name: 'Kavita Iyer',
      email: 'kavita.iyer@example.com',
      roles: ['admin', 'salesperson'],
      day: 0,
    },
    { name: 'Rohan Verma', email: 'rohan.verma@example.com', roles: ['salesperson'], day: 0 },
    { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@example.com', roles: ['salesperson'], day: 6 },
    {
      name: 'Imran Shaikh',
      email: 'imran.shaikh@example.com',
      roles: ['salesperson'],
      day: 28,
      leftDay: 122,
    },
    { name: 'Priya Raman', email: 'priya.raman@example.com', roles: ['salesperson'], day: 61 },
    { name: 'Vikram Joshi', email: 'vikram.joshi@example.com', roles: ['salesperson'], day: 151 },
    { name: 'Deepa Hegde', email: 'deepa.hegde@example.com', roles: ['salesperson'], day: 95 },
  ];
  let firstAdminId: string | null = null;
  for (const def of defs) {
    const createdAt = atIST(START + def.day * DAY, 10, 0);
    const leftAt = def.leftDay === undefined ? undefined : atIST(START + def.leftDay * DAY, 18, 0);
    const id = await createLogin(
      def.email,
      { full_name: def.name, phone: phone('99001'), showroom_id: SHOWROOM_ID, deleted_at: leftAt },
      def.roles,
      createdAt,
      firstAdminId,
    );
    usedEmails.add(def.email);
    firstAdminId ??= id;
    staff.push({ id, ...def, createdAt, leftAt: leftAt ?? Infinity });
  }
}
const admins = (): StaffMember[] => staff.filter((s) => s.roles.includes('admin'));
function adminId(): string {
  const first = staff[0];
  if (first === undefined) throw new Error('Seed staff before using adminId()');
  return first.id;
}
const salesAt = (t: number): StaffMember[] =>
  staff.filter((s) => s.roles.includes('salesperson') && s.createdAt <= t && s.leftAt > t);
/** A salesperson on duty at t; the admin who also sells takes fewer leads. */
const pickSales = (t: number): StaffMember | null => {
  const sales = salesAt(t);
  return sales.length === 0
    ? null
    : weighted(sales.map((s) => [s, s.roles.includes('admin') ? 0.4 : 1] as const));
};
/** The main admin does most admin work. */
const pickAdmin = (): StaffMember =>
  weighted(admins().map((a, i) => [a, i === 0 ? 3 : 1] as const));
const staffById = (id: string | null): StaffMember | undefined => staff.find((s) => s.id === id);
function requireStaff(id: string): StaffMember {
  const member = staffById(id);
  if (member === undefined) throw new Error(`No staff member ${id}`);
  return member;
}
const isActiveStaff = (id: string, t: number): boolean => {
  const s = staffById(id);
  return s !== undefined && s.createdAt <= t && s.leftAt > t;
};

// ---------------------------------------------------------------------------
// Owners and vehicles
// ---------------------------------------------------------------------------

const owners: OwnerRow[] = [];
function newOwner(createdAt: number, createdBy: string): OwnerRow {
  const name = personName();
  const { city, area } = place();
  const owner: OwnerRow = {
    id: randomUUID(),
    user_id: null,
    full_name: name,
    phone: phone('98450'),
    email: chance(0.6) ? emailFor(name) : null,
    address: chance(0.8)
      ? `${between(1, 999)}, ${pick(['1st', '2nd', '3rd', '4th', '5th'])} Cross, ${area}`
      : null,
    city: chance(0.9) ? city : null,
    preferred_contact_method: weighted([
      ['phone', 5],
      ['whatsapp', 4],
      ['email', 1],
      [null, 2],
    ]),
    alt_phone: chance(0.2) ? phone('98860') : null,
    id_info: chance(0.4) ? `Aadhaar XXXX-XXXX-${between(1000, 9999)}` : null,
    notes: chance(0.25)
      ? pick([
          'Prefers calls after 6pm',
          'Wants quick sale',
          'Relocating abroad',
          'Selling to upgrade',
          'Has two more cars to sell later',
        ])
      : null,
    created_by: createdBy,
    created_at: iso(createdAt),
    updated_at: iso(createdAt),
    deleted_at: null,
  };
  owners.push(owner);
  rows.owners.push(owner);
  return owner;
}

const vehicles: SimVehicle[] = [];
let catalog: CatalogModel[] = [];

function priceVehicle(model: CatalogModel, year: number, km: number): number {
  const [lo, hi] = NEW_PRICE_RANGE[model.tier];
  const newPrice = lo + rand() * (hi - lo);
  const age = Math.max(0, 2026 - year);
  const depreciation = Math.max(0.25, 0.9 * 0.88 ** age - km / 2_000_000);
  return roundTo(newPrice * depreciation, 5_000);
}

function createVehicle(t: number): SimVehicle {
  const actor = pickAdmin().id;
  const reuseOwner = owners.length > 10 && chance(0.15);
  const owner = reuseOwner ? pick(owners) : newOwner(t - between(5, 120) * MINUTE, actor);
  const model = weighted(catalog.map((m) => [m, m.weight] as const));
  const { variant, year } = pickVariantAndYear(model);
  const age = Math.max(0, 2026 - year);
  const km = Math.min(
    220_000,
    Math.max(3_000, roundTo(age * between(6_000, 16_000) + between(0, 8_000), 100)),
  );
  const acquisition = weighted([
    ['dealership_purchase', 55],
    ['consignment', 30],
    ['intermediary_sale', 15],
  ]);
  const insurance = weighted([
    ['valid', 70],
    ['expired', 18],
    [null, 12],
  ]);
  const vehicle: SimVehicle = {
    id: randomUUID(),
    model,
    variant,
    created: t,
    status: 'open',
    deleted: false,
    soldLeadId: null,
    linkable: true,
    row: {
      showroom_id: SHOWROOM_ID,
      owner_id: owner.id,
      variant_id: variant.id,
      year,
      registration_number: registrationNumber(),
      fuel_type: vehicleFuel(variant.fuel_type ?? 'petrol'),
      transmission: vehicleTransmission(variant),
      km_driven: km,
      num_previous_owners: weighted([
        [0, 3],
        [1, 40],
        [2, 30],
        [3, 15],
        [4, 6],
      ]),
      colour: pick(COLOURS),
      insurance_valid_until:
        insurance === null
          ? null
          : dateOnly(
              insurance === 'valid' ? NOW + between(20, 360) * DAY : NOW - between(5, 400) * DAY,
            ),
      rc_status: weighted([
        ['clear', 70],
        ['hypothecation', 15],
        ['under_transfer', 8],
        [null, 7],
      ]),
      service_history: weighted([
        ['full', 40],
        ['partial', 30],
        ['none', 10],
        ['unknown', 12],
        [null, 8],
      ]),
      accident_history: chance(0.15),
      loan_status: weighted([
        ['clear', 70],
        ['active', 18],
        [null, 12],
      ]),
      location: chance(0.85) ? `${place().area}, Bengaluru` : null,
      description: pick(VEHICLE_DESCRIPTIONS),
      acquisition_type: acquisition,
      submitted_by: actor,
      created_at: iso(t),
      deleted_at: null,
    },
    listed: priceVehicle(model, year, km),
    expenses: 0,
    financials: null,
  };
  vehicles.push(vehicle);
  vehicleHistory(vehicle, null, 'open', actor, t);
  buildFinancials(vehicle);

  // A few intake mistakes: deleted soon after, never linked.
  if (vehicles.length % 64 === 13) {
    vehicle.linkable = false;
    schedule({ t: t + between(1, 30) * HOUR, kind: 'vehicle_delete', vehicle });
  } else if (chance(0.1)) {
    schedule({ t: afterDays(t, 8, 80), kind: 'vehicle_drop', vehicle });
  }
  return vehicle;
}

function vehicleHistory(
  vehicle: SimVehicle,
  from: VehicleStatus | null,
  to: VehicleStatus,
  actor: string,
  t: number,
  reason: string | null = null,
): void {
  rows.vehicle_status_history.push({
    vehicle_id: vehicle.id,
    from_status: from,
    to_status: to,
    changed_by: actor,
    reason,
    changed_at: iso(t),
  });
  vehicle.status = to;
  vehicle.updated = t;
}

function buildFinancials(vehicle: SimVehicle): void {
  const shape = weighted([
    ['none', 5],
    ['partial', 10],
    ['full', 85],
  ]);
  if (shape === 'none') return;
  const listed = vehicle.listed;
  const f: FinancialsRow = {
    vehicle_id: vehicle.id,
    owner_expected_price: roundTo(listed * (0.85 + rand() * 0.2), 5_000),
    company_purchase_price: null,
    expected_selling_price: null,
    minimum_selling_price: null,
    listed_price: null,
    commission_amount: null,
    commission_percent: null,
    other_costs: null,
    actual_selling_price: null,
    sold_at: null,
    sold_by: null,
    updated_at: vehicle.row.created_at,
  };
  if (shape === 'full') {
    f.expected_selling_price = roundTo(listed * 1.02, 5_000);
    f.minimum_selling_price = roundTo(listed * 0.92, 5_000);
    f.listed_price = listed;
    if (vehicle.row.acquisition_type === 'dealership_purchase') {
      f.company_purchase_price = roundTo(listed * (0.8 + rand() * 0.08), 5_000);
    } else if (chance(0.5)) {
      f.commission_percent = pick([1.5, 2, 2.5, 3]);
    } else {
      f.commission_amount = roundTo(listed * 0.02, 1_000);
    }
  }
  vehicle.financials = f;
  rows.vehicle_financials.push(f);
}

const activeLeadsOn = (vehicle: SimVehicle): SimLead[] =>
  leads.filter((l) => l.vehicleId === vehicle.id && isIn(l.status, ACTIVE) && !l.deleted);

function refreshVehicle(vehicle: SimVehicle, t: number, actor: string): void {
  if (vehicle.status !== 'open' && vehicle.status !== 'linked') return;
  const want = activeLeadsOn(vehicle).length > 0 ? 'linked' : 'open';
  if (want !== vehicle.status) vehicleHistory(vehicle, vehicle.status, want, actor, t);
}

const isLinkable = (vehicle: SimVehicle, t: number): boolean =>
  vehicle.linkable &&
  !vehicle.deleted &&
  vehicle.created < t &&
  isIn(vehicle.status, ['open', 'linked']);

function pickLinkableVehicle(t: number, prefer?: { makeId: string | null }): SimVehicle | null {
  const candidates = vehicles.filter((v) => isLinkable(v, t));
  if (candidates.length === 0) return null;
  if (prefer && chance(0.6)) {
    const matching = candidates.filter((v) => v.model.makeId === prefer.makeId);
    if (matching.length > 0) return pick(matching);
  }
  return weighted(candidates.map((v) => [v, 1 / (1 + 0.4 * activeLeadsOn(v).length)] as const));
}

// ---------------------------------------------------------------------------
// Buyers, contacts and leads
// ---------------------------------------------------------------------------

const ACTIVE: readonly (LeadStatus | null)[] = ['new', 'not_now', 'booking_confirmed'];
const leads: SimLead[] = [];
const contacts: ContactRow[] = [];
const buyers: SimBuyer[] = [];

async function seedBuyersAndOwnerLogins(): Promise<void> {
  for (let i = 0; i < BUYER_COUNT; i++) {
    const createdAt = rampedTime();
    const name = personName();
    const id = await createLogin(
      emailFor(name, 'example.net'),
      { full_name: name, phone: phone('96320') },
      ['buyer'],
      createdAt,
      null,
    );
    const user = rows.users[rows.users.length - 1];
    if (user === undefined) throw new Error('createLogin did not record a user row');
    const min = pick([null, 300_000, 500_000, 800_000]);
    const buyer = {
      id: randomUUID(),
      user_id: id,
      budget_min: min,
      budget_max: chance(0.85) ? (min ?? 300_000) + pick([300_000, 500_000, 1_000_000]) : null,
      preferred_contact_method: weighted([
        ['phone', 4],
        ['whatsapp', 4],
        ['email', 2],
        [null, 1],
      ]),
      location: chance(0.8) ? place().city : null,
      created_at: iso(createdAt),
      updated_at: iso(createdAt),
    };
    rows.buyers.push(buyer);
    buyers.push({ ...buyer, user, createdAt });
    for (const [type, value] of sample(
      [
        ['fuel_type', pick(LEAD_FUELS)],
        ['fuel_type', pick(LEAD_FUELS)],
        ['transmission', pick(['manual', 'automatic'])],
        ['make', pick(POPULAR_MODELS)[0]],
        ['make', pick(POPULAR_MODELS)[0]],
      ] as const,
      between(0, 4),
    )) {
      rows.buyer_preferences.push({
        buyer_id: buyer.id,
        preference_type: type,
        value,
        created_at: iso(createdAt),
      });
    }
  }
}

async function linkOwnerLogins(): Promise<void> {
  const withEmail = owners.filter((o) => o.email !== null);
  for (const owner of sample(withEmail, OWNER_PORTAL_COUNT)) {
    const createdAt = Date.parse(owner.created_at) + between(1, 20) * DAY;
    owner.user_id = await createLogin(
      owner.email as string,
      { full_name: owner.full_name, phone: phone('98451') },
      ['owner'],
      Math.min(createdAt, NOW - HOUR),
      adminId(),
    );
  }
}

function newContact(t: number, actor: string): ContactRow {
  const name = personName();
  const contact: ContactRow = {
    id: randomUUID(),
    full_name: name,
    phone: phone('97400'),
    email: chance(0.55) ? emailFor(name) : null,
    merged_into_user_id: null,
    created_by: actor,
    created_at: iso(t),
    updated_at: iso(t),
    deleted_at: null,
  };
  contacts.push(contact);
  rows.contacts.push(contact);
  return contact;
}

function leadHistory(
  lead: SimLead,
  from: LeadStatus | null,
  to: LeadStatus,
  actor: string,
  t: number,
  notes: string | null = null,
): void {
  rows.lead_status_history.push({
    lead_id: lead.id,
    from_status: from,
    to_status: to,
    changed_by: actor,
    notes,
    changed_at: iso(t),
  });
  lead.status = to;
  lead.updated = t;
  if (isIn(to, ACTIVE)) lead.endActive = null;
  else lead.endActive ??= t;
}

function assign(lead: SimLead, assignee: string | null, actor: string, t: number): void {
  rows.audit_logs.push({
    entity_type: 'lead',
    entity_id: lead.id,
    action: 'lead.assigned',
    actor_id: actor,
    before_value: { assigned_to: lead.assignedTo } satisfies Json,
    after_value: { assigned_to: assignee } satisfies Json,
    metadata: null,
    created_at: iso(t),
  });
  if (assignee !== null && assignee !== actor) {
    rows.notifications.push({
      user_id: assignee,
      type: 'lead_assigned',
      title: 'New lead assigned',
      body: 'A lead has been assigned to you',
      entity_type: 'lead',
      entity_id: lead.id,
      is_read: NOW - t > 3 * DAY ? chance(0.9) : chance(0.3),
      created_at: iso(t),
      due_at: null,
    });
  }
  lead.assignedTo = assignee;
  lead.assignments.push({ t, userId: assignee });
  lead.updated = t;
}

const actorFor = (lead: SimLead, t: number): string =>
  lead.assignedTo !== null && isActiveStaff(lead.assignedTo, t) ? lead.assignedTo : adminId();

function preferenceFor(vehicle: SimVehicle | null): LeadPreference {
  const shape = weighted([
    ['none', 30],
    ['partial', 35],
    ['full', 35],
  ]);
  const p: LeadPreference = {
    preferred_make_id: null,
    preferred_model_id: null,
    preferred_variant_id: null,
    preferred_colours: [],
    preferred_fuel_types: [],
    preferred_transmissions: [],
    preferred_body_types: [],
    preferred_year_min: null,
    preferred_year_max: null,
    preferred_km_max: null,
    preferred_max_owners: null,
    preferred_vehicle: null,
  };
  if (shape === 'none') {
    p.preferred_vehicle = chance(0.3)
      ? pick([
          'Any compact SUV under 10L',
          'Automatic hatchback',
          '7 seater for family',
          'Sedan, diesel preferred',
        ])
      : null;
    return p;
  }
  const model =
    vehicle && chance(0.7) ? vehicle.model : weighted(catalog.map((m) => [m, m.weight] as const));
  if (shape === 'partial') {
    const kind = weighted([
      ['make', 4],
      ['body', 4],
      ['model', 2],
    ]);
    if (kind === 'make' || kind === 'model') p.preferred_make_id = model.makeId;
    if (kind === 'model') p.preferred_model_id = model.modelId;
    if (kind === 'body')
      p.preferred_body_types = sample(['hatchback', 'sedan', 'suv', 'muv'], between(1, 2));
    if (chance(0.4)) p.preferred_fuel_types = sample(LEAD_FUELS.slice(0, 3), between(1, 2));
    p.preferred_vehicle =
      kind === 'body' ? null : `${model.make} ${kind === 'model' ? model.model : ''}`.trim();
    return p;
  }
  p.preferred_make_id = model.makeId;
  p.preferred_model_id = model.modelId;
  if (chance(0.5))
    p.preferred_variant_id = (
      vehicle && vehicle.model === model ? vehicle.variant : pick(model.variants)
    ).id;
  p.preferred_colours = sample(COLOURS, between(0, 3));
  p.preferred_fuel_types = sample(LEAD_FUELS, between(0, 2));
  p.preferred_transmissions = sample(TRANSMISSIONS, between(0, 2));
  const bodies = BODY_TYPES.filter((b) => (model.variants[0]?.body_type ?? '').includes(b));
  p.preferred_body_types = bodies.length > 0 && chance(0.6) ? bodies.slice(0, 1) : [];
  const yearMin = chance(0.7) ? between(2014, 2021) : null;
  p.preferred_year_min = yearMin;
  p.preferred_year_max = chance(0.5) ? between(yearMin ?? 2016, 2025) : null;
  p.preferred_km_max = chance(0.6) ? pick([30_000, 50_000, 60_000, 80_000, 100_000]) : null;
  p.preferred_max_owners = chance(0.5) ? pick([1, 2, 3]) : null;
  p.preferred_vehicle = `${model.make} ${model.model}`;
  return p;
}

/** Plans the lead's future as a list of {after, action} steps. */
function planFate(lead: SimLead): void {
  const age = NOW - lead.created;
  const recent = age < 6 * DAY;
  const fate = recent
    ? weighted([
        ['stay', 70],
        ['not_now', 10],
        ['booking', 10],
        ['lost', 10],
      ])
    : weighted([
        ['stay', 18],
        ['not_now', 14],
        ['not_now_back', 6],
        ['booking', 9],
        ['convert', 22],
        ['lost', 23],
        ['nn_lost', 8],
      ]);
  const steps: [LeadActionKind, number, number][] = [];
  const needsVehicle = isIn(fate, ['booking', 'convert']);
  if (needsVehicle && lead.vehicleId === null) steps.push(['link', 1, 8]);
  if (fate === 'not_now' || fate === 'not_now_back' || fate === 'nn_lost')
    steps.push(['not_now', 2, 15]);
  if (fate === 'not_now_back') steps.push(['new', 10, 40]);
  if (fate === 'convert' && chance(0.2)) steps.push(['not_now', 2, 10], ['new', 5, 20]);
  if (needsVehicle) steps.push(['booking_confirmed', 2, 18]);
  if (fate === 'convert') steps.push(['converted', 3, 15]);
  if (fate === 'lost' || fate === 'nn_lost') steps.push(['lost', 3, 35]);
  if (lead.vehicleId !== null && fate === 'stay' && chance(0.08)) steps.push(['unlink', 3, 20]);
  let t = lead.created;
  const generation = ++lead.generation;
  for (const [action, min, max] of steps) {
    t = afterDays(t, min, max);
    if (t > NOW) break;
    schedule({ t, kind: 'lead_action', lead, action, generation });
  }
  if (lead.assignedTo !== null && chance(0.1)) {
    const at = afterDays(lead.created, 1, 30);
    if (at < NOW) schedule({ t: at, kind: 'lead_reassign', lead });
  }
}

function createLead(t: number, buyerLead: boolean): void {
  let contact: ContactRow | null = null;
  let userId: string | null = null;
  let createdBy: string;
  let source: string;
  if (buyerLead) {
    const buyer = maybePick(buyers.filter((b) => b.createdAt < t));
    if (!buyer) return createLead(t, false);
    userId = buyer.user_id;
    createdBy = buyer.user_id;
    source = weighted([
      ['marketplace', 6],
      ['mobile_app', 4],
    ]);
  } else {
    const seller = pickSales(t);
    createdBy = chance(0.6) && seller !== null ? seller.id : pickAdmin().id;
    contact =
      contacts.length > 20 && chance(0.12)
        ? (maybePick(contacts.filter((c) => c.deleted_at === null)) ?? null)
        : newContact(t, createdBy);
    source = weighted(LEAD_SOURCES);
  }
  const vehicle = chance(0.55) ? pickLinkableVehicle(t) : null;
  const preference = preferenceFor(vehicle);
  const budgetBase = vehicle ? vehicle.listed : roundTo(between(300_000, 2_500_000), 10_000);
  const currentVehicle = chance(0.35) ? pick(CURRENT_VEHICLES) : null;
  const lead: SimLead = {
    id: randomUUID(),
    created: t,
    status: null,
    vehicleId: vehicle?.id ?? null,
    assignedTo: null,
    assignments: [],
    deleted: false,
    generation: 0,
    endActive: null,
    buyerLead,
    contact,
    row: {
      showroom_id: SHOWROOM_ID,
      user_id: userId,
      contact_id: contact?.id ?? null,
      source,
      budget: chance(0.12) ? null : roundTo(budgetBase * (0.85 + rand() * 0.3), 10_000),
      purchase_timeline: weighted(TIMELINES),
      finance_required: weighted([
        [true, 45],
        [false, 45],
        [null, 10],
      ]),
      current_vehicle: currentVehicle,
      trade_in_required: currentVehicle
        ? chance(0.6)
        : weighted([
            [false, 8],
            [null, 2],
          ]),
      notes: pick(LEAD_NOTES),
      created_by: createdBy,
      created_at: iso(t),
      ...preference,
    },
  };
  leads.push(lead);
  leadHistory(lead, null, 'new', createdBy, t);

  if (buyerLead) {
    if (chance(0.8)) {
      const at = t + between(1, 48) * HOUR;
      if (at < NOW) schedule({ t: at, kind: 'lead_assign', lead });
    }
  } else if (requireStaff(createdBy).roles.includes('salesperson') && chance(0.85)) {
    assign(lead, createdBy, createdBy, t);
  } else if (chance(0.8)) {
    const seller = pickSales(t);
    if (seller !== null) assign(lead, seller.id, createdBy, t);
  } else if (chance(0.6)) {
    const at = t + between(2, 72) * HOUR;
    if (at < NOW) schedule({ t: at, kind: 'lead_assign', lead });
  }
  if (vehicle) refreshVehicle(vehicle, t, createdBy);
  planFate(lead);
}

function sellVehicle(vehicle: SimVehicle, lead: SimLead, t: number, actor: string): void {
  vehicleHistory(vehicle, vehicle.status, 'sold', actor, t, `Sold through lead ${lead.id}`);
  vehicle.soldLeadId = lead.id;
  vehicle.soldAt = t;
  vehicle.soldBy = actor;
  vehicle.soldLead = lead;
  for (const other of activeLeadsOn(vehicle)) {
    if (other === lead) continue;
    other.vehicleId = null;
    other.generation++;
    leadHistory(
      other,
      other.status,
      'vehicle_unavailable',
      actor,
      t,
      `Vehicle sold through lead ${lead.id}`,
    );
    const revive = weighted([
      ['revive', 45],
      ['lose', 25],
      ['stay', 30],
    ]);
    if (revive === 'revive') {
      const at = afterDays(t, 2, 15);
      if (at < NOW) schedule({ t: at, kind: 'lead_revive', lead: other });
    } else if (revive === 'lose') {
      const at = afterDays(t, 3, 25);
      if (at < NOW)
        schedule({
          t: at,
          kind: 'lead_action',
          lead: other,
          action: 'lost',
          generation: other.generation,
        });
    }
  }
  const f = vehicle.financials;
  if (f !== null) {
    const listed = f.listed_price ?? vehicle.listed;
    f.listed_price ??= listed;
    f.actual_selling_price = roundTo(listed * (0.93 + rand() * 0.07), 5_000);
    f.sold_at = iso(t);
    f.sold_by = actor;
    f.updated_at = iso(t);
  }
}

const ALLOWED_ACTIONS: Partial<Record<LeadStatus, readonly LeadActionKind[]>> = {
  new: ['not_now', 'booking_confirmed', 'lost'],
  not_now: ['new', 'booking_confirmed', 'lost'],
  booking_confirmed: ['converted', 'lost'],
  vehicle_unavailable: ['new', 'not_now', 'booking_confirmed', 'lost'],
};

function leadAction(event: Extract<SimEvent, { kind: 'lead_action' }>): void {
  const { lead, action, generation } = event;
  if (lead.deleted || generation !== lead.generation) return;
  const t = event.t;
  const actor = actorFor(lead, t);
  const vehicle = vehicles.find((v) => v.id === lead.vehicleId) ?? null;

  if (action === 'link') {
    if (vehicle !== null || !isIn(lead.status, ACTIVE)) return;
    const target = pickLinkableVehicle(t, { makeId: lead.row.preferred_make_id });
    if (target === null) return;
    lead.vehicleId = target.id;
    lead.updated = t;
    refreshVehicle(target, t, actor);
    return;
  }
  if (action === 'unlink') {
    if (vehicle === null || !isIn(lead.status, ['new', 'not_now'])) return;
    lead.vehicleId = null;
    lead.updated = t;
    refreshVehicle(vehicle, t, actor);
    return;
  }

  if (lead.status === null || isIn(lead.status, ['converted', 'lost'])) return;
  if (
    isIn(action, ['booking_confirmed', 'converted']) &&
    (vehicle === null || !isIn(vehicle.status, ['open', 'linked']))
  )
    return;
  if (!ALLOWED_ACTIONS[lead.status]?.includes(action)) return;

  // Every note is drawn, whichever action runs, so the random stream stays stable.
  const notes = {
    not_now: pick(NOT_NOW_NOTES),
    new: pick(['Customer is back in the market', 'Ready to look again', null]),
    booking_confirmed: pick(BOOKING_NOTES),
    converted: pick(CONVERT_NOTES),
    lost: pick(LOST_NOTES),
  }[action];

  if (action === 'converted') {
    if (vehicle === null) return;
    sellVehicle(vehicle, lead, t, actor);
    leadHistory(lead, lead.status, 'converted', actor, t, notes);
    return;
  }
  leadHistory(lead, lead.status, action, actor, t, notes);
  if (vehicle !== null) refreshVehicle(vehicle, t, actor);
}

function reviveLead({ lead, t }: LeadEvent): void {
  if (lead.status !== 'vehicle_unavailable' || lead.deleted) return;
  const target = pickLinkableVehicle(t, { makeId: lead.row.preferred_make_id });
  if (target === null) return;
  const actor = actorFor(lead, t);
  lead.vehicleId = target.id;
  leadHistory(lead, 'vehicle_unavailable', 'new', actor, t, 'Linked another vehicle');
  refreshVehicle(target, t, actor);
  const next = weighted([
    ['stay', 50],
    ['lost', 25],
    ['booking', 25],
  ]);
  if (next === 'stay') return;
  const generation = ++lead.generation;
  let at = afterDays(t, 2, 14);
  if (at >= NOW) return;
  schedule({
    t: at,
    kind: 'lead_action',
    lead,
    action: next === 'lost' ? 'lost' : 'booking_confirmed',
    generation,
  });
  if (next === 'booking' && chance(0.6)) {
    at = afterDays(at, 2, 10);
    if (at < NOW) schedule({ t: at, kind: 'lead_action', lead, action: 'converted', generation });
  }
}

function dropVehicle({ vehicle, t }: VehicleEvent): void {
  if (vehicle.deleted || !isIn(vehicle.status, ['open', 'linked'])) return;
  const actor = pickAdmin().id;
  for (const lead of activeLeadsOn(vehicle)) {
    lead.vehicleId = null;
    lead.updated = t;
  }
  vehicleHistory(vehicle, vehicle.status, 'dropped', actor, t, pick(DROP_REASONS));
  if (chance(0.45)) {
    const at = afterDays(t, 5, 30);
    if (at < NOW) schedule({ t: at, kind: 'vehicle_relist', vehicle });
  }
}

function relistVehicle({ vehicle, t }: VehicleEvent): void {
  if (vehicle.status !== 'dropped') return;
  vehicleHistory(vehicle, 'dropped', 'open', pickAdmin().id, t, pick(RELIST_REASONS));
}

function deleteVehicle({ vehicle, t }: VehicleEvent): void {
  if (vehicle.status !== 'open' || activeLeadsOn(vehicle).length > 0) return;
  vehicle.deleted = true;
  vehicle.row.deleted_at = iso(t);
  vehicle.updated = t;
}

function assignLater({ lead, t }: LeadEvent): void {
  if (lead.assignedTo !== null || lead.deleted) return;
  const seller = pickSales(t);
  if (seller !== null) assign(lead, seller.id, pickAdmin().id, t);
}

function reassign({ lead, t }: LeadEvent): void {
  if (lead.deleted || !isIn(lead.status, ACTIVE)) return;
  const others = salesAt(t).filter((s) => s.id !== lead.assignedTo);
  if (others.length > 0) assign(lead, pick(others).id, pickAdmin().id, t);
}

function staffLeaves({ member, t }: Extract<SimEvent, { kind: 'staff_leaves' }>): void {
  for (const lead of leads) {
    if (lead.assignedTo !== member.id || !isIn(lead.status, ACTIVE) || lead.deleted) continue;
    // Most of their pipeline is handed over within a few days; some is left behind.
    if (chance(0.6)) {
      const at = t + between(4, 96) * HOUR;
      if (at < NOW) schedule({ t: at, kind: 'lead_reassign', lead });
    }
  }
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const queue = new Heap<SimEvent>();
function schedule(event: SimEvent): void {
  queue.push(event);
}

function simulate(): void {
  for (let i = 0; i < VEHICLE_COUNT; i++) schedule({ t: rampedTime(), kind: 'vehicle_create' });
  for (let i = 0; i < LEAD_COUNT; i++) {
    schedule({ t: rampedTime(), kind: 'lead_create', buyerLead: chance(0.1) });
  }
  for (const member of staff) {
    if (member.leftAt !== Infinity) schedule({ t: member.leftAt, kind: 'staff_leaves', member });
  }
  // Early stock so the first leads have something to link.
  for (let i = 0; i < 12; i++)
    schedule({ t: workTime(START + between(0, 4) * DAY), kind: 'vehicle_create' });

  while (queue.size > 0) {
    const event = queue.pop();
    // Plans reach past today; anything after now hasn't happened yet.
    if (event.t > NOW) break;
    switch (event.kind) {
      case 'vehicle_create':
        createVehicle(event.t);
        break;
      case 'lead_create':
        createLead(event.t, event.buyerLead);
        break;
      case 'lead_action':
        leadAction(event);
        break;
      case 'lead_revive':
        reviveLead(event);
        break;
      case 'lead_assign':
        assignLater(event);
        break;
      case 'lead_reassign':
        reassign(event);
        break;
      case 'vehicle_drop':
        dropVehicle(event);
        break;
      case 'vehicle_relist':
        relistVehicle(event);
        break;
      case 'vehicle_delete':
        deleteVehicle(event);
        break;
      case 'staff_leaves':
        staffLeaves(event);
        break;
    }
  }
}

/** Owners who came in but have no vehicle yet, plus one soft-deleted owner. */
function idleOwners(): void {
  for (let i = 0; i < IDLE_OWNER_COUNT; i++) newOwner(rampedTime(), pickAdmin().id);
  const deleted = owners[owners.length - 1];
  if (deleted === undefined) return;
  deleted.deleted_at = iso(Math.min(Date.parse(deleted.created_at) + 2 * DAY, NOW - HOUR));
  deleted.updated_at = deleted.deleted_at;
}

/** Soft-deleted leads (and one contact): duplicates entered by mistake. */
function softDeletes(): void {
  const lost = leads.filter((l) => l.status === 'lost' && l.vehicleId === null && !l.buyerLead);
  for (const lead of sample(lost, 6)) {
    lead.deleted = true;
    lead.row.deleted_at = iso(
      Math.min((lead.updated ?? lead.created) + between(1, 48) * HOUR, NOW - HOUR),
    );
  }
  const solo = leads.find(
    (l) => l.deleted && leads.filter((o) => o.contact === l.contact).length === 1,
  );
  if (solo?.contact && solo.row.deleted_at !== undefined) {
    solo.contact.deleted_at = solo.row.deleted_at;
    solo.contact.updated_at = solo.row.deleted_at;
  }
  // Contacts who later registered as marketplace buyers.
  const merged = contacts.filter((c) => c.deleted_at === null).slice(0, 3);
  merged.forEach((contact, i) => {
    const buyer = buyers[i];
    if (buyer === undefined) return;
    contact.merged_into_user_id = buyer.user_id;
    contact.updated_at = iso(
      Math.min(Math.max(Date.parse(contact.created_at), buyer.createdAt) + DAY, NOW),
    );
  });
}

// ---------------------------------------------------------------------------
// Follow-ups and notifications
// ---------------------------------------------------------------------------

function assigneeAt(lead: SimLead, t: number): string {
  let current: string | null = null;
  for (const a of lead.assignments) if (a.t <= t) current = a.userId;
  return current ?? adminId();
}

function followUp(
  lead: SimLead,
  createdAt: number,
  createdBy: string,
  scheduledAt: number,
): FollowUpRow {
  const task = weighted(TASK_TYPES);
  const fu: FollowUpRow = {
    id: randomUUID(),
    lead_id: lead.id,
    assigned_to: assigneeAt(lead, createdAt),
    task_type: task,
    scheduled_at: iso(scheduledAt),
    completed_at: null,
    notes: chance(0.85) ? pick(TASK_NOTES[task]) : null,
    outcome: null,
    created_by: createdBy,
    created_at: iso(createdAt),
    updated_at: iso(createdAt),
    deleted_at: null,
    completed_by: null,
    cancelled_by: null,
    completion_notes: null,
  };
  rows.follow_ups.push(fu);
  return fu;
}

/** Marks the follow-up completed and returns the completion time (ms). */
function complete(fu: FollowUpRow, t: number, by: string, outcome: Outcome): number {
  fu.completed_at = iso(t);
  fu.completed_by = by;
  fu.outcome = outcome;
  fu.completion_notes = chance(0.85) ? pick(COMPLETION_NOTES[outcome]) : null;
  fu.updated_at = iso(t);
  return Date.parse(fu.completed_at);
}

/** Cancels the follow-up and returns the cancellation time (ms). */
function cancel(fu: FollowUpRow, t: number, by: string): number {
  fu.deleted_at = iso(t);
  fu.cancelled_by = by;
  fu.updated_at = iso(t);
  return Date.parse(fu.deleted_at);
}

function seedFollowUps(): void {
  for (const lead of leads) {
    if (chance(0.12)) continue;
    const active = isIn(lead.status, ACTIVE) && !lead.deleted;
    const end = lead.deleted ? Date.parse(lead.row.deleted_at ?? '') : (lead.endActive ?? Infinity);
    let createdAt = lead.created + between(5, 240) * MINUTE;
    if (createdAt > NOW) createdAt = NOW - MINUTE;
    let createdBy = assigneeAt(lead, createdAt);
    let scheduledAt = afterDays(createdAt, 0.3, 3);
    for (let n = 0; n < 14; n++) {
      if (scheduledAt > NOW) {
        if (!active) break;
        if (chance(0.2)) {
          // Due later today (tomorrow morning when run late at night).
          const soon = NOW + between(30, 240) * MINUTE;
          scheduledAt = dateOnly(soon) === dateOnly(NOW) ? soon : atIST(NOW + DAY, 10, 30);
        }
        if (scheduledAt < NOW + 14 * DAY) followUp(lead, createdAt, createdBy, scheduledAt);
        break;
      }
      const fu = followUp(lead, createdAt, createdBy, scheduledAt);
      const by = fu.assigned_to;
      if (scheduledAt >= end) {
        // The lead closed before this follow-up came due.
        if (chance(0.5)) cancel(fu, end, assigneeAt(lead, end));
        else
          complete(
            fu,
            end,
            assigneeAt(lead, end),
            lead.status === 'converted' ? 'done' : 'not_interested',
          );
        break;
      }
      if (active && NOW - scheduledAt < 21 * DAY && chance(0.3)) break; // left overdue
      if (chance(0.07)) {
        let cancelledAt = cancel(fu, Math.min(scheduledAt - between(1, 20) * HOUR, NOW), by);
        if (cancelledAt < createdAt) {
          fu.deleted_at = fu.updated_at = iso(createdAt + MINUTE);
          cancelledAt = Date.parse(fu.deleted_at);
        }
        if (!chance(0.6)) break;
        createdAt = cancelledAt;
        createdBy = by;
        scheduledAt = afterDays(createdAt, 1, 6);
        continue;
      }
      const doneAt = Math.min(scheduledAt + between(0, 20) * HOUR, end - MINUTE, NOW - MINUTE);
      const outcome = weighted(OUTCOMES);
      const completedAt = complete(fu, Math.max(doneAt, scheduledAt), by, outcome);
      if (outcome === 'not_interested' || !chance(0.75)) break;
      createdAt = completedAt;
      createdBy = by;
      scheduledAt = afterDays(
        createdAt,
        outcome === 'rescheduled' ? 1 : 2,
        outcome === 'rescheduled' ? 3 : 10,
      );
    }
  }
  for (const fu of rows.follow_ups) {
    const closed = fu.completed_at !== null || fu.deleted_at !== null;
    const due = Date.parse(fu.scheduled_at);
    rows.notifications.push({
      user_id: fu.assigned_to,
      type: 'follow_up_due',
      title: 'Follow-up due',
      body: `Follow-up (${fu.task_type}) is scheduled`,
      entity_type: 'follow_up',
      entity_id: fu.id,
      is_read: closed ? true : due < NOW ? chance(0.35) : chance(0.1),
      created_at: fu.created_at,
      due_at: fu.scheduled_at,
    });
  }
}

// ---------------------------------------------------------------------------
// Finance, buyer activity
// ---------------------------------------------------------------------------

function seedFinance(): void {
  const admin = adminId();
  for (const vehicle of vehicles) {
    if (vehicle.deleted) continue;
    const count =
      vehicle.row.acquisition_type === 'dealership_purchase' ? between(1, 3) : between(0, 1);
    let total = 0;
    for (const [category, min, max] of sample(VEHICLE_EXPENSES, count)) {
      const at = Math.min(vehicle.created + between(1, 20) * DAY, NOW - HOUR);
      const amount = roundTo(between(min, max), 100);
      total += amount;
      rows.expenses.push({
        showroom_id: SHOWROOM_ID,
        type: 'vehicle',
        vehicle_id: vehicle.id,
        category,
        amount,
        description: `${category.charAt(0).toUpperCase()}${category.slice(1)} for ${vehicle.row.registration_number}`,
        incurred_on: dateOnly(at),
        recorded_by: admin,
        created_at: iso(at),
        updated_at: iso(at),
        deleted_at: null,
      });
    }
    if (vehicle.financials && vehicle.row.acquisition_type === 'dealership_purchase' && total > 0) {
      vehicle.financials.other_costs = total;
    }

    if (vehicle.status === 'sold') {
      const { soldAt, soldLead } = vehicle;
      if (soldAt === undefined || soldLead === undefined) {
        throw new Error(`Sold vehicle ${vehicle.id} has no sale recorded`);
      }
      const f = vehicle.financials;
      const price = f?.actual_selling_price ?? vehicle.listed;
      const day = dateOnly(soldAt);
      const at = iso(soldAt);
      if (vehicle.row.acquisition_type === 'dealership_purchase') {
        rows.income.push({
          showroom_id: SHOWROOM_ID,
          category: 'vehicle_sale',
          vehicle_id: vehicle.id,
          amount: price,
          description: `Sale of ${vehicle.row.registration_number}`,
          received_on: day,
          recorded_by: admin,
          created_at: at,
          updated_at: at,
          deleted_at: null,
        });
      } else {
        const commission =
          f?.commission_amount ?? roundTo(price * ((f?.commission_percent ?? 2) / 100), 100);
        rows.income.push({
          showroom_id: SHOWROOM_ID,
          category: 'commission',
          vehicle_id: vehicle.id,
          amount: commission,
          description: `Commission on ${vehicle.row.registration_number}`,
          received_on: day,
          recorded_by: admin,
          created_at: at,
          updated_at: at,
          deleted_at: null,
        });
      }
      // Lenders pay out about a week after delivery.
      if (soldLead.row.finance_required && soldAt + 7 * DAY < NOW) {
        rows.income.push({
          showroom_id: SHOWROOM_ID,
          category: 'finance_commission',
          vehicle_id: vehicle.id,
          amount: roundTo(between(8_000, 25_000), 500),
          description: pick([
            'HDFC auto loan payout',
            'ICICI auto loan payout',
            'Bajaj Finance payout',
          ]),
          received_on: dateOnly(soldAt + 7 * DAY),
          recorded_by: admin,
          created_at: at,
          updated_at: at,
          deleted_at: null,
        });
      }
      if (chance(0.4)) {
        rows.income.push({
          showroom_id: SHOWROOM_ID,
          category: 'insurance_commission',
          vehicle_id: vehicle.id,
          amount: roundTo(between(2_500, 9_000), 100),
          description: 'Insurance renewal commission',
          received_on: day,
          recorded_by: admin,
          created_at: at,
          updated_at: at,
          deleted_at: null,
        });
      }
    }
  }

  for (let month = 0; month <= 6; month++) {
    const first = Date.parse(`${dateOnly(START + month * 31 * DAY).slice(0, 7)}-01T04:30:00Z`);
    const entries: [category: string, amount: number, description: string, day: number][] = [
      ['rent', 85_000, 'Showroom rent', 1],
      ['electricity', between(9_000, 16_000), 'BESCOM electricity bill', 6],
      ['internet', 2_499, 'Broadband', 6],
      [
        'marketing',
        roundTo(between(15_000, 45_000), 500),
        pick(['Facebook and Instagram ads', 'OLX and CarDekho listings', 'Newspaper classifieds']),
        10,
      ],
      ['salaries', 30_000 * salesAt(first + 27 * DAY).length + 60_000, 'Staff salaries', 28],
      [
        'maintenance',
        roundTo(between(2_000, 12_000), 100),
        pick(['Showroom cleaning', 'Washing bay repairs', 'Stationery and printing']),
        15,
      ],
    ];
    for (const [category, amount, description, day] of entries) {
      const at = first + (day - 1) * DAY;
      if (at > NOW || at < START) continue;
      rows.expenses.push({
        showroom_id: SHOWROOM_ID,
        type: 'business',
        vehicle_id: null,
        category,
        amount,
        description,
        incurred_on: dateOnly(at),
        recorded_by: adminId(),
        created_at: iso(at),
        updated_at: iso(at),
        deleted_at: null,
      });
    }
    const other = first + between(5, 25) * DAY;
    if (other < NOW && other > START) {
      rows.income.push({
        showroom_id: SHOWROOM_ID,
        category: 'other',
        vehicle_id: null,
        amount: roundTo(between(3_000, 20_000), 100),
        description: pick(['Accessories sale', 'RC transfer service fee', 'Detailing service']),
        received_on: dateOnly(other),
        recorded_by: adminId(),
        created_at: iso(other),
        updated_at: iso(other),
        deleted_at: null,
      });
    }
  }
  // Two duplicate entries that were deleted.
  for (const original of sample(
    rows.expenses.filter((e) => e.type === 'business'),
    2,
  )) {
    rows.expenses.push({ ...original, deleted_at: original.created_at });
  }
}

function seedBuyerActivity(): void {
  for (const buyer of buyers) {
    const seen = vehicles.filter(
      (v) => !v.deleted && v.created < NOW && v.created > buyer.createdAt - 30 * DAY,
    );
    if (seen.length === 0) continue;
    for (const vehicle of sample(seen, between(0, 6))) {
      const at = Math.max(buyer.createdAt, vehicle.created) + between(1, 72) * HOUR;
      rows.saved_vehicles.push({
        buyer_id: buyer.id,
        vehicle_id: vehicle.id,
        saved_at: iso(Math.min(at, NOW)),
      });
    }
    for (let i = between(2, 15); i > 0; i--) {
      const vehicle = pick(seen);
      const at = Math.max(buyer.createdAt, vehicle.created) + between(1, 400) * HOUR;
      rows.recently_viewed.push({
        buyer_id: buyer.id,
        vehicle_id: vehicle.id,
        viewed_at: iso(Math.min(at, NOW)),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Media and documents
// ---------------------------------------------------------------------------

async function preparePhotos(): Promise<Buffer[]> {
  if (!existsSync(photoCacheDir)) {
    throw new Error(`Missing ${photoCacheDir}; run scripts/seed-demo-vehicles.ts once to fill it`);
  }
  await mkdir(photoDir, { recursive: true });
  const files = (await readdir(photoCacheDir)).filter((f) => /\.jpe?g$/i.test(f));
  const photos: Buffer[] = [];
  for (const [i, file] of files.entries()) {
    const out = join(photoDir, `${String(i).padStart(3, '0')}.jpg`);
    if (!existsSync(out)) {
      execFileSync(
        'sips',
        [
          '-Z',
          '1280',
          '-s',
          'format',
          'jpeg',
          '-s',
          'formatOptions',
          '70',
          join(photoCacheDir, file),
          '--out',
          out,
        ],
        { stdio: 'ignore' },
      );
    }
    photos.push(await readFile(out));
  }
  return photos;
}

function pdf(title: string): Buffer {
  const text = title.replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 760 Td (${text}) Tj 0 -28 Td /F1 11 Tf (AutoLead test document - not a real record) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function planMedia(): Upload[] {
  const uploads: Upload[] = [];
  const categories = ['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'engine', 'tyres'];
  for (const vehicle of vehicles) {
    const shape = weighted([
      ['none', 10],
      ['partial', 25],
      ['full', 65],
    ]);
    if (shape === 'none') continue;
    let chosen =
      shape === 'full' ? [...categories] : ['front', ...sample(categories.slice(1), between(2, 4))];
    if (shape === 'partial' && chance(0.15)) chosen = chosen.slice(1); // no front shot
    if (chance(0.2)) chosen.push('other');
    const uploader = pickAdmin().id;
    chosen.forEach((category, sortOrder) => {
      const path = `${vehicle.id}/${randomUUID()}.jpg`;
      const at = Math.min(vehicle.created + between(10, 600) * MINUTE, NOW - MINUTE);
      uploads.push({
        bucket: 'vehicle-media',
        path,
        contentType: 'image/jpeg',
        row: {
          vehicle_id: vehicle.id,
          storage_path: path,
          category: chance(0.04) ? null : category,
          sort_order: sortOrder,
          uploaded_by: uploader,
          uploaded_at: iso(at),
        },
      });
    });
  }
  const docTypes = [
    'rc',
    'insurance',
    'service_record',
    'loan_clearance',
    'inspection_report',
    'other',
  ];
  for (const vehicle of vehicles) {
    if (!chance(0.6)) continue;
    for (const docType of sample(docTypes, between(1, 5))) {
      const path = `${vehicle.id}/${randomUUID()}.pdf`;
      const at = Math.min(vehicle.created + between(30, 4000) * MINUTE, NOW - MINUTE);
      const label = docType.replace('_', '-').toUpperCase();
      uploads.push({
        bucket: 'vehicle-documents',
        path,
        contentType: 'application/pdf',
        title: `${label} - ${vehicle.row.registration_number}`,
        row: {
          vehicle_id: vehicle.id,
          doc_type: chance(0.05) ? null : docType,
          storage_path: path,
          is_sensitive: ['rc', 'insurance', 'loan_clearance'].includes(docType)
            ? true
            : chance(0.3),
          uploaded_by: pickAdmin().id,
          uploaded_at: iso(at),
          file_name: chance(0.1) ? null : `${label}-${vehicle.row.registration_number}.pdf`,
        },
      });
    }
  }
  return uploads;
}

async function runUploads(uploads: Upload[], photos: Buffer[]): Promise<void> {
  const pending = [...uploads];
  let done = 0;
  await Promise.all(
    Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
      for (let job = pending.shift(); job; job = pending.shift()) {
        const body =
          job.bucket === 'vehicle-media'
            ? photos[Math.floor(Math.random() * photos.length)]
            : pdf(job.title);
        if (body === undefined) throw new Error('No photos to upload');
        for (let attempt = 1; ; attempt++) {
          const { error } = await db.storage
            .from(job.bucket)
            .upload(job.path, body, { contentType: job.contentType });
          if (!error) break;
          if (attempt === 3) throw new Error(`upload ${job.bucket}/${job.path}: ${error.message}`);
        }
        if (job.bucket === 'vehicle-media') rows.vehicle_media.push(job.row);
        else rows.vehicle_documents.push(job.row);
        done++;
        if (done % 200 === 0) console.log(`  uploaded ${done}/${uploads.length}`);
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

type InsertBatch<R> = (batch: R[]) => PromiseLike<{ error: { message: string } | null }>;

async function insert<R>(table: string, list: R[], write: InsertBatch<R>): Promise<void> {
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const { error } = await write(list.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${list.length}`);
}

function finaliseRows(): void {
  for (const vehicle of vehicles) {
    rows.vehicles.push({
      id: vehicle.id,
      ...vehicle.row,
      status: vehicle.status,
      sold_lead_id: null,
      updated_at: iso(vehicle.updated ?? vehicle.created),
    });
  }
  for (const lead of leads) {
    if (lead.status === null) throw new Error(`Lead ${lead.id} has no status`);
    rows.leads.push({
      id: lead.id,
      ...lead.row,
      vehicle_id: lead.vehicleId,
      assigned_to: lead.assignedTo,
      status: lead.status,
      deleted_at: lead.row.deleted_at ?? null,
      updated_at: iso(lead.updated ?? lead.created),
    });
  }
}

function tally<T>(list: readonly T[], key: keyof T | ((item: T) => unknown)): string {
  const counts: Record<string, number> = {};
  for (const item of list) {
    const value = String(typeof key === 'function' ? key(item) : item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}=${n}`)
    .join(' ');
}

function printSummary(): void {
  const counts = Object.entries(rows).map(([table, list]) => `${table}=${list.length}`);
  console.log(`  rows: ${counts.join(' ')}`);
  console.log(`  vehicle status: ${tally(vehicles, (v) => (v.deleted ? 'deleted' : v.status))}`);
  console.log(`  vehicle fuel: ${tally(rows.vehicles, 'fuel_type')}`);
  console.log(`  vehicle transmission: ${tally(rows.vehicles, 'transmission')}`);
  console.log(`  acquisition: ${tally(rows.vehicles, 'acquisition_type')}`);
  console.log(
    `  leads per linked vehicle: ${tally(
      vehicles.filter((v) => v.status === 'linked'),
      (v) => activeLeadsOn(v).length,
    )}`,
  );
  console.log(`  lead status: ${tally(leads, (l) => (l.deleted ? 'deleted' : l.status))}`);
  console.log(`  lead source: ${tally(rows.leads, 'source')}`);
  console.log(
    `  lead assignee: ${tally(leads, (l) => staffById(l.assignedTo)?.name ?? 'unassigned')}`,
  );
  console.log(
    `  dropped->open relists: ${rows.vehicle_status_history.filter((h) => h.from_status === 'dropped').length}`,
  );
  console.log(
    `  revived leads: ${rows.lead_status_history.filter((h) => h.from_status === 'vehicle_unavailable').length}`,
  );
  const fuState = (f: FollowUpRow): string => {
    if (f.deleted_at) return 'cancelled';
    if (f.completed_at) return `done:${f.outcome}`;
    const due = Date.parse(f.scheduled_at);
    if (due < NOW) return 'overdue';
    return dateOnly(due) === dateOnly(NOW) ? 'today' : 'upcoming';
  };
  console.log(`  follow-ups: ${tally(rows.follow_ups, fuState)}`);
  console.log(`  follow-up task: ${tally(rows.follow_ups, 'task_type')}`);
  console.log(
    `  notifications: ${tally(rows.notifications, (n) => `${n.type}:${n.is_read ? 'read' : 'unread'}`)}`,
  );
  console.log(`  income: ${tally(rows.income, 'category')}`);
}

async function main(): Promise<void> {
  await assertEmpty();
  console.log('Loading catalog…');
  catalog = await loadCatalog();
  const photos = DRY_RUN ? [] : (console.log('Preparing photos…'), await preparePhotos());

  console.log('Creating logins…');
  await seedStaff();
  await seedBuyersAndOwnerLogins();

  console.log('Simulating six months…');
  simulate();
  idleOwners();
  await linkOwnerLogins();
  softDeletes();
  seedFollowUps();
  seedFinance();
  seedBuyerActivity();
  finaliseRows();
  printSummary();
  if (DRY_RUN) return;

  console.log('Writing rows…');
  await insert('users', rows.users, (b) => db.from('users').insert(b));
  await insert('user_roles', rows.user_roles, (b) => db.from('user_roles').insert(b));
  await insert('owners', rows.owners, (b) => db.from('owners').insert(b));
  await insert('vehicles', rows.vehicles, (b) => db.from('vehicles').insert(b));
  await insert('vehicle_financials', rows.vehicle_financials, (b) =>
    db.from('vehicle_financials').insert(b),
  );
  await insert('vehicle_status_history', rows.vehicle_status_history, (b) =>
    db.from('vehicle_status_history').insert(b),
  );
  await insert('contacts', rows.contacts, (b) => db.from('contacts').insert(b));
  await insert('buyers', rows.buyers, (b) => db.from('buyers').insert(b));
  await insert('buyer_preferences', rows.buyer_preferences, (b) =>
    db.from('buyer_preferences').insert(b),
  );
  await insert('leads', rows.leads, (b) => db.from('leads').insert(b));
  await insert('lead_status_history', rows.lead_status_history, (b) =>
    db.from('lead_status_history').insert(b),
  );
  await insert('audit_logs', rows.audit_logs, (b) => db.from('audit_logs').insert(b));
  for (const vehicle of vehicles.filter((v) => v.soldLeadId !== null)) {
    check(
      await db.from('vehicles').update({ sold_lead_id: vehicle.soldLeadId }).eq('id', vehicle.id),
      'set sold_lead_id',
    );
  }
  console.log(`  vehicles.sold_lead_id: ${vehicles.filter((v) => v.soldLeadId !== null).length}`);
  await insert('follow_ups', rows.follow_ups, (b) => db.from('follow_ups').insert(b));
  await insert('notifications', rows.notifications, (b) => db.from('notifications').insert(b));
  await insert('saved_vehicles', rows.saved_vehicles, (b) => db.from('saved_vehicles').insert(b));
  await insert('recently_viewed', rows.recently_viewed, (b) =>
    db.from('recently_viewed').insert(b),
  );
  await insert('expenses', rows.expenses, (b) => db.from('expenses').insert(b));
  await insert('income', rows.income, (b) => db.from('income').insert(b));

  console.log('Uploading photos and documents…');
  await runUploads(planMedia(), photos);
  await insert('vehicle_media', rows.vehicle_media, (b) => db.from('vehicle_media').insert(b));
  await insert('vehicle_documents', rows.vehicle_documents, (b) =>
    db.from('vehicle_documents').insert(b),
  );

  console.log(`Done. Log in as admin@example.com / ${PASSWORD} (every seeded login uses it).`);
}

run(main);
