#!/usr/bin/env node
/**
 * fix-intl-slugs.mjs — repair malformed URLs on international pages.
 *
 * The international batch inserted the raw city string into URLs, producing
 * canonicals and internal links like
 *   https://staticswift.co.uk/barber-website-design-abbotsford, bc/
 * instead of the real slug
 *   https://staticswift.co.uk/barber-website-design-abbotsford-bc/
 *
 * This rewrites every href / canonical / og:url whose path matches
 * "...-website-design-{something containing ', ' or ' '}" into the slug
 * form (lowercase, ', ' and ' ' -> '-'), only when the slugged target
 * exists on disk. Reports anything it could not resolve.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'admin', 'node_modules', 'tests', '.git', '.claude', 'staticswift-skill']);

const slugify = s => s.toLowerCase().replace(/,\s*/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');

let touched = 0, rewrites = 0;
const unresolved = new Map();

for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
  const file = join(ROOT, d.name, 'index.html');
  if (!existsSync(file)) continue;
  let html = readFileSync(file, 'utf8');
  if (!html.includes('website-design-') || !/website-design-[^"\/]*[, ][^"\/]*\//.test(html)) continue;

  let changed = false;
  html = html.replace(/(href|content)="(https:\/\/staticswift\.co\.uk)?(\/[a-z0-9 -]*website-design-[^"]*?)"/g,
    (whole, attr, origin, path) => {
      if (!/[, ]/.test(path)) return whole;
      const slugged = slugify(path);
      const dir = slugged.replace(/^\//, '').replace(/\/$/, '');
      if (existsSync(join(ROOT, dir, 'index.html'))) {
        changed = true; rewrites++;
        return `${attr}="${origin || ''}${slugged}"`;
      }
      unresolved.set(slugged, (unresolved.get(slugged) || 0) + 1);
      return whole;
    });

  if (changed) { touched++; writeFileSync(file, html); }
}

console.log(`Touched ${touched} pages, rewrote ${rewrites} URLs.`);
if (unresolved.size) {
  console.log(`Unresolved (slugged target missing on disk): ${unresolved.size}`);
  [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([p, n]) => console.log(`  ${n}  ${p}`));
}
