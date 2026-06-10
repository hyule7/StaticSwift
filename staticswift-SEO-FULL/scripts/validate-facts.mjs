#!/usr/bin/env node
/**
 * validate-facts.mjs — CI gate for the single source of truth.
 *
 * Crawls every built page and fails (exit 1) if any page contains a price,
 * timeframe or guarantee claim that contradicts data/facts.json, or any
 * claim from the retired pricing era.
 *
 * Run before every deploy:  node scripts/validate-facts.mjs
 * Scope to a few pages:     node scripts/validate-facts.mjs index.html order.html
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));

// Strings that must never appear on a published page. Each entry: [pattern, why].
const BANNED = [
  [/24h delivery/i, 'delivery claim: only the PREVIEW is 24h (facts.delivery)'],
  [/delivered in 24 hours/i, 'delivery claim: only the PREVIEW is 24h (facts.delivery)'],
  [/No monthly fees/i, 'the £49/mo managed plan exists; "no monthly fees" is false'],
  [/Custom single-page/i, 'Starter is a five-page site (facts.pricing.starter.pages)'],
  [/Single-page site for/i, 'Starter is a five-page site'],
  [/Advanced package/i, 'retired package name; current names are Starter and Pro'],
  [/"name": "Advanced"/, 'retired package name in schema'],
  [/£29 hosting/i, 'retired £29 hosting add-on does not exist'],
  [/£149 as a one-time payment/, 'retired Starter £149 price'],
  [/£871/, 'stale Launchpad figure; bundle total is £' + facts.pricing.launchpad_bundle.total],
  [/receive your files\. One free revision/i, 'retired delivery model wording'],
  [/Established MMXXV</, 'establishment year is ' + facts.positioning.established_roman],
  [/value:149,/, 'lead value must report the current Starter price'],
];

// Launchpad arithmetic must hold before we even scan.
const addonsSum = Object.values(facts.pricing.addons).reduce((a, b) => a + b, 0);
const expectTotal = facts.pricing.starter.build + addonsSum - facts.pricing.launchpad_bundle.discount;
if (expectTotal !== facts.pricing.launchpad_bundle.total) {
  console.error(`facts.json inconsistent: starter+addons-discount = ${expectTotal}, but launchpad_bundle.total = ${facts.pricing.launchpad_bundle.total}`);
  process.exit(1);
}

const SKIP_DIRS = new Set(['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'admin', 'node_modules', 'tests', '.git', '.claude', 'staticswift-skill']);

function* pages() {
  const argPages = process.argv.slice(2);
  if (argPages.length) { for (const p of argPages) yield join(ROOT, p); return; }
  for (const f of ['index.html', 'order.html', 'thanks.html', 'locations.html', 'niches.html', '404.html', 'client-portal.html']) {
    if (existsSync(join(ROOT, f))) yield join(ROOT, f);
  }
  for (const d of readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
    const f = join(ROOT, d.name, 'index.html');
    if (existsSync(f)) yield f;
  }
}

let scanned = 0, failures = 0;
for (const file of pages()) {
  scanned++;
  const html = readFileSync(file, 'utf8');
  for (const [re, why] of BANNED) {
    if (re.test(html)) {
      failures++;
      console.error(`FAIL ${file.replace(ROOT, '')}: /${re.source}/ — ${why}`);
      break; // one failure per page is enough to fix it
    }
  }
}

if (failures) {
  console.error(`\nvalidate-facts: ${failures} of ${scanned} pages contradict data/facts.json. Deploy blocked.`);
  process.exit(1);
}
console.log(`validate-facts: ${scanned} pages clean against data/facts.json.`);
