#!/usr/bin/env node
/**
 * crawl-audit.mjs — full-estate integrity audit, run against the built tree.
 *
 * Checks: broken internal links, redirect coverage, orphans (sitemap vs
 * linked vs on disk), canonical presence/correctness, duplicate titles and
 * metas, missing schema, missing alt text, mixed content.
 *
 * Output: docs/audit/crawl-report.md  (plus exit 1 if broken internals > 0)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = 'https://staticswift.co.uk';
const SKIP_DIRS = new Set(['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'node_modules', 'tests', '.git', '.claude', 'staticswift-skill']);

// ── collect pages on disk ────────────────────────────────────────────────
const diskPages = new Map(); // urlPath -> file
function addPage(urlPath, file) { diskPages.set(urlPath, file); }
for (const f of readdirSync(ROOT)) {
  if (f.endsWith('.html')) addPage('/' + f, join(ROOT, f));
}
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
  const f = join(ROOT, d.name, 'index.html');
  if (existsSync(f)) addPage('/' + d.name + '/', f);
}
addPage('/', join(ROOT, 'index.html'));

// ── redirects ────────────────────────────────────────────────────────────
const redirects = new Map();
if (existsSync(join(ROOT, '_redirects'))) {
  for (const line of readFileSync(join(ROOT, '_redirects'), 'utf8').split('\n')) {
    const m = line.trim().split(/\s+/);
    if (m.length >= 2 && m[0].startsWith('/')) redirects.set(m[0].replace(/\/$/, ''), m[1]);
  }
}

// ── sitemap urls ─────────────────────────────────────────────────────────
const sitemapUrls = new Set();
for (const f of readdirSync(ROOT).filter(f => f.startsWith('sitemap') && f.endsWith('.xml'))) {
  const xml = readFileSync(join(ROOT, f), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = m[1].trim();
    if (u.endsWith('.xml')) continue;
    try { sitemapUrls.add(new URL(u).pathname); } catch {}
  }
}

// ── helpers ──────────────────────────────────────────────────────────────
const norm = p => {
  try { p = decodeURIComponent(p); } catch {}
  p = p.split('#')[0].split('?')[0];
  return p;
};
const resolves = p => {
  p = norm(p);
  if (!p || !p.startsWith('/')) return true;
  if (diskPages.has(p) || diskPages.has(p.replace(/\/$/, '') + '/')) return true;
  if (p.endsWith('/') && diskPages.has(p.slice(0, -1) + '.html')) return true;
  if (!p.endsWith('/') && (diskPages.has(p + '/') || diskPages.has(p + '.html'))) return true;
  if (redirects.has(p.replace(/\/$/, ''))) return true;
  if (p.startsWith('/.netlify/') || p.startsWith('/images/') || p.startsWith('/admin')) {
    return p.startsWith('/.netlify/') || existsSync(join(ROOT, p));
  }
  return existsSync(join(ROOT, p));
};

// ── scan ─────────────────────────────────────────────────────────────────
const brokenLinks = new Map();   // target -> [sources]
const linkedPaths = new Set();
const titles = new Map();        // title -> count
const metas = new Map();
const issues = { noCanonical: [], wrongCanonical: [], noTitle: [], noMeta: [], noSchema: [], mixedContent: [], extLinks: new Set() };
let imgTotal = 0, imgNoAlt = 0, scanned = 0;

for (const [urlPath, file] of diskPages) {
  scanned++;
  const html = readFileSync(file, 'utf8');

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim();
  if (!title) issues.noTitle.push(urlPath);
  else titles.set(title, (titles.get(title) || 0) + 1);

  const meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!meta) issues.noMeta.push(urlPath);
  else metas.set(meta, (metas.get(meta) || 0) + 1);

  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (!canon) issues.noCanonical.push(urlPath);
  else {
    const cp = new URL(canon, SITE).pathname;
    if (cp !== urlPath && cp !== urlPath.replace(/\/$/, '') && cp.replace(/\/$/, '/') !== urlPath) {
      issues.wrongCanonical.push(`${urlPath} -> ${canon}`);
    }
  }

  if (!html.includes('application/ld+json')) issues.noSchema.push(urlPath);
  if (/src="http:\/\//.test(html) || /href="http:\/\/(?!www\.w3\.org)/.test(html)) issues.mixedContent.push(urlPath);

  for (const m of html.matchAll(/<img\b[^>]*>/g)) { imgTotal++; if (!/\balt=/.test(m[0])) imgNoAlt++; }

  for (const m of html.matchAll(/(?:href|action)="([^"]+)"/g)) {
    let href = m[1];
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (href.startsWith('http')) {
      let u; try { u = new URL(href); } catch { continue; }
      if (u.hostname === 'staticswift.co.uk' || u.hostname === 'www.staticswift.co.uk') href = u.pathname;
      else { issues.extLinks.add(u.origin); continue; }
    }
    if (!href.startsWith('/')) continue;
    linkedPaths.add(norm(href));
    if (!resolves(href)) {
      const k = norm(href);
      if (!brokenLinks.has(k)) brokenLinks.set(k, []);
      if (brokenLinks.get(k).length < 5) brokenLinks.get(k).push(urlPath);
    }
  }
}

// ── orphans ──────────────────────────────────────────────────────────────
const inSitemapNotDisk = [...sitemapUrls].filter(p => !resolves(p));
const onDiskNotSitemap = [...diskPages.keys()].filter(p => !sitemapUrls.has(p) && !p.startsWith('/admin') && p !== '/thanks.html' && p !== '/404.html' && p !== '/gone.html');
const onDiskNotLinked = [...diskPages.keys()].filter(p => !linkedPaths.has(p) && p !== '/');

// ── report ───────────────────────────────────────────────────────────────
const dupTitles = [...titles].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
const dupMetas = [...metas].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
const lines = [];
lines.push('# Crawl Audit Report', '', `Generated ${new Date().toISOString()} against the local built tree (${scanned} pages).`, '');
lines.push('## Headline', '');
lines.push(`- Pages on disk: ${scanned}`);
lines.push(`- URLs in sitemaps: ${sitemapUrls.size}`);
lines.push(`- Broken internal links: ${brokenLinks.size} unique targets`);
lines.push(`- Sitemap URLs that do not resolve on disk: ${inSitemapNotDisk.length}`);
lines.push(`- Pages on disk missing from sitemaps: ${onDiskNotSitemap.length}`);
lines.push(`- Pages on disk never linked internally: ${onDiskNotLinked.length}`);
lines.push(`- Missing canonical: ${issues.noCanonical.length} · wrong canonical: ${issues.wrongCanonical.length}`);
lines.push(`- Missing title: ${issues.noTitle.length} · duplicate titles: ${dupTitles.length}`);
lines.push(`- Missing meta description: ${issues.noMeta.length} · duplicate metas: ${dupMetas.length}`);
lines.push(`- Pages without JSON-LD schema: ${issues.noSchema.length}`);
lines.push(`- Mixed content (http:// resources): ${issues.mixedContent.length}`);
lines.push(`- Images: ${imgTotal} total, ${imgNoAlt} missing alt`);
lines.push(`- Unique external link origins: ${issues.extLinks.size}`);
lines.push('');
const section = (h, arr, max = 40) => { lines.push(`## ${h}`, ''); if (!arr.length) lines.push('None.', ''); else { arr.slice(0, max).forEach(x => lines.push('- ' + (Array.isArray(x) ? `${x[0]} (${x[1]})` : x))); if (arr.length > max) lines.push(`- ...and ${arr.length - max} more`); lines.push(''); } };
section('Broken internal links', [...brokenLinks].map(([t, srcs]) => `\`${t}\` from ${srcs.join(', ')}`));
section('Sitemap URLs not on disk', inSitemapNotDisk);
section('On disk, missing from sitemaps', onDiskNotSitemap, 60);
section('On disk, never internally linked', onDiskNotLinked, 60);
section('Wrong canonicals', issues.wrongCanonical);
section('Duplicate titles (top)', dupTitles.map(([t, n]) => [`"${t.slice(0, 90)}"`, n]), 20);
section('Pages missing schema', issues.noSchema, 20);
section('Mixed content', issues.mixedContent, 20);
section('External origins', [...issues.extLinks].sort(), 60);

mkdirSync(join(ROOT, 'docs/audit'), { recursive: true });
writeFileSync(join(ROOT, 'docs/audit/crawl-report.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log(`\nFull report: docs/audit/crawl-report.md`);
process.exit(brokenLinks.size > 0 ? 1 : 0);
