#!/usr/bin/env node
/**
 * inject-tracker.mjs — put measurement on every page.
 *
 * Before this, the self-hosted tracker existed only on the homepage (so the
 * dashboard's top-pages showed only "/"), and town-hub pages carried no
 * analytics at all. This injects:
 *   1. The shared tracker (pageview + duration beacon + ssTrack) before
 *      </body> on every page that lacks it.
 *   2. The GA4 tag in <head> on pages that lack it entirely (hubs).
 *
 * The tracker sends duration on pagehide/visibilitychange via sendBeacon,
 * which fixes the dashboard's 0m 0s session durations. Paths are sent
 * without query strings; tracking params go in a src object.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['netlify', 'scripts', 'generator', 'docs', 'data', 'images', '_archive', 'admin', 'node_modules', 'tests', '.git', '.claude', 'staticswift-skill', 'invoice']);

const TRACKER = `<script data-ss-tracker>
(function(){var E='/.netlify/functions/track-event';
var p=location.pathname;
var q=new URLSearchParams(location.search),src={};
['utm_source','utm_medium','utm_campaign','ttclid','fbclid','gclid','ref','aff'].forEach(function(k){var v=q.get(k);if(v)src[k]=v;});
var sid='';try{sid=sessionStorage.getItem('ss_sid')||'';if(!sid){sid=Math.random().toString(36).slice(2,10)+Date.now().toString(36);sessionStorage.setItem('ss_sid',sid);}}catch(_){}
function send(o){try{var b=JSON.stringify(o);if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:'application/json'}));}else{fetch(E,{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true}).catch(function(){});}}catch(_){}}
send({type:'pageview',path:p,ref:document.referrer||'',sid:sid,lang:navigator.language||'',vp:innerWidth+'x'+innerHeight,src:src});
var t0=Date.now(),sent=false;
function dur(){if(sent)return;sent=true;send({type:'duration',path:p,sid:sid,dur:Date.now()-t0});}
addEventListener('pagehide',dur);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')dur();});
window.ssTrack=function(evt,meta){send({type:'event',evt:evt,path:p,sid:sid,meta:meta||{}});};
document.addEventListener('submit',function(e){var f=e.target;if(f&&f.tagName==='FORM')window.ssTrack('form_submit',{form:f.id||''});},true);
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(h.indexOf('wa.me')>-1||h.indexOf('whatsapp')>-1)window.ssTrack('whatsapp_click',{});else if(h.indexOf('tel:')===0)window.ssTrack('tel_click',{});},true);
})();
</script>`;

const GA4 = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-4BZHQMG0RF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-4BZHQMG0RF');</script>`;

let trackerAdded = 0, ga4Added = 0, scanned = 0;

function patch(file) {
  let html = readFileSync(file, 'utf8');
  let changed = false;
  // Replace any previously injected tracker so re-runs upgrade in place.
  const existing = html.match(/<script data-ss-tracker>[\s\S]*?<\/script>\n?/);
  if (existing && existing[0] !== TRACKER + '\n') {
    html = html.replace(existing[0], '');
  }
  if (!html.includes('data-ss-tracker') && !html.includes('PAGEVIEW TRACKER') && html.includes('</body>')) {
    html = html.replace('</body>', TRACKER + '\n</body>');
    trackerAdded++; changed = true;
  }
  if (!html.includes('googletagmanager.com/gtag') && html.includes('</head>')) {
    html = html.replace('<link rel="preconnect"', GA4 + '\n<link rel="preconnect"');
    if (!html.includes('googletagmanager')) html = html.replace('</head>', GA4 + '\n</head>');
    ga4Added++; changed = true;
  }
  if (changed) writeFileSync(file, html);
}

for (const f of readdirSync(ROOT)) {
  if (f.endsWith('.html') && f !== 'gone.html') { scanned++; patch(join(ROOT, f)); }
}
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
  const f = join(ROOT, d.name, 'index.html');
  if (existsSync(f)) { scanned++; patch(f); }
}
console.log(`Scanned ${scanned} pages: tracker added to ${trackerAdded}, GA4 added to ${ga4Added}.`);
