// Loads the make / model / variant catalog from the master data export:
// a directory holding brands.json, models.json and variants.json.
//
// Rows are upserted on source_id (the export's own id), so re-running with a
// newer export updates rows in place instead of duplicating them. Nothing is
// deleted; clear the catalog first if a full replace is wanted.
//
// Mapping:
//   make name = brand name; model and variant name = display_name
//   fuel petrol+cng -> cng_petrol, petrol+lpg -> lpg_petrol, lowercased
//   the model's body_type is copied onto each variant (matching reads it there)
//   empty strings -> null
//
// Usage:
//   pnpm catalog:import <export-dir>

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { check, run, serviceRoleClient } from './lib/supabase';

const BATCH_SIZE = 1000;
const FUEL_TYPES: Readonly<Record<string, string>> = {
  petrol: 'petrol',
  diesel: 'diesel',
  cng: 'cng',
  electric: 'electric',
  hybrid: 'hybrid',
  lpg: 'lpg',
  'petrol+cng': 'cng_petrol',
  'petrol+lpg': 'lpg_petrol',
};
const TRANSMISSIONS: readonly string[] = ['manual', 'automatic', 'amt', 'cvt', 'dct'];

/** Export field values arrive as strings; numbers and nulls show up too. */
type ExportValue = string | number | null | undefined;

interface ExportBrand {
  readonly id: number;
  readonly name: string;
  readonly logo_url?: ExportValue;
}

interface ExportModel {
  readonly id: number;
  readonly brand_id: number;
  readonly display_name: string;
  readonly body_type?: ExportValue;
  readonly segment_type?: ExportValue;
  readonly logo?: ExportValue;
}

interface ExportVariant {
  readonly id: number;
  readonly model_id: number;
  readonly display_name: string;
  readonly fuel_type: ExportValue;
  readonly transmission_type: ExportValue;
  readonly launch_year?: ExportValue;
  readonly discontinued_year?: ExportValue;
}

interface SavedSourceRow {
  readonly id: string;
  readonly source_id: number | null;
}

type UpsertBatch<R> = (
  batch: R[],
) => PromiseLike<{ data: SavedSourceRow[] | null; error: { message: string } | null }>;

function blankToNull(value: ExportValue): string | null {
  return value === '' || value === undefined || value === null ? null : String(value);
}

function year(value: ExportValue): number | null {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function fuelType(value: ExportValue): string {
  const fuel = FUEL_TYPES[String(value).trim().toLowerCase()];
  if (fuel === undefined) {
    throw new Error(`Unknown fuel type "${String(value)}"`);
  }
  return fuel;
}

function transmission(value: ExportValue): string {
  const normalized = String(value).trim().toLowerCase();
  if (!TRANSMISSIONS.includes(normalized)) {
    throw new Error(`Unknown transmission "${String(value)}"`);
  }
  return normalized;
}

/** Looks up a parent id that the consistency check already guaranteed. */
function parentId(ids: ReadonlyMap<number, string>, sourceId: number, what: string): string {
  const id = ids.get(sourceId);
  if (id === undefined) {
    throw new Error(`No ${what} saved for source_id ${sourceId}`);
  }
  return id;
}

async function readJson<T>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), 'utf8')) as T;
}

async function upsertInBatches<R>(
  rows: R[],
  what: string,
  upsert: UpsertBatch<R>,
): Promise<Map<number, string>> {
  const ids = new Map<number, string>();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const saved = check(await upsert(rows.slice(i, i + BATCH_SIZE)), `upsert ${what}`);
    for (const row of saved) {
      if (row.source_id !== null) {
        ids.set(row.source_id, row.id);
      }
    }
    console.log(`  ${what}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  return ids;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: pnpm catalog:import <export-dir>');
    process.exit(1);
  }
  const db = serviceRoleClient();

  const brands = await readJson<ExportBrand[]>(dir, 'brands.json');
  const models = await readJson<ExportModel[]>(dir, 'models.json');
  const variants = await readJson<ExportVariant[]>(dir, 'variants.json');

  // Fail before writing anything if the export is inconsistent.
  const brandIds = new Set(brands.map((b) => b.id));
  const modelsById = new Map(models.map((m) => [m.id, m]));
  const orphanModels = models.filter((m) => !brandIds.has(m.brand_id));
  const orphanVariants = variants.filter((v) => !modelsById.has(v.model_id));
  if (orphanModels.length > 0 || orphanVariants.length > 0) {
    throw new Error(
      `Export has ${orphanModels.length} models and ${orphanVariants.length} variants with unknown parents`,
    );
  }

  const makeIds = await upsertInBatches(
    brands.map((b) => ({ source_id: b.id, name: b.name, logo_url: blankToNull(b.logo_url) })),
    'makes',
    (batch) => db.from('makes').upsert(batch, { onConflict: 'source_id' }).select('id, source_id'),
  );

  const modelIds = await upsertInBatches(
    models.map((m) => ({
      source_id: m.id,
      make_id: parentId(makeIds, m.brand_id, 'make'),
      name: m.display_name,
      body_type: blankToNull(m.body_type),
      segment_type: blankToNull(m.segment_type),
      logo_url: blankToNull(m.logo),
    })),
    'models',
    (batch) => db.from('models').upsert(batch, { onConflict: 'source_id' }).select('id, source_id'),
  );

  await upsertInBatches(
    variants.map((v) => ({
      source_id: v.id,
      model_id: parentId(modelIds, v.model_id, 'model'),
      name: v.display_name,
      fuel_type: fuelType(v.fuel_type),
      transmission: transmission(v.transmission_type),
      body_type: blankToNull(modelsById.get(v.model_id)?.body_type),
      launch_year: year(v.launch_year),
      discontinued_year: year(v.discontinued_year),
    })),
    'variants',
    (batch) =>
      db.from('variants').upsert(batch, { onConflict: 'source_id' }).select('id, source_id'),
  );

  console.log(
    `Imported ${brands.length} makes, ${models.length} models, ${variants.length} variants.`,
  );
}

run(main);
