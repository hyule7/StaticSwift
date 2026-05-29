#!/usr/bin/env node
/* eslint-disable */
/*
 * generate-seo-pages.js
 * ---------------------------------------------------------------
 * Generates NEW programmatic-SEO landing pages by cloning a template
 * page and substituting niche + location tokens. Worldwide-ready.
 *
 * - Reads niche + location data from ./seo-data.js
 * - Template: barber-website-design-bromley/ (existing premium page)
 * - Output folder pattern: {niche-slug}-website-design-{location-slug}
 * - Idempotent: skips folders that already exist (won't overwrite)
 * - Appends new URLs to sitemap.xml (creates one if missing)
 *
 * Usage:
 *   node scripts/generate-seo-pages.js                # dry-run, default scope
 *   node scripts/generate-seo-pages.js --apply        # write files
 *   node scripts/generate-seo-pages.js --apply --scope=uk        # UK extras only
 *   node scripts/generate-seo-pages.js --apply --scope=world     # international only
 *   node scripts/generate-seo-pages.js --apply --scope=all       # both
 *   node scripts/generate-seo-pages.js --apply --limit=200       # cap output
 *   node scripts/generate-seo-pages.js --apply --niche=barber    # one niche only
 *
 * Scale guidance:
 *   - Generating 100k pages in one git commit will choke Netlify.
 *   - Run in batches of 1k–5k, push, deploy, repeat.
 *   - Or use --niche=X to ship verticals separately.
 */

const fs = require('fs');
const path = require('path');
const { NICHES, UK_LOCATIONS_EXTRA, UK_LOCATIONS_BIG, INTERNATIONAL_LOCATIONS, INTERNATIONAL_BIG, prettyLocation } = require('./seo-data');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const FLAG = (k) => ARGS.includes('--' + k);
const VAL  = (k) => { const a = ARGS.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };

const APPLY  = FLAG('apply');
const DRY    = !APPLY;
const SCOPE  = VAL('scope') || 'all'; // 'uk' | 'world' | 'all'
const LIMIT  = parseInt(VAL('limit') || '200', 10);
const ONLY_NICHE = VAL('niche');

const TEMPLATE_DIR = path.join(ROOT, 'barber-website-design-bromley');
const TEMPLATE_NICHE = { slug: 'barber', trade: 'Barbers & Hair Salons', tradeLc: 'barber', noun: 'barber shop' };
const TEMPLATE_LOC_SLUG = 'bromley';
const TEMPLATE_LOC_NAME = 'Bromley';

function loadTemplate() {
  const p = path.join(TEMPLATE_DIR, 'index.html');
  if (!fs.existsSync(p)) {
    console.error('[generate] template not found:', p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

/*
 * The template uses lots of variant casings. We do targeted token swaps
 * to avoid butchering structural HTML. Order matters: longest first.
 *
 * Returns the new HTML.
 */
function renderPage(template, niche, locSlug, locName) {
  let html = template;

  // === LOCATION SWAPS ===
  // Pretty cases first
  html = html.replaceAll(TEMPLATE_LOC_NAME, locName);
  html = html.replaceAll(TEMPLATE_LOC_NAME.toLowerCase(), locName.toLowerCase());
  html = html.replaceAll(TEMPLATE_LOC_NAME.toUpperCase(), locName.toUpperCase());
  // Slug in URLs / breadcrumb anchors
  html = html.replaceAll(`-${TEMPLATE_LOC_SLUG}/`, `-${locSlug}/`);
  html = html.replaceAll(`-${TEMPLATE_LOC_SLUG}"`, `-${locSlug}"`);

  // === NICHE SWAPS ===
  // Trade phrase (longest first)
  html = html.replaceAll(TEMPLATE_NICHE.trade, niche.trade);
  html = html.replaceAll(TEMPLATE_NICHE.trade.toLowerCase(), niche.trade.toLowerCase());
  // Lowercase singular "barber" / "barbers"
  html = html.replaceAll('Barbers', niche.trade.split(' ')[0]); // "Plumbers"
  html = html.replaceAll('barbers', niche.tradeLc + 's');
  html = html.replaceAll('Barber', niche.tradeLc.charAt(0).toUpperCase() + niche.tradeLc.slice(1));
  html = html.replaceAll('barber', niche.tradeLc);
  // Hair Salon legacy from compound trade phrase
  html = html.replaceAll('Hair Salons', '');
  html = html.replaceAll('hair salons', '');
  html = html.replaceAll('Hair Salon', '');
  html = html.replaceAll('hair salon', '');
  // Niche slug in URLs/canonical/breadcrumb
  html = html.replaceAll(`/${TEMPLATE_NICHE.slug}-website-design-`, `/${niche.slug}-website-design-`);
  html = html.replaceAll(`"${TEMPLATE_NICHE.slug}-website-design-`, `"${niche.slug}-website-design-`);

  // === Tidy "& " left over from killed "Hair Salons" ===
  html = html.replaceAll(' &  ', ' ');
  html = html.replaceAll(' & ,', ',');
  html = html.replaceAll(' &  Website', ' Website');
  html = html.replaceAll('  ', ' ');

  return html;
}

function buildJobList() {
  const niches = ONLY_NICHE ? NICHES.filter(n => n.slug === ONLY_NICHE) : NICHES;
  if (!niches.length) { console.error('[generate] no niches matched filter'); process.exit(1); }
  const locations = [];
  if (SCOPE === 'uk' || SCOPE === 'all') locations.push(...UK_LOCATIONS_EXTRA, ...UK_LOCATIONS_BIG);
  if (SCOPE === 'world' || SCOPE === 'all') locations.push(...INTERNATIONAL_LOCATIONS, ...INTERNATIONAL_BIG);
  // De-dupe while preserving order
  const seen = new Set();
  const unique = locations.filter(l => seen.has(l) ? false : seen.add(l));
  locations.length = 0; locations.push(...unique);
  const jobs = [];
  for (const niche of niches) {
    for (const locSlug of locations) {
      const folder = `${niche.slug}-website-design-${locSlug}`;
      const dest = path.join(ROOT, folder);
      if (fs.existsSync(dest)) continue; // skip existing
      jobs.push({ niche, locSlug, locName: prettyLocation(locSlug), folder, dest });
      if (jobs.length >= LIMIT) return jobs;
    }
  }
  return jobs;
}

function appendToSitemap(urls) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.warn('[generate] sitemap.xml not found — skipping sitemap update.');
    return;
  }
  const current = fs.readFileSync(sitemapPath, 'utf8');
  if (!current.includes('</urlset>')) {
    console.warn('[generate] sitemap.xml missing </urlset> — skipping sitemap update.');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const additions = urls.map(u => `  <url><loc>https://staticswift.co.uk/${u}/</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>`).join('\n');
  if (additions) {
    const next = current.replace('</urlset>', additions + '\n</urlset>');
    fs.writeFileSync(sitemapPath, next, 'utf8');
    console.log(`[generate] sitemap.xml updated with ${urls.length} new URLs`);
  }
}

function main() {
  const template = loadTemplate();
  const jobs = buildJobList();
  console.log(`[generate] mode: ${DRY ? 'DRY-RUN' : 'APPLY'} · scope: ${SCOPE} · niche-filter: ${ONLY_NICHE || 'all'} · cap: ${LIMIT}`);
  console.log(`[generate] new pages queued: ${jobs.length}`);
  if (!jobs.length) { console.log('[generate] nothing to do.'); return; }
  console.log(`[generate] preview (first 5):`);
  jobs.slice(0, 5).forEach(j => console.log(`  → ${j.folder}  ·  ${j.niche.trade} in ${j.locName}`));
  if (DRY) {
    console.log(`\n[generate] DRY-RUN — pass --apply to write ${jobs.length} folders.`);
    return;
  }
  const writtenUrls = [];
  for (const job of jobs) {
    try {
      fs.mkdirSync(job.dest, { recursive: true });
      const html = renderPage(template, job.niche, job.locSlug, job.locName);
      fs.writeFileSync(path.join(job.dest, 'index.html'), html, 'utf8');
      writtenUrls.push(job.folder);
    } catch (err) {
      console.error(`[generate] failed ${job.folder}:`, err.message);
    }
  }
  console.log(`[generate] wrote ${writtenUrls.length} pages`);
  appendToSitemap(writtenUrls);
}

main();
