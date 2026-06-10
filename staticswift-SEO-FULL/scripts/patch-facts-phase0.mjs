#!/usr/bin/env node
/**
 * patch-facts-phase0.mjs
 * Phase 0 mechanical-truth sweep across the programmatic estate.
 *
 * 1. Adds method="post" action="/.netlify/functions/handle-intake" to the
 *    leaf lead form so a JS failure falls back to a real POST instead of a
 *    GET that leaks PII into the URL.
 * 2. Corrects every claim that contradicts data/facts.json:
 *    preview in 24h (not delivery), five-page Starter (not single-page),
 *    optional £49/mo (not "no monthly fees"), no £29 hosting add-on,
 *    live within 14 days (not "receive your files").
 *
 * Dry run: node scripts/patch-facts-phase0.mjs --dry
 * Apply:   node scripts/patch-facts-phase0.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DRY = process.argv.includes('--dry');

// Literal replacements, applied with split/join (no regex surprises).
// Order matters: more specific strings first.
const RULES = [
  // Form fallback. The leaf form has no method/action today, so default GET-to-self.
  ['<form class="ss-form" id="ss-seo-form" data-source=',
   '<form class="ss-form" id="ss-seo-form" method="post" action="/.netlify/functions/handle-intake" data-source='],

  // Hero subtitle: delivery claim + "no monthly fees" lie in one line.
  ['Custom-designed, mobile-ready, delivered in 24 hours. One-time payment. No monthly fees. You own it forever.',
   'Custom-designed, mobile-ready, free preview in 24 hours. £499 once, optional £49/mo managed plan. You own it forever.'],

  // Trust bar pills.
  ['<span class="tb">24-hour delivery</span>', '<span class="tb">24-hour preview</span>'],
  ['<span class="tb">No monthly fees</span>', '<span class="tb">You own it forever</span>'],

  // Pricing card: Starter is five pages, and the preview is what lands in 24h.
  ['<li>Custom single-page design</li>', '<li>Five pages, custom-designed</li>'],
  ['<li>24-hour delivery</li>', '<li>Free preview in 24 hours</li>'],
  ['"pdesc">Single-page site for', '"pdesc">Five-page site for'],

  // Process step 3: nobody "receives files"; the site goes live.
  ['Pay once and receive your files. One free revision included. Yours forever.',
   'Pay £499 once and your site goes live within 14 days. One free revision included. Yours forever.'],

  // FAQ: the £29 hosting add-on does not exist.
  ['The optional £29 hosting add-on means we set it all up for you.',
   'We set it all up for you as part of the build.'],

  // Body copy delivery claims.
  ['StaticSwift builds it in 24 hours.', 'StaticSwift gets a free preview in front of you within 24 hours.'],

  // JSON-LD schema: same lies in structured data. Google reads these.
  [', delivered in 24 hours from £499.', ', free preview in 24 hours, from £499.'],
  ['"description": "Custom single-page ', '"description": "Custom five-page '],
  [' website, 24h delivery"', ' website, free preview in 24 hours"'],
  ['"name": "Advanced", "price": "999"', '"name": "Pro", "price": "999"'],
  [', {"@type": "Offer", "name": "Hosting", "price": "29", "priceCurrency": "GBP", "description": "Upload, domain connection, free Netlify hosting + SSL", "url": "https://staticswift.co.uk/order.html"}',
   ''],

  // International template variant: same lie, different sentence.
  ['One-time payment. No monthly fees. Yours forever.', '£499 once, optional £49/mo managed plan. Yours forever.'],

  // 212-page FAQ variant: a previous blind replace garbled the cost answer and
  // left £149/£299/"Advanced"/"No monthly fees ever" in the visible FAQ + schema.
  ['start from £499. Optional £49/mo if you want me to manage it as a one-time payment. The Advanced package is £299. Both include mobile-responsive design, SEO optimisation, and free support. No monthly fees ever.',
   'start from £499 as a one-time payment. The Pro package is £999. Both include mobile-responsive design, SEO optimisation, and free support. An optional £49/mo managed plan is available if you want it run for you.'],
  ['start from \\u00a3149 as a one-time payment. The Advanced package is \\u00a3299. Both include mobile-responsive design, SEO optimisation, and free support. No monthly fees ever.',
   'start from \\u00a3499 as a one-time payment. The Pro package is \\u00a3999. Both include mobile-responsive design, SEO optimisation, and free support. An optional \\u00a349/mo managed plan is available if you want it run for you.'],

  // Analytics: lead value still reports the retired £149 price.
  ["gtag('event','generate_lead',{value:149,", "gtag('event','generate_lead',{value:499,"],

  // Org schema blurb, capital D variant.
  ['Delivered in 24 hours from £499.', 'Free preview in 24 hours, from £499.'],
  ['Delivered in 24 hours from \\u00a3499.', 'Free preview in 24 hours, from \\u00a3499.'],

  // Title tags: "(£499, 24h delivery)" suffix. Keyword pattern unchanged.
  ['(&pound;499, 24h delivery)', '(&pound;499, free 24h preview)'],
  ['(£499, 24h delivery)', '(£499, free 24h preview)'],

  // Hub pages: same delivery claim in hero-sub and meta description.
  ['Custom-built, mobile-ready, delivered in 24 hours.', 'Custom-built, mobile-ready, free preview in 24 hours.'],
  ['Mobile-ready, delivered in 24 hours.', 'Mobile-ready, free preview in 24 hours.'],
];

const counts = new Map(RULES.map(([from]) => [from, 0]));
let filesTouched = 0, filesScanned = 0;

const entries = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') &&
    !['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'admin', 'node_modules', 'tests', 'invoice', 'staticswift-skill'].includes(d.name));

for (const dir of entries) {
  const file = join(ROOT, dir.name, 'index.html');
  if (!existsSync(file)) continue;
  filesScanned++;
  let html = readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of RULES) {
    if (html.includes(from)) {
      counts.set(from, counts.get(from) + html.split(from).length - 1);
      html = html.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    filesTouched++;
    if (!DRY) writeFileSync(file, html);
  }
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Scanned ${filesScanned} pages, ${DRY ? 'would touch' : 'patched'} ${filesTouched}.`);
for (const [from, n] of counts) console.log(`  ${String(n).padStart(7)}  ${from.slice(0, 72)}`);
