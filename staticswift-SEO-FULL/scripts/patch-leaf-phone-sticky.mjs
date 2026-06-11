#!/usr/bin/env node
/**
 * patch-leaf-phone-sticky.mjs — Phase 1a conversion fixes, estate-wide.
 *
 * 1. Adds a REQUIRED WhatsApp/phone field to every leaf lead form. A UK
 *    tradesperson answers WhatsApp, not email; this was the single biggest
 *    missing conversion lever on the programmatic estate.
 * 2. Adds a sticky mobile CTA bar (WhatsApp + jump-to-form) that hides
 *    while the form is on screen.
 *
 * Idempotent: skips pages that already carry the markers.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'admin', 'node_modules', 'tests', '.git', '.claude', 'staticswift-skill', 'invoice']);

// Inserted directly after the name+email row.
const PHONE_ROW = `<div class="ss-row" data-ss-phone>
<div class="ss-fg"><label>WhatsApp / mobile</label><input type="tel" name="whatsapp" required maxlength="20" placeholder="07700 900000" autocomplete="tel"></div>
</div>`;

const STICKY = `<div class="ss-msticky" id="ss-msticky" data-ss-sticky>
<a class="ss-msticky-wa" href="https://wa.me/447502731799" target="_blank" rel="noopener" aria-label="WhatsApp Harry">WhatsApp</a>
<a class="ss-msticky-go" href="#ss-seo-form">Free preview in 24h &rarr;</a>
</div>
<style>
.ss-msticky{display:none}
@media(max-width:768px){
.ss-msticky{position:fixed;bottom:0;left:0;right:0;z-index:90;display:flex;gap:1px;box-shadow:0 -4px 18px rgba(0,0,0,.18);transition:transform .25s ease}
.ss-msticky.off{transform:translateY(110%)}
.ss-msticky a{flex:1;text-align:center;padding:15px 8px;font:600 15px/1.2 'Outfit',system-ui,sans-serif;text-decoration:none;min-height:44px}
.ss-msticky-wa{background:#1F8B47;color:#fff;flex:0 0 36%}
.ss-msticky-go{background:#0a0a0a;color:#fff}
body{padding-bottom:64px}
}
</style>
<script>
(function(){var bar=document.getElementById('ss-msticky');var f=document.getElementById('ss-seo-form');
if(!bar||!f||!('IntersectionObserver' in window))return;
new IntersectionObserver(function(es){es.forEach(function(e){bar.classList.toggle('off',e.isIntersecting);});},{threshold:.05}).observe(f);
})();
</script>`;

let phoneAdded = 0, stickyAdded = 0, scanned = 0;
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
  const file = join(ROOT, d.name, 'index.html');
  if (!existsSync(file)) continue;
  let html = readFileSync(file, 'utf8');
  if (!html.includes('id="ss-seo-form"')) continue;
  scanned++;
  let changed = false;

  if (!html.includes('data-ss-phone') && !html.includes('name="whatsapp"')) {
    const anchor = 'autocomplete="email"></div>\n</div>';
    if (html.includes(anchor)) {
      html = html.replace(anchor, anchor + '\n' + PHONE_ROW);
      phoneAdded++; changed = true;
    }
  }
  if (!html.includes('data-ss-sticky')) {
    html = html.replace('<script data-ss-tracker>', STICKY + '\n<script data-ss-tracker>');
    if (html.includes('data-ss-sticky')) { stickyAdded++; changed = true; }
  }
  if (changed) writeFileSync(file, html);
}
console.log(`Scanned ${scanned} leaf pages: phone added ${phoneAdded}, sticky added ${stickyAdded}.`);
