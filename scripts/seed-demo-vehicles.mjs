// Demo data: 50 vehicles, each with its own owner, financials and eight photos
// (front, rear, left, right, interior, dashboard, engine, tyres) uploaded to
// the private vehicle-media bucket.
//
// Photos come from Wikimedia Commons (see scripts/demo-vehicle-photos.json for
// sources and licences). Exterior, dashboard and engine shots match the
// vehicle's model; seats and tyres fall back to a shared pool when Commons has
// nothing model-specific. Downloads are cached in .scratch/demo-vehicle-photos.
//
// Every seeded owner's phone starts with +91984600, which is how --cleanup
// finds them.
//
// Usage:
//   node --env-file=.env scripts/seed-demo-vehicles.mjs
//   node --env-file=.env scripts/seed-demo-vehicles.mjs --cleanup

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const SHOWROOM_ID = 'b0000000-0000-4000-8000-000000000001';
const PHONE_PREFIX = '+91984600';
const BUCKET = 'vehicle-media';
const VEHICLES_PER_MODEL = 5;
const USER_AGENT = 'AutoLeadDemoSeed/1.0 (local demo data loader)';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, '.scratch', 'demo-vehicle-photos');
const manifest = JSON.parse(
  await readFile(join(root, 'scripts', 'demo-vehicle-photos.json'), 'utf8'),
);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Seeded PRNG so runs produce similar-looking data.
let seed = 20261010;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const roundTo = (value, step) => Math.round(value / step) * step;

function check(result, what) {
  if (result.error) {
    throw new Error(`${what}: ${result.error.message}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup() {
  const owners = check(
    await db.from('owners').select('id').like('phone', `${PHONE_PREFIX}%`),
    'list demo owners',
  );
  const ownerIds = owners.map((o) => o.id);
  if (ownerIds.length === 0) {
    console.log('No demo vehicles to remove.');
    return;
  }

  const vehicles = check(
    await db.from('vehicles').select('id').in('owner_id', ownerIds),
    'list demo vehicles',
  );
  const vehicleIds = vehicles.map((v) => v.id);

  if (vehicleIds.length > 0) {
    const media = check(
      await db.from('vehicle_media').select('storage_path').in('vehicle_id', vehicleIds),
      'list demo media',
    );
    const paths = media.map((m) => m.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      check(await db.storage.from(BUCKET).remove(paths.slice(i, i + 100)), 'remove photos');
    }
    // Media, financials and status history cascade with the vehicle.
    check(await db.from('vehicles').delete().in('id', vehicleIds), 'delete demo vehicles');
  }
  check(await db.from('owners').delete().in('id', ownerIds), 'delete demo owners');
  console.log(`Removed ${vehicleIds.length} vehicles and ${ownerIds.length} owners.`);
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cacheFile(name) {
  return join(cacheDir, name.replace(/[^\w.()-]+/g, '_'));
}

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function download(name) {
  const file = cacheFile(name);
  if (await exists(file)) {
    return;
  }
  const { url } = manifest.photos[name];
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      await sleep(250);
      return;
    }
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`Download ${name} failed: HTTP ${res.status}`);
    }
    await sleep(2000 * attempt);
  }
  throw new Error(`Download ${name} failed after retries`);
}

async function downloadAll() {
  await mkdir(cacheDir, { recursive: true });
  const names = Object.keys(manifest.photos);
  let done = 0;
  for (const name of names) {
    await download(name);
    done++;
    if (done % 25 === 0 || done === names.length) {
      console.log(`  photos ${done}/${names.length}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const OWNER_NAMES = [
  'Aditya Rao',
  'Lakshmi Narayan',
  'Sanjay Hegde',
  'Pooja Shetty',
  'Naveen Kumar',
  'Divya Prakash',
  'Ravi Shankar',
  'Shruti Bhat',
  'Manjunath Gowda',
  'Nisha Reddy',
  'Arvind Iyer',
  'Kiran Kamath',
  'Harish Murthy',
  'Swathi Rao',
  'Prakash Jain',
  'Rekha Pillai',
  'Venkatesh Babu',
  'Anjali Menon',
  'Girish Patil',
  'Bhavana Kulkarni',
  'Srinivas Rao',
  'Megha Nair',
  'Ashok Chandra',
  'Ramya Krishnan',
  'Deepak Sharma',
  'Usha Rani',
  'Mahesh Shenoy',
  'Kavitha Suresh',
  'Raghavendra Acharya',
  'Sowmya Gupta',
  'Nikhil Joshi',
  'Pallavi Desai',
  'Santosh Naik',
  'Asha Mathew',
  'Vinay Prabhu',
  'Chitra Ramesh',
  'Gautham Das',
  'Preethi Srinivasan',
  'Anil Fernandes',
  'Sunitha Varma',
  'Rohan Kapoor',
  'Geetha Bhaskar',
  'Imran Pasha',
  'Tejaswini Rao',
  'Yusuf Khan',
  'Smitha Hegde',
  'Pradeep Nayak',
  'Vidya Sagar',
  'Abhishek Kulkarni',
  'Farah Siddiqui',
];
const CITIES = ['Bengaluru', 'Bengaluru', 'Bengaluru', 'Bengaluru', 'Mysuru', 'Hosur', 'Tumakuru'];
const AREAS = [
  'Indiranagar',
  'Koramangala',
  'Jayanagar',
  'Whitefield',
  'HSR Layout',
  'Malleshwaram',
  'Hebbal',
  'Banashankari',
  'Electronic City',
  'Rajajinagar',
  'Yelahanka',
  'BTM Layout',
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
  'Orange',
];
const LOCATIONS = [
  'AutoLead Bengaluru yard',
  'MG Road showroom',
  'Whitefield stockyard',
  'Hebbal parking',
];
const HIGHLIGHTS = [
  'Single owner, company serviced',
  'All service records available',
  'New tyres fitted last month',
  'Insurance renewed recently',
  'Doctor-owned, driven mostly on weekends',
  'Minor scratches on rear bumper',
  'Second set of keys available',
  'Battery replaced in 2026',
  'Original paint, no repaints',
  'Touchscreen infotainment with reverse camera',
];
const DROP_REASONS = ['Owner sold privately', 'Owner withdrew the listing'];

function variantFuel(fuel) {
  if (fuel === 'cng_petrol') return 'cng';
  return ['petrol', 'diesel', 'cng', 'electric', 'hybrid'].includes(fuel) ? fuel : 'petrol';
}

function variantTransmission(transmission) {
  return ['manual', 'automatic', 'amt', 'cvt', 'dct'].includes(transmission)
    ? transmission
    : 'manual';
}

function registrationNumber(used) {
  for (;;) {
    const rto = String(between(1, 53)).padStart(2, '0');
    const series = String.fromCharCode(65 + between(0, 25), 65 + between(0, 25));
    const reg = `KA${rto}${series}${between(1000, 9999)}`;
    if (!used.has(reg)) {
      used.add(reg);
      return reg;
    }
  }
}

function photosFor(model, index) {
  const at = (list, offset = 0) => list[(index + offset) % list.length];
  const side = model.side;
  return [
    ['front', at(model.front)],
    ['rear', at(model.rear)],
    ['left', at(side)],
    ['right', side.length > 1 ? at(side, 1) : at(model.front, 1)],
    ['interior', at(model.interior)],
    ['dashboard', at(model.dashboard)],
    ['engine', at(model.engine)],
    ['tyres', at(model.tyres)],
  ];
}

async function loadVariants(make, model) {
  const rows = check(
    await db
      .from('variants')
      .select(
        'id, name, fuel_type, transmission, ex_showroom_price, models!inner(name, deleted_at, makes!inner(name))',
      )
      .is('deleted_at', null)
      .eq('models.name', model)
      .is('models.deleted_at', null)
      .eq('models.makes.name', make),
    `load ${make} ${model} variants`,
  );
  if (rows.length === 0) {
    throw new Error(`No catalog variants for ${make} ${model}`);
  }
  return rows;
}

async function seedVehicle({ actorId, model, variant, index, ownerName, used, dropped }) {
  const now = new Date();
  const createdAt = new Date(
    now.getTime() - between(1, 75) * 86_400_000 - between(0, 86_399) * 1000,
  );
  const year = between(model.years[0], model.years[1]);
  const age = now.getFullYear() - year;
  const city = pick(CITIES);
  const acquisition = pick([
    'dealership_purchase',
    'consignment',
    'consignment',
    'intermediary_sale',
  ]);
  const loanActive = rand() < 0.15;

  const ownerId = randomUUID();
  const first = ownerName.split(' ')[0].toLowerCase();
  check(
    await db.from('owners').insert({
      id: ownerId,
      full_name: ownerName,
      phone: `${PHONE_PREFIX}${String(1000 + index).padStart(4, '0')}`,
      email: rand() < 0.7 ? `${first}.${index + 1}@example.com` : null,
      address: `${between(1, 240)}, ${pick(AREAS)}`,
      city,
      preferred_contact_method: pick(['phone', 'whatsapp', 'whatsapp', 'email']),
      notes: rand() < 0.3 ? 'Prefers calls after 6 pm.' : null,
      created_by: actorId,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    }),
    'insert owner',
  );

  const vehicleId = randomUUID();
  const status = dropped ? 'dropped' : 'open';
  const insuranceUntil = new Date(now.getTime() + between(-30, 330) * 86_400_000);
  check(
    await db.rpc('save_vehicle', {
      p_id: vehicleId,
      p_showroom_id: SHOWROOM_ID,
      p_owner_id: ownerId,
      p_variant_id: variant.id,
      p_year: year,
      p_registration_number: registrationNumber(used),
      p_fuel_type: variantFuel(variant.fuel_type),
      p_transmission: variantTransmission(variant.transmission),
      p_km_driven: roundTo(Math.max(3000, age * between(7000, 14000)), 500),
      p_num_previous_owners: age <= 3 ? 1 : between(1, 3),
      p_colour: pick(COLOURS),
      p_insurance_valid_until: insuranceUntil.toISOString().slice(0, 10),
      p_rc_status: loanActive ? 'hypothecation' : 'clear',
      p_service_history: pick(['full', 'full', 'partial', 'unknown']),
      p_accident_history: rand() < 0.1,
      p_loan_status: loanActive ? 'active' : 'clear',
      p_location: pick(LOCATIONS),
      p_description: `${pick(HIGHLIGHTS)}. ${pick(HIGHLIGHTS)}.`,
      p_status: status,
      p_acquisition_type: acquisition,
      p_submitted_by: actorId,
      p_deleted_at: null,
      p_actor_id: actorId,
      p_reason: dropped ? pick(DROP_REASONS) : null,
      p_sold_lead_id: null,
    }),
    'save vehicle',
  );

  const newPrice = Number(variant.ex_showroom_price ?? 800000);
  const listed = roundTo(newPrice * Math.max(0.35, 1 - 0.09 * age), 5000);
  check(
    await db.from('vehicle_financials').insert({
      vehicle_id: vehicleId,
      owner_expected_price: roundTo(listed * 0.95, 5000),
      company_purchase_price:
        acquisition === 'dealership_purchase' ? roundTo(listed * 0.88, 5000) : null,
      expected_selling_price: listed,
      minimum_selling_price: roundTo(listed * 0.94, 5000),
      listed_price: listed,
      commission_percent: acquisition === 'dealership_purchase' ? null : 2,
    }),
    'insert financials',
  );

  // Backdate so the inventory shows a spread of days in stock.
  check(
    await db
      .from('vehicles')
      .update({ created_at: createdAt.toISOString(), updated_at: createdAt.toISOString() })
      .eq('id', vehicleId),
    'backdate vehicle',
  );
  check(
    await db
      .from('vehicle_status_history')
      .update({ changed_at: createdAt.toISOString() })
      .eq('vehicle_id', vehicleId),
    'backdate status history',
  );

  const media = [];
  for (const [sortOrder, [category, name]] of photosFor(model, index).entries()) {
    const storagePath = `${vehicleId}/${randomUUID()}.jpg`;
    const body = await readFile(cacheFile(name));
    check(
      await db.storage.from(BUCKET).upload(storagePath, body, { contentType: 'image/jpeg' }),
      `upload ${category} photo`,
    );
    media.push({
      vehicle_id: vehicleId,
      storage_path: storagePath,
      category,
      sort_order: sortOrder,
      uploaded_by: actorId,
      uploaded_at: createdAt.toISOString(),
    });
  }
  check(await db.from('vehicle_media').insert(media), 'insert media');
}

async function seedAll() {
  const existing = check(
    await db
      .from('owners')
      .select('id', { count: 'exact' })
      .like('phone', `${PHONE_PREFIX}%`)
      .limit(1),
    'check existing demo owners',
  );
  if (existing.length > 0) {
    throw new Error('Demo vehicles already seeded; run with --cleanup first.');
  }

  const actor = check(
    await db
      .from('users')
      .select('id')
      .is('deleted_at', null)
      .order('created_at')
      .limit(1)
      .single(),
    'find actor user',
  );

  const used = new Set(
    check(await db.from('vehicles').select('registration_number'), 'list registrations').map(
      (v) => v.registration_number,
    ),
  );

  console.log('Downloading photos…');
  await downloadAll();

  console.log('Seeding vehicles…');
  const jobs = [];
  let index = 0;
  for (const model of manifest.models) {
    const variants = await loadVariants(model.make, model.model);
    for (let i = 0; i < VEHICLES_PER_MODEL; i++) {
      jobs.push({
        actorId: actor.id,
        model,
        variant: pick(variants),
        index,
        ownerName: OWNER_NAMES[index],
        used,
        // Every eleventh vehicle is dropped so that filter has something too.
        dropped: index % 11 === 10,
      });
      index++;
    }
  }

  const queue = [...jobs];
  let done = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await seedVehicle(job);
        done++;
        console.log(
          `  ${done}/${jobs.length} ${job.model.make} ${job.model.model} (${job.variant.name})`,
        );
      }
    }),
  );
  console.log(`Seeded ${jobs.length} vehicles with ${jobs.length * 8} photos.`);
}

if (process.argv.includes('--cleanup')) {
  await cleanup();
} else {
  await seedAll();
}
