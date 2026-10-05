#!/usr/bin/env node
/**
 * Audit the AutoLead Postman collection for request Docs + Examples coverage.
 * Usage: node audit-docs-examples.mjs [path-to-collection.json]
 * Default: postman/AutoLead-API.postman_collection.json (backend repo).
 * Exit 0 if pass, 1 if gaps.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
// scripts → sync-postman → skills → .cursor → repo root
const defaultPath = resolve(__dir, '../../../../postman/AutoLead-API.postman_collection.json');
const inputPath = resolve(process.argv[2] ?? defaultPath);

if (!existsSync(inputPath)) {
  console.error(`Collection not found: ${inputPath}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const gaps = [];

const text = (d) => (typeof d === 'string' ? d : (d?.content ?? ''));

function walk(items, folder = '') {
  for (const it of items ?? []) {
    if (it.item && !it.request) {
      walk(it.item, folder ? `${folder}/${it.name}` : it.name);
      continue;
    }
    if (!it.request) continue;

    const path = folder ? `${folder} / ${it.name}` : it.name;
    const desc = text(it.request.description);
    const examples = it.response ?? [];
    const method = (it.request.method ?? '').toUpperCase();

    if (!folder) gaps.push({ path, kind: 'structure', detail: 'request at collection root' });

    if (!desc.trim()) {
      gaps.push({ path, kind: 'docs', detail: 'empty description' });
    } else if (!desc.startsWith('**Story:**')) {
      gaps.push({ path, kind: 'docs', detail: 'missing **Story:** blurb at start of description' });
    } else if (desc.includes('|---|') || desc.includes('| --- |')) {
      gaps.push({ path, kind: 'docs', detail: 'markdown table (|---|) — use bullet lists' });
    } else if (desc.length < 120) {
      gaps.push({ path, kind: 'docs', detail: `description too thin (${desc.length} chars)` });
    }

    if (examples.length === 0) {
      gaps.push({ path, kind: 'examples', detail: 'no saved Examples' });
      continue;
    }
    const isNegative = folder.includes('Negative');
    const isNoContent = examples.every((e) => e.code === 204 || e.code === 302);
    const mutating = ['POST', 'PATCH', 'PUT'].includes(method);
    const hasSuccess = examples.some((e) => e.code >= 200 && e.code < 300);
    const hasError = examples.some((e) => e.code >= 400);

    if (!isNegative && !isNoContent && mutating && hasSuccess && !hasError) {
      gaps.push({ path, kind: 'examples', detail: 'mutating request missing error Example' });
    }
    if (!isNegative && !hasSuccess) {
      gaps.push({ path, kind: 'examples', detail: 'missing success Example' });
    }
  }
}

walk(raw.item ?? []);

const count = (k) => gaps.filter((g) => g.kind === k).length;
console.log(
  JSON.stringify(
    {
      collection: inputPath,
      gapCount: gaps.length,
      structureGaps: count('structure'),
      docsGaps: count('docs'),
      exampleGaps: count('examples'),
      gaps,
    },
    null,
    2,
  ),
);
process.exit(gaps.length === 0 ? 0 : 1);
