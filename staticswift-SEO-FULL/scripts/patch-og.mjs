/*
 * patch-og.mjs — adds the social share image + Twitter card to every page that
 * lacks them, so links to the site (WhatsApp, Facebook, X, LinkedIn, iMessage)
 * show the branded 1200x630 card instead of a blank/broken preview. Trades
 * share on WhatsApp, so this lifts the click-through of every shared link.
 *
 * Adds og:image + twitter:card + twitter:image only where missing. Idempotent.
 * Run: node scripts/patch-og.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = 'https://staticswift.co.uk/og-image.jpg';
const SKIP = new Set(['node_modules', '.git', 'admin', 'client', '_template-preview', 'invoice']);

function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (SKIP.has(d.name)) continue; yield* walk(join(dir, d.name)); }
    else if (d.name === 'index.html') yield join(dir, d.name);
  }
}

let patched = 0, scanned = 0;
for (const file of walk(ROOT)) {
  scanned++;
  let html = readFileSync(file, 'utf8');
  if (!/<head[\s>]/i.test(html) || !html.includes('</head>')) continue;
  if (/noindex/.test(html)) continue;                       // do not bother with noindex pages
  let add = '';
  if (!/property="og:image"/.test(html)) add += `<meta property="og:image" content="${IMG}">\n`;
  if (!/name="twitter:card"/.test(html)) add += `<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${IMG}">\n`;
  if (!add) continue;
  writeFileSync(file, html.replace('</head>', add + '</head>'));
  patched++;
}
console.log(`Scanned ${scanned} pages; added share image/Twitter card to ${patched}.`);
