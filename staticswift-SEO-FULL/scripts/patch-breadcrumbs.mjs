/*
 * patch-breadcrumbs.mjs — adds BreadcrumbList structured data to every estate
 * page (leaf trade-and-town, city hub, trade root). Breadcrumbs help Google
 * understand the site hierarchy and can show a breadcrumb trail in results
 * instead of a raw URL, which lifts click-through.
 *
 * Injects a JSON-LD <script> only (no visible layout change, no risk to the
 * design). Idempotent: skips any page that already has a BreadcrumbList.
 * URLs in the trail always point to pages that actually exist on disk.
 * Run: node scripts/patch-breadcrumbs.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://staticswift.co.uk';
const SKIP = new Set(['node_modules', '.git', 'admin', 'client', 'guides', 'docs', 'scripts', 'tests', 'netlify']);
const titleCase = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (SKIP.has(d.name)) continue; yield* walk(join(dir, d.name)); }
    else if (d.name === 'index.html') yield join(dir, d.name);
  }
}

// Build the breadcrumb items for a page folder, or null if not an estate page.
function crumbsFor(folder, html) {
  const cityFrom = () => (html.match(/"addressLocality":"([^"]+)"/) || [])[1];
  const tradeFrom = () => (html.match(/<title>(.+?) Website Design/i) || [])[1];
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }];

  if (folder.includes('-website-design-')) {              // leaf: {trade}-website-design-{city}
    const [tradeSlug, citySlug] = folder.split('-website-design-');
    const city = cityFrom() || titleCase(citySlug);
    const trade = (tradeFrom() || titleCase(tradeSlug)).replace(/s$/, '');
    let pos = 2;
    if (existsSync(join(ROOT, 'website-design-' + citySlug))) {
      items.push({ '@type': 'ListItem', position: pos++, name: 'Website design in ' + city, item: `${SITE}/website-design-${citySlug}/` });
    }
    items.push({ '@type': 'ListItem', position: pos, name: `${trade} website design in ${city}`, item: `${SITE}/${folder}/` });
    return items;
  }
  if (/^website-design-.+/.test(folder)) {                 // city hub: website-design-{city}
    const city = cityFrom() || titleCase(folder.replace(/^website-design-/, ''));
    items.push({ '@type': 'ListItem', position: 2, name: 'Website design in ' + city, item: `${SITE}/${folder}/` });
    return items;
  }
  if (/-website-design$/.test(folder)) {                   // trade root: {trade}-website-design
    const trade = tradeFrom() || titleCase(folder.replace(/-website-design$/, ''));
    items.push({ '@type': 'ListItem', position: 2, name: `${trade} website design`, item: `${SITE}/${folder}/` });
    return items;
  }
  return null;
}

let patched = 0, scanned = 0;
for (const file of walk(ROOT)) {
  scanned++;
  const folder = basename(dirname(file));
  const html = readFileSync(file, 'utf8');
  if (/BreadcrumbList/.test(html)) continue;               // already has one
  const items = crumbsFor(folder, html);
  if (!items || items.length < 2) continue;
  const schema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
  const tag = `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`;
  if (!html.includes('</head>')) continue;
  writeFileSync(file, html.replace('</head>', tag));
  patched++;
}
console.log(`Scanned ${scanned} pages; added breadcrumbs to ${patched}.`);
