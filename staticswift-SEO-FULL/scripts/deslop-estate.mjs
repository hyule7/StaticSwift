/*
 * deslop-estate.mjs — remove the two clearest "AI slop" patterns from the
 * programmatic estate, surgically, without touching the good human copy.
 *
 * Google's helpful-content / scaled-content systems demote mass-templated
 * pages. The two tells across the estate are:
 *   1. A keyword-stuffed geo sentence: "{Town} sits in {County}, and the firms
 *      that win its work are the ones a {County} postcode search can actually
 *      find." (town/county repeated for ranking, identical skeleton everywhere)
 *   2. A templated filler stat: ", N trades served on this page alone".
 *
 * We strip exactly those, leaving the genuine offer/guarantee/story copy. Fully
 * idempotent (re-running changes nothing) and safe: no prices, no URLs, no
 * headings touched. Run: node scripts/deslop-estate.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const SKIP = new Set(['node_modules', '.git', 'admin', 'client', 'scripts', 'data', 'tests', 'generator', '_template-preview', 'invoice']);

// 1. The keyword-stuffed geo sentence (leading space kept off the result).
const GEO = / [A-Z][^.<]*? sits in [^.<]*? postcode search can actually find\./g;
// 2. The templated trade-count stat.
const TRADES = /, \d+ trades? served on this page alone/g;

function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (SKIP.has(d.name)) continue; yield* walk(join(dir, d.name)); }
    else if (d.name === 'index.html') yield join(dir, d.name);
  }
}

let scanned = 0, changed = 0, geoHits = 0, tradeHits = 0;
for (const file of walk(ROOT)) {
  scanned++;
  const html = readFileSync(file, 'utf8');
  const g = (html.match(GEO) || []).length;
  const t = (html.match(TRADES) || []).length;
  if (!g && !t) continue;
  const next = html.replace(GEO, '').replace(TRADES, '');
  if (next !== html) {
    geoHits += g; tradeHits += t; changed++;
    if (!DRY) writeFileSync(file, next);
  }
}
console.log(`${DRY ? '[dry] ' : ''}Scanned ${scanned} pages; de-slopped ${changed} (geo sentences: ${geoHits}, trade-count stats: ${tradeHits}).`);
