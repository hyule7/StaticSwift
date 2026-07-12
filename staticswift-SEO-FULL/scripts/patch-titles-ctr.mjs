/*
 * patch-titles-ctr.mjs — one conservative, mechanical CTR fix across the estate.
 *
 * The programmatic pages led their <title> with the brand
 *   "StaticSwift &mdash; {Trade} Website Design in {City} (£499, free 24h preview)"
 * so Google showed the brand first and buried the keyword the person searched.
 * This reorders to keyword-first and moves the brand to the end:
 *   "{Trade} Website Design in {City} (£499, free 24h preview) | StaticSwift"
 * which is standard CTR best practice, and removes the em dash (house rule).
 *
 * TITLE ONLY. No URL, canonical, heading, body, description or schema changes.
 * Idempotent: only matches the old brand-first pattern, so re-running is a no-op.
 * Run: node scripts/patch-titles-ctr.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'admin', 'client', 'guides', 'docs', 'scripts', 'tests', 'netlify']);
const RE = /<title>StaticSwift &mdash; (.+?)<\/title>/;

function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (SKIP.has(d.name)) continue; yield* walk(join(dir, d.name)); }
    else if (d.name === 'index.html') yield join(dir, d.name);
  }
}

let patched = 0, scanned = 0;
for (const file of walk(ROOT)) {
  scanned++;
  const html = readFileSync(file, 'utf8');
  const m = html.match(RE);
  if (!m) continue;
  const next = html.replace(RE, `<title>${m[1]} | StaticSwift</title>`);
  if (next !== html) { writeFileSync(file, next); patched++; }
}
console.log(`Scanned ${scanned} pages; patched ${patched} titles keyword-first.`);
