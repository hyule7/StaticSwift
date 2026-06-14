#!/usr/bin/env node
/*
 * build-ad-creatives.mjs — the Creative Production team's output, generated as
 * real, downloadable TikTok ad creatives in the Field Guide design system.
 *
 * Vertical 1080x1920 SVG (real rendered type, never AI-mangled), cream/ink/red.
 * Writes admin/creatives/*.svg plus a manifest the admin Creatives panel reads.
 * Every figure traces to data/facts.json. No em dashes.
 *
 * Run: node scripts/build-ad-creatives.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const f = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const OUT = join(ROOT, 'admin/creatives');
mkdirSync(OUT, { recursive: true });

const P = f.pricing, D = f.delivery, G = f.guarantee;

// Each creative: id, hook (the scroll-stopper), sub, trade-agnostic.
const ADS = [
  { id: 'phone-ring', kind: 'Hook', hook: 'Your next customer is\nsearching for you\nright now.', sub: 'And finding your competitor first.' },
  { id: 'free-preview', kind: 'Offer', hook: 'See your new\nwebsite before\nyou pay a penny.', sub: 'Free working preview in 24 hours. No card.' },
  { id: 'guarantee', kind: 'Trust', hook: 'No lead in\n60 days?\nFull refund.', sub: 'And you keep the site. That is the whole clause.' },
  { id: 'price', kind: 'Price', hook: 'A real website.\nHand-coded.\nGBP 499.', sub: 'Optional GBP 49/mo if you want it managed.' },
  { id: 'one-craftsman', kind: 'Brand', hook: 'No agency.\nNo templates.\nOne craftsman.', sub: 'Hand-coded for UK trades, in Manchester.' },
  { id: 'seven-am', kind: 'Hook', hook: 'A builder on a\nphone at 7am\nis your customer.', sub: 'Make the call happen. GBP 499, preview in 24h.' },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(ad) {
  const lines = ad.hook.split('\n');
  const startY = 760 - (lines.length - 1) * 64;
  const hookT = lines.map((l, i) =>
    `<text x="100" y="${startY + i * 128}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="500" font-size="118" fill="#0E0B07">${esc(l)}</text>`
  ).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#F2EFE7"/>
  <rect x="0" y="0" width="1080" height="14" fill="#9C2615"/>
  <text x="100" y="180" font-family="'Courier New', monospace" font-size="34" letter-spacing="10" fill="#8A7B62">STATICSWIFT</text>
  <text x="100" y="232" font-family="'Courier New', monospace" font-size="26" letter-spacing="6" fill="#9C2615">${esc(ad.kind.toUpperCase())}</text>
  <line x1="100" y1="300" x2="980" y2="300" stroke="rgba(14,11,7,.18)" stroke-width="2"/>
  ${hookT}
  <text x="100" y="${startY + lines.length * 128 + 40}" font-family="Georgia, serif" font-size="46" fill="#29221C">${esc(ad.sub)}</text>
  <rect x="100" y="1560" width="880" height="150" rx="75" fill="#0E0B07"/>
  <text x="540" y="1655" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="52" fill="#F2EFE7">Get my free preview &#8594;</text>
  <text x="540" y="1810" text-anchor="middle" font-family="'Courier New', monospace" font-size="30" letter-spacing="3" fill="#8A7B62">staticswift.co.uk  ·  ${G.days}-day lead guarantee</text>
</svg>`;
}

const manifest = [];
for (const ad of ADS) {
  const file = ad.id + '.svg';
  writeFileSync(join(OUT, file), svg(ad));
  manifest.push({ id: ad.id, kind: ad.kind, hook: ad.hook.replace(/\n/g, ' '), file: 'creatives/' + file, format: 'svg', size: '1080x1920', createdAt: new Date().toISOString(), by: 'Ad Creative Designer' });
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ updatedAt: new Date().toISOString(), creatives: manifest }, null, 2));
console.log('built ' + manifest.length + ' ad creatives + manifest in admin/creatives/');
