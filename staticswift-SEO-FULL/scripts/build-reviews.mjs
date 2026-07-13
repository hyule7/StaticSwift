/*
 * build-reviews.mjs — turns REAL reviews into review snippets, honestly.
 *
 * Reads data/reviews.json. If (and only if) it contains genuine reviews, it
 * injects into index.html BOTH:
 *   1. a visible "What clients say" section (Google requires the reviewed
 *      content to be visible on the page), and
 *   2. AggregateRating + Review schema attached to the StaticSwift business
 *      entity (@id .../#business), so Google can show star snippets.
 * With zero reviews it injects nothing. It NEVER invents a rating or count.
 *
 * Add a real review to data/reviews.json like:
 *   { "author": "Dave, Briggs Plumbing", "rating": 5,
 *     "text": "Sorted my site in a day, calls came in that week.",
 *     "date": "2026-06-01" }
 * then run: node scripts/build-reviews.mjs
 *
 * Idempotent: replaces content between the sentinels each run.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://staticswift.co.uk';
const OPEN = '<!-- ss:reviews -->';
const CLOSE = '<!-- /ss:reviews -->';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const data = JSON.parse(readFileSync(join(ROOT, 'data/reviews.json'), 'utf8'));
const items = (data.items || []).filter(r => r && r.author && r.text && Number(r.rating) >= 1 && Number(r.rating) <= 5);

let block = '';
if (items.length) {
  const avg = Math.round((items.reduce((s, r) => s + Number(r.rating), 0) / items.length) * 10) / 10;
  const stars = n => '★★★★★☆☆☆☆☆'.slice(5 - Math.round(n), 10 - Math.round(n));
  const schema = {
    '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': `${SITE}/#business`, name: 'StaticSwift',
    aggregateRating: { '@type': 'AggregateRating', ratingValue: String(avg), reviewCount: String(items.length), bestRating: '5', worstRating: '1' },
    review: items.map(r => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: String(Number(r.rating)), bestRating: '5' }, author: { '@type': 'Person', name: r.author }, reviewBody: r.text, ...(r.date ? { datePublished: r.date } : {}) })),
  };
  const cards = items.map(r => `<figure style="margin:0;background:var(--paper-soft,#F6F3EB);border:1px solid rgba(14,11,7,.1);border-radius:16px;padding:22px"><div style="color:#9C2615;font-size:15px;letter-spacing:2px">${stars(r.rating)}</div><blockquote style="margin:10px 0 12px;font:18px/1.5 'Sentient',Georgia,serif;color:#0E0B07">${esc(r.text)}</blockquote><figcaption style="font-size:13px;color:#5A4E40">${esc(r.author)}</figcaption></figure>`).join('\n      ');
  block = `${OPEN}
  <section class="reviews" aria-label="Client reviews" style="max-width:1080px;margin:0 auto;padding:60px 28px">
    <p style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9C2615;margin-bottom:14px">What clients say · ${avg} out of 5 from ${items.length} review${items.length === 1 ? '' : 's'}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      ${cards}
    </div>
  </section>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  ${CLOSE}`;
}

const file = join(ROOT, 'index.html');
let html = readFileSync(file, 'utf8');

// Compact rating badge in the hero, near the CTA (highest-converting spot).
const HR_OPEN = '<!-- ss:hero-rating -->', HR_CLOSE = '<!-- /ss:hero-rating -->';
let heroBadge = '';
if (items.length) {
  const avg = Math.round((items.reduce((s, r) => s + Number(r.rating), 0) / items.length) * 10) / 10;
  heroBadge = `<div class="hs-rating" style="margin-top:18px;display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--ink)"><span style="color:#9C2615;letter-spacing:2px;font-size:14px">★★★★★</span> Rated ${avg} out of 5 on Google</div>`;
}
{
  const hr = new RegExp(HR_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + HR_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (hr.test(html)) html = html.replace(hr, HR_OPEN + heroBadge + HR_CLOSE);
}
const re = new RegExp(OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
// Always strip any existing block first, then (re)inject at the preferred spot,
// so the section can be added, updated, moved, or cleared cleanly each run.
html = html.replace(new RegExp('\\s*' + re.source), '');
if (block) {
  // Place the proof just BEFORE the footer/colophon (near the decision), else
  // fall back to before </main>.
  if (html.includes('<footer class="colophon"')) html = html.replace('<footer class="colophon"', block + '\n<footer class="colophon"');
  else html = html.replace('</main>', block + '\n</main>');
}
writeFileSync(file, html);
console.log(items.length ? `Injected ${items.length} real reviews (avg ${(items.reduce((s, r) => s + Number(r.rating), 0) / items.length).toFixed(1)}) + schema.` : 'No real reviews yet - nothing injected (correct). Add real reviews to data/reviews.json and re-run.');
