#!/usr/bin/env node
/* eslint-disable */
/*
 * patch-seo-pages.js
 * ---------------------------------------------------------------
 * Patches every programmatic-SEO landing page in this repo so that:
 *   1. The hero CTA is replaced with an inline 4-field lead-capture
 *      form that POSTs to /.netlify/functions/handle-intake.
 *   2. Every "#contact" CTA is rewritten to point at /order.html
 *      with the niche + city pre-filled via query string.
 *   3. The GA4 (G-4BZHQMG0RF) gtag tag is injected if missing.
 *   4. Form submissions fire a `generate_lead` event and CTA
 *      clicks fire a `cta_click` event.
 *
 * Folder pattern: {niche}-website-design-{city}
 *   - Niches are a whitelisted set (multi-word like "personal-trainer" allowed).
 *   - Cities can be multi-word (everything after `-website-design-`).
 *   - Anything that does not match is skipped and logged.
 *
 * Idempotency: a sentinel comment <!-- ss:seo-form-v1 --> marks
 * pages that have already been patched. Re-running the script is
 * safe.
 *
 * Usage:
 *   node scripts/patch-seo-pages.js              # dry-run (5 folders)
 *   node scripts/patch-seo-pages.js --dry-run    # explicit dry-run
 *   node scripts/patch-seo-pages.js --apply      # write changes
 *   node scripts/patch-seo-pages.js --apply --verbose
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGS = new Set(process.argv.slice(2));
const APPLY = ARGS.has('--apply');
const DRY = !APPLY;
const VERBOSE = ARGS.has('--verbose');
const SENTINEL = '<!-- ss:seo-form-v1 -->';

// ---------------------------------------------------------------
// 1. Niche whitelist + display names
// ---------------------------------------------------------------
// Keys are the slug used in folder names. Values are the display
// labels shown in the hero <select>. Order roughly follows the
// existing order.html option list, then extras alphabetically.
const NICHES = {
  'accountant':            'Accountant',
  'architect':             'Architect',
  'barber':                'Barber / Hair Salon',
  'bakery':                'Bakery',
  'beauty-salon':          'Beauty / Nail Bar',
  'blacksmith':            'Blacksmith',
  'builder':               'Builder / Roofer',
  'butcher':               'Butcher',
  'cafe':                  'Cafe / Restaurant',
  'cake-maker':            'Cake Maker',
  'carpenter':             'Carpenter',
  'carpet-cleaner':        'Carpet Cleaner',
  'caterer':               'Caterer',
  'chiropractor':          'Chiropractor',
  'childminder':           'Childminder',
  'cleaner':               'Cleaner',
  'cleaning-company':      'Cleaning Company',
  'coach':                 'Coach',
  'consultant':            'Consultant',
  'counsellor':            'Counsellor',
  'dentist':               'Dentist',
  'detailer':              'Car Detailer',
  'dj':                    'DJ / Entertainer',
  'dog-groomer':           'Dog Groomer',
  'dog-walker':            'Dog Walker',
  'driving-instructor':    'Driving Instructor',
  'dry-cleaner':           'Dry Cleaner',
  'electrician':           'Electrician',
  'estate-agent':          'Estate Agent',
  'event-planner':         'Event Planner',
  'farrier':               'Farrier',
  'financial-advisor':     'Financial Advisor',
  'florist':               'Florist',
  'food-truck':            'Food Truck',
  'gardener':              'Gardener / Landscaper',
  'glazier':               'Glazier',
  'graphic-designer':      'Graphic Designer',
  'gym':                   'Gym',
  'hairdresser':           'Hairdresser',
  'handyman':              'Handyman',
  'jeweller':              'Jeweller',
  'joiner':                'Joiner',
  'landscaper':            'Landscaper',
  'laundrette':            'Laundrette',
  'locksmith':             'Locksmith',
  'massage':               'Massage Therapist',
  'mechanic':              'Mechanic',
  'mobile-hairdresser':    'Mobile Hairdresser',
  'mortgage-broker':       'Mortgage Broker',
  'mover':                 'Removals / Mover',
  'music-teacher':         'Music Teacher',
  'nail-salon':            'Nail Salon',
  'nursery':               'Nursery / Pre-school',
  'nutritionist':          'Nutritionist',
  'optician':              'Optician',
  'osteopath':             'Osteopath',
  'painter-decorator':     'Painter & Decorator',
  'personal-trainer':      'Personal Trainer',
  'pest-control':          'Pest Control',
  'photographer':          'Photographer',
  'physio':                'Physiotherapist',
  'physiotherapist':       'Physiotherapist',
  'pilates-instructor':    'Pilates Instructor',
  'plasterer':             'Plasterer',
  'plumber':               'Plumber',
  'podiatrist':            'Podiatrist',
  'printer':               'Printer',
  'pub':                   'Pub / Bar',
  'removals':              'Removals',
  'restaurant':            'Restaurant',
  'retail':                'Retail / Shop',
  'roofer':                'Roofer',
  'scaffolder':            'Scaffolder',
  'seamstress':            'Seamstress / Tailor',
  'shoe-repair':           'Shoe Repair',
  'skip-hire':             'Skip Hire',
  'solicitor':             'Solicitor',
  'tailor':                'Tailor',
  'tattoo-studio':         'Tattoo Studio',
  'taxi':                  'Taxi',
  'therapist':             'Therapist',
  'tiler':                 'Tiler',
  'tree-surgeon':          'Tree Surgeon',
  'tutor':                 'Tutor',
  'upholsterer':           'Upholsterer',
  'vet':                   'Vet',
  'videographer':          'Videographer',
  'web-designer':          'Web Designer',
  'wedding-planner':       'Wedding Planner',
  'window-cleaner':        'Window Cleaner',
  'yoga-studio':           'Yoga Studio',
  'yoga-instructor':       'Yoga Instructor',
};

// Sort niches longest-first so prefix matching prefers
// "personal-trainer" over "trainer", "mobile-hairdresser" over "hairdresser".
const NICHE_KEYS = Object.keys(NICHES).sort((a, b) => b.length - a.length);

function parseFolder(folderName) {
  // Folder must contain "-website-design-" with a city after it.
  const marker = '-website-design-';
  const idx = folderName.indexOf(marker);
  if (idx === -1) return null;
  const nichePart = folderName.slice(0, idx);
  const cityPart = folderName.slice(idx + marker.length);
  if (!cityPart) return null;
  // Match niche against whitelist (exact equality, longest-first).
  const niche = NICHE_KEYS.find(k => k === nichePart);
  if (!niche) return null;
  return { niche, citySlug: cityPart };
}

function titleCaseFromSlug(slug) {
  // "stoke-on-trent" -> "Stoke-on-Trent". Connector words stay lowercase.
  const small = new Set(['on', 'in', 'upon', 'under', 'super', 'next', 'le', 'la', 'of', 'by', 'the']);
  return slug.split('-').map((w, i) => {
    if (i > 0 && small.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('-');
}

// ---------------------------------------------------------------
// 2. HTML helpers (regex-based — these pages are deterministic
//    template output so regex is safe and faster than parsing).
// ---------------------------------------------------------------

const GTAG_SCRIPT = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-4BZHQMG0RF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-4BZHQMG0RF');</script>`;

function buildFormCss() {
  // Inline CSS that piggybacks on the page's existing CSS vars.
  return `<style>
.ss-form{max-width:520px;margin:24px auto 0;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:left}
.ss-form-h{font-family:'Instrument Serif',serif;font-size:22px;letter-spacing:-.02em;margin-bottom:6px;color:var(--ink);text-align:center}
.ss-form-h em{font-style:italic;color:var(--gold)}
.ss-form-sub{font-size:13px;color:var(--muted);text-align:center;margin-bottom:18px;line-height:1.5}
.ss-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.ss-fg{display:flex;flex-direction:column;margin-bottom:10px}
.ss-fg label{font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.ss-fg input,.ss-fg select{width:100%;background:#fff;border:1px solid var(--border);border-radius:10px;padding:11px 13px;font-size:13px;color:var(--ink);font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s}
.ss-fg input:focus,.ss-fg select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(176,138,62,.08)}
.ss-fg select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9a9a' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:34px}
.ss-submit{display:block;width:100%;background:var(--ink);color:#fff;border:none;font-family:'Outfit',sans-serif;font-weight:600;font-size:15px;padding:14px;border-radius:100px;cursor:pointer;transition:all .25s;margin-top:6px}
.ss-submit:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 10px 24px rgba(0,0,0,.12)}
.ss-submit:disabled{opacity:.6;cursor:wait;transform:none}
.ss-foot{font-size:11px;color:var(--dim);text-align:center;margin-top:10px}
.ss-ok{display:none;background:rgba(22,163,74,.07);border:1px solid rgba(22,163,74,.25);border-radius:12px;padding:18px;text-align:center;color:var(--green);font-size:14px;font-weight:500;margin-top:14px}
.ss-err{display:none;font-size:12px;color:var(--red);text-align:center;margin-top:8px}
@media(max-width:600px){.ss-row{grid-template-columns:1fr}.ss-form{padding:20px;margin-top:18px}}
</style>`;
}

function buildOptionsHtml(activeNiche) {
  let html = '';
  for (const key of Object.keys(NICHES).sort((a, b) => NICHES[a].localeCompare(NICHES[b]))) {
    const sel = key === activeNiche ? ' selected' : '';
    html += `<option value="${key}"${sel}>${escapeHtml(NICHES[key])}</option>`;
  }
  // Always include "Other" as a fallback.
  html += `<option value="other"${activeNiche === 'other' ? ' selected' : ''}>Other</option>`;
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFormHtml({ niche, citySlug, cityLabel }) {
  const source = `seo-${niche}-${citySlug}`;
  const options = buildOptionsHtml(niche);
  // Single-line(ish) HTML block. Sentinel comment first so we can detect it cheaply.
  return `${SENTINEL}
<form class="ss-form" id="ss-seo-form" method="post" action="/.netlify/functions/handle-intake" data-source="${source}" novalidate>
<div class="ss-form-h">Free preview in <em>24 hours.</em></div>
<div class="ss-form-sub">Tell us where to send it. No payment until you love it.</div>
<div class="ss-row">
<div class="ss-fg"><label>Your name</label><input type="text" name="name" required maxlength="60" placeholder="e.g. Sarah Jones" autocomplete="name"></div>
<div class="ss-fg"><label>Email</label><input type="email" name="delivery_email" required maxlength="100" placeholder="you@email.com" autocomplete="email"></div>
</div>
<div class="ss-row" data-ss-phone>
<div class="ss-fg"><label>WhatsApp / mobile</label><input type="tel" name="whatsapp" required maxlength="20" placeholder="07700 900000" autocomplete="tel"></div>
</div>
<div class="ss-row">
<div class="ss-fg"><label>Business type</label><select name="business_type" required>${options}</select></div>
<div class="ss-fg"><label>Town / city</label><input type="text" name="location" required maxlength="60" value="${escapeHtml(cityLabel)}" placeholder="e.g. Manchester" autocomplete="address-level2"></div>
</div>
<input type="text" name="bot-field" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
<button type="submit" class="ss-submit">Get my free preview &rarr;</button>
<div class="ss-foot">No card needed. We reply within 24 hours.</div>
<div class="ss-err" id="ss-seo-err">Something went wrong &mdash; please try again or email hello@staticswift.co.uk.</div>
<div class="ss-ok" id="ss-seo-ok">&#10003; Thanks &mdash; preview lands in your inbox within 24h.</div>
</form>
<script>
(function(){
  var f=document.getElementById('ss-seo-form');if(!f)return;
  var src=f.dataset.source||'';
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    var bot=f.querySelector('[name="bot-field"]');if(bot&&bot.value)return;
    var btn=f.querySelector('.ss-submit');var ok=document.getElementById('ss-seo-ok');var er=document.getElementById('ss-seo-err');
    er.style.display='none';btn.disabled=true;var orig=btn.innerHTML;btn.innerHTML='Sending&hellip;';
    var fd=new FormData(f);var data={};fd.forEach(function(v,k){if(k!=='bot-field')data[k]=v;});
    data.source=src;data.stage='new-lead';data.createdAt=new Date().toISOString();
    try{
      var r=await fetch('/.netlify/functions/handle-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      var j=await r.json().catch(function(){return{ok:r.ok};});
      if(r.ok&&j&&j.ok!==false){
        f.querySelectorAll('input,select,button').forEach(function(el){el.style.display='none';});
        f.querySelector('.ss-form-h').style.display='none';
        f.querySelector('.ss-form-sub').style.display='none';
        f.querySelector('.ss-foot').style.display='none';
        ok.style.display='block';
        try{if(typeof gtag==='function')gtag('event','generate_lead',{value:499,currency:'GBP',source:src,business_type:data.business_type,location:data.location});}catch(e){}
        try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_submit',form_id:'seo_hero',source:src});}catch(e){}
      }else{er.style.display='block';btn.disabled=false;btn.innerHTML=orig;}
    }catch(err){er.style.display='block';btn.disabled=false;btn.innerHTML=orig;}
  });
})();
</script>`;
}

function buildCtaTrackerScript() {
  // Single global click handler script wired up to any anchor with data-cta-from.
  return `<script>
(function(){
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[data-cta-from]');
    if(!a)return;
    var from=a.getAttribute('data-cta-from')||'';
    var parts=from.replace(/^seo-/,'').split('-');
    var niche=parts.shift()||'';var city=parts.join('-');
    try{if(typeof gtag==='function')gtag('event','cta_click',{cta_label:'seo_primary',source:from,niche:niche,city:city});}catch(e){}
  },{passive:true});
})();
</script>`;
}

// ---------------------------------------------------------------
// 3. Per-file patcher
// ---------------------------------------------------------------

function patchPage(html, { niche, citySlug, cityLabel }) {
  if (html.includes(SENTINEL)) {
    return { skipped: 'already-patched', html };
  }

  let changed = false;
  let out = html;

  // ---- 3a. Inject gtag tag if missing.
  if (!out.includes('G-4BZHQMG0RF')) {
    out = out.replace('</head>', `${GTAG_SCRIPT}\n</head>`);
    changed = true;
  }

  // ---- 3b. Inject form CSS once (in <head>).
  if (!out.includes('.ss-form{')) {
    out = out.replace('</head>', `${buildFormCss()}\n</head>`);
    changed = true;
  }

  // ---- 3c. Rewrite hero CTA -> form.
  // Match the hero CTA anchor (class hero-cta, pointing at #contact).
  const formHtml = buildFormHtml({ niche, citySlug, cityLabel });
  const heroCtaRe = /<a\s+href="[^"]*#contact"\s+class="hero-cta"[^>]*>.*?<\/a>/s;
  if (heroCtaRe.test(out)) {
    out = out.replace(heroCtaRe, formHtml);
    changed = true;
  } else {
    // Fallback: insert form right before the closing </div> of .hero block.
    const heroBlockRe = /(<div class="hero">[\s\S]*?)(<\/div>\s*\n\s*<section)/;
    if (heroBlockRe.test(out)) {
      out = out.replace(heroBlockRe, `$1${formHtml}\n$2`);
      changed = true;
    }
  }

  // ---- 3d. Rewrite every remaining "#contact" CTA.
  const orderUrl = `/order.html?niche=${encodeURIComponent(niche)}&city=${encodeURIComponent(citySlug)}`;
  const ctaSource = `seo-${niche}-${citySlug}`;
  // Pattern: an <a> tag whose href ends with #contact (with or without the
  // full staticswift.co.uk prefix). Don't touch hrefs inside the form block.
  const anchorRe = /<a\b([^>]*?)href="([^"]*#contact)"([^>]*)>/g;
  out = out.replace(anchorRe, (match, pre, href, post) => {
    // Skip anchors inside the form (they shouldn't exist, but be safe).
    if (pre.includes('class="ss-') || post.includes('class="ss-')) return match;
    // Build new attributes. Preserve existing class/etc, just swap href and add data-cta-from.
    const allAttrs = (pre + post).replace(/\s+data-cta-from="[^"]*"/g, '');
    return `<a${allAttrs}href="${orderUrl}" data-cta-from="${ctaSource}">`;
  });
  // The replace above may have produced double spaces. Tidy them.
  out = out.replace(/<a\s{2,}/g, '<a ');

  // ---- 3e. Append CTA click tracker just before </body>.
  if (!out.includes('// ss-cta-tracker')) {
    const tracker = buildCtaTrackerScript().replace('<script>', '<script>\n// ss-cta-tracker');
    out = out.replace('</body>', `${tracker}\n</body>`);
    changed = true;
  }

  return changed ? { patched: true, html: out } : { skipped: 'no-change', html };
}

// ---------------------------------------------------------------
// 4. order.html patcher
// ---------------------------------------------------------------

function patchOrderHtml(html) {
  if (html.includes('// ss:order-hydrate-v1')) {
    return { skipped: 'already-patched', html };
  }

  let out = html;

  // 4a. Inject gtag if missing.
  if (!out.includes('G-4BZHQMG0RF')) {
    out = out.replace('</head>', `${GTAG_SCRIPT}\n</head>`);
  }

  // 4b. Turn the business_type select into a richer list AND default to "Other".
  // The existing select hardcodes a small list. We replace it with the niche
  // whitelist (matching the SEO form) plus the standard items, with a value
  // attribute on every <option> so URL params can match.
  const selectRe = /(<select name="business_type" id="f-biztype" required>)[\s\S]*?(<\/select>)/;
  if (selectRe.test(out)) {
    let options = '';
    // Sort alphabetically by display label.
    for (const key of Object.keys(NICHES).sort((a, b) => NICHES[a].localeCompare(NICHES[b]))) {
      options += `<option value="${key}">${escapeHtml(NICHES[key])}</option>`;
    }
    options += `<option value="other" selected>Other</option>`;
    out = out.replace(selectRe, `$1${options}$2`);
  }

  // 4c. Add a hydration + gtag block. We insert it just before
  // the closing </script> of the existing inline script so it
  // runs after the form has been rendered and the submit listener
  // attached. We use a sentinel comment for idempotency.
  const hydrate = `
// ss:order-hydrate-v1 — pre-fill from ?niche=X&city=Y
(function(){
  try{
    var p=new URLSearchParams(window.location.search);
    var niche=(p.get('niche')||'').toLowerCase();
    var city=p.get('city')||'';
    var bt=document.getElementById('f-biztype');
    if(bt&&niche){
      var found=false;
      for(var i=0;i<bt.options.length;i++){
        if((bt.options[i].value||'').toLowerCase()===niche){bt.selectedIndex=i;found=true;break;}
      }
      if(!found){
        for(var j=0;j<bt.options.length;j++){
          if((bt.options[j].value||'').toLowerCase()==='other'){bt.selectedIndex=j;break;}
        }
      }
    }
    var loc=document.getElementById('f-location');
    if(loc&&city&&!loc.value){
      // Slug -> Title Case (handle "stoke-on-trent" etc.).
      var small={on:1,in:1,upon:1,under:1,super:1,next:1,le:1,la:1,of:1,by:1,the:1};
      loc.value=city.split('-').map(function(w,i){
        if(i>0&&small[w])return w;
        return w.charAt(0).toUpperCase()+w.slice(1);
      }).join('-');
    }
    // Set hidden source field so we know which SEO page they came from.
    var f=document.getElementById('order-form');
    if(f&&niche&&!f.querySelector('input[name="source_page"]')){
      var h=document.createElement('input');h.type='hidden';h.name='source_page';h.value='seo-'+niche+'-'+city;
      f.appendChild(h);
    }
  }catch(e){}
})();

// ss:order-lead-event-v1 — fire generate_lead on successful submit
(function(){
  var f=document.getElementById('order-form');if(!f)return;
  f.addEventListener('submit',function(){
    // Defer so this runs AFTER the existing submit handler, which is async.
    // We poll for the visible #ok element which is the success signal.
    var start=Date.now();
    var iv=setInterval(function(){
      var ok=document.getElementById('ok');
      if(ok&&ok.style.display==='block'){
        clearInterval(iv);
        try{
          var p=new URLSearchParams(window.location.search);
          var src=(p.get('niche')?'seo-'+p.get('niche')+'-'+(p.get('city')||''):'order-form-full');
          var bt=document.getElementById('f-biztype');var loc=document.getElementById('f-location');
          if(typeof gtag==='function')gtag('event','generate_lead',{value:499,currency:'GBP',source:src,business_type:bt&&bt.value,location:loc&&loc.value});
          window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_submit',form_id:'order_full',source:src});
        }catch(e){}
      } else if(Date.now()-start>15000){clearInterval(iv);}
    },200);
  });
})();
`;
  // Insert just before the final closing </script> of the page.
  out = out.replace(/<\/script>\s*<\/body>/, `${hydrate}\n</script>\n</body>`);

  return { patched: true, html: out };
}

// ---------------------------------------------------------------
// 5. Driver
// ---------------------------------------------------------------

function listFolders() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function main() {
  const all = listFolders();
  const matched = [];
  const skippedFolders = [];
  for (const name of all) {
    if (name.startsWith('.')) continue;
    if (['scripts', 'admin', 'netlify', 'taste-skill', 'node_modules'].includes(name)) continue;
    if (name.startsWith('staticswift-vs-')) { skippedFolders.push({ name, reason: 'comparison-page' }); continue; }
    const parsed = parseFolder(name);
    if (!parsed) { skippedFolders.push({ name, reason: 'no-niche-or-city' }); continue; }
    matched.push({ name, ...parsed });
  }

  console.log(`[ss-patch] mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[ss-patch] root: ${ROOT}`);
  console.log(`[ss-patch] total folders scanned: ${all.length}`);
  console.log(`[ss-patch] matched SEO pages: ${matched.length}`);
  console.log(`[ss-patch] skipped folders: ${skippedFolders.length}`);
  if (VERBOSE && skippedFolders.length) {
    const sample = skippedFolders.slice(0, 30);
    console.log(`[ss-patch] sample skips:`);
    for (const s of sample) console.log(`  - ${s.name}  (${s.reason})`);
  }

  const targets = DRY ? matched.slice(0, 5) : matched;
  let patched = 0, already = 0, skipped = 0, errors = 0;

  for (const t of targets) {
    const file = path.join(ROOT, t.name, 'index.html');
    if (!fs.existsSync(file)) { skipped++; if (VERBOSE) console.log(`  SKIP (no index.html): ${t.name}`); continue; }
    let html;
    try { html = fs.readFileSync(file, 'utf8'); }
    catch (e) { errors++; console.log(`  ERR read ${t.name}: ${e.message}`); continue; }

    const cityLabel = titleCaseFromSlug(t.citySlug);
    const result = patchPage(html, { niche: t.niche, citySlug: t.citySlug, cityLabel });

    if (result.skipped === 'already-patched') { already++; if (VERBOSE) console.log(`  ALREADY: ${t.name}`); continue; }
    if (result.skipped === 'no-change') { skipped++; if (VERBOSE) console.log(`  NO-CHANGE: ${t.name}`); continue; }

    if (DRY) {
      patched++;
      console.log(`\n--- DRY-RUN: ${t.name}  (niche=${t.niche}, city=${t.citySlug}) ---`);
      // Show the form snippet + a sample of CTA rewrites.
      const sentinelIdx = result.html.indexOf(SENTINEL);
      console.log(`  injected form at byte ${sentinelIdx}`);
      // Count rewritten anchors.
      const ctaCount = (result.html.match(/data-cta-from="seo-/g) || []).length;
      console.log(`  CTAs rewritten to /order.html: ${ctaCount}`);
      console.log(`  gtag injected: ${!html.includes('G-4BZHQMG0RF') ? 'yes' : 'no (already present)'}`);
      continue;
    }

    try {
      fs.writeFileSync(file, result.html, 'utf8');
      patched++;
      if (VERBOSE) console.log(`  OK: ${t.name}`);
    } catch (e) { errors++; console.log(`  ERR write ${t.name}: ${e.message}`); }
  }

  // ---- Patch order.html (only in apply mode) ----
  const orderFile = path.join(ROOT, 'order.html');
  if (fs.existsSync(orderFile)) {
    const orderHtml = fs.readFileSync(orderFile, 'utf8');
    const orderResult = patchOrderHtml(orderHtml);
    if (orderResult.skipped === 'already-patched') {
      console.log(`[ss-patch] order.html already patched`);
    } else if (DRY) {
      console.log(`[ss-patch] order.html: would patch (gtag, hydrate, lead event)`);
    } else {
      fs.writeFileSync(orderFile, orderResult.html, 'utf8');
      console.log(`[ss-patch] order.html: patched`);
    }
  } else {
    console.log(`[ss-patch] order.html: not found (skipped)`);
  }

  console.log(`\n[ss-patch] === RESULT ===`);
  console.log(`  patched:        ${patched}`);
  console.log(`  already patched: ${already}`);
  console.log(`  skipped:        ${skipped}`);
  console.log(`  errors:         ${errors}`);
  if (DRY) {
    console.log(`\n[ss-patch] dry-run only — pass --apply to write changes.`);
    console.log(`[ss-patch] matched ${matched.length} folders total; only first 5 shown.`);
  }
}

main();
