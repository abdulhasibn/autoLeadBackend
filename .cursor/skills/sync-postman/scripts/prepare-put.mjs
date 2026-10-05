#!/usr/bin/env node
/**
 * Build a Postman putCollection payload from the backend repo's collection.
 * Usage: node prepare-put.mjs <collectionUid> [path-to-collection.json]
 *   (or set POSTMAN_COLLECTION_UID)
 * Writes: <os tmpdir>/autolead-postman-put.json
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const collectionUid = process.argv[2] ?? process.env.POSTMAN_COLLECTION_UID;
if (!collectionUid) {
  console.error('Pass the cloud collection UID (getCollections → "AutoLead API").');
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(__dir, '../../../../postman/AutoLead-API.postman_collection.json');
const inputPath = resolve(process.argv[3] ?? defaultPath);
const outPath = join(tmpdir(), 'autolead-postman-put.json');

if (!existsSync(inputPath)) {
  console.error(`Collection not found: ${inputPath}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const DROP = new Set(['id', 'uid', '_postman_id', 'createdAt', 'updatedAt', 'createdat', 'lastUpdatedBy']);

function transform(node, markItem) {
  if (Array.isArray(node)) return node.map((n) => transform(n, true));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP.has(k)) continue;
      out[k] = transform(v, k === 'item');
    }
    if (markItem && out.name != null && (out.item != null || out.request != null)) {
      out.id = randomUUID();
    }
    return out;
  }
  return node;
}

const collection = {
  info: { name: raw.info.name, description: raw.info.description, schema: raw.info.schema },
  auth: transform(raw.auth, false),
  event: transform(raw.event, false),
  variable: transform(raw.variable, false),
  item: transform(raw.item, true),
};

const payload = { collectionId: collectionUid, Prefer: 'respond-async', collection };
writeFileSync(outPath, JSON.stringify(payload));
console.log(
  JSON.stringify(
    {
      outPath,
      bytes: Buffer.byteLength(JSON.stringify(payload)),
      folders: collection.item.map((i) => ({
        name: i.name,
        requests: (i.item ?? []).filter((c) => c.request).map((c) => c.name),
      })),
    },
    null,
    2,
  ),
);
