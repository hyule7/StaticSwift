#!/usr/bin/env node
/**
 * build-leaf-template-sample.mjs — Phase 1b: the new leaf template, built as
 * REVIEW SAMPLES ONLY under /_template-preview/ (noindex, not in sitemap).
 * Harry approves the design before any estate rollout.
 *
 * Design: the homepage Field Guide system (paper/ink/signal, Sentient +
 * Switzer + JetBrains Mono, hairlines, mono tags). Every price and claim is
 * rendered from data/facts.json at build time.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const P = facts.pricing, D = facts.delivery, G = facts.guarantee, C = facts.contact;

const SAMPLES = [
  {
    trade: 'plumber', tradeLabel: 'Plumber', plural: 'plumbers', town: 'Manchester',
    services: ['Emergency call-outs', 'Boiler repair and install', 'Bathroom fitting', 'Leak detection', 'Power flushing', 'Annual servicing'],
    pain: `Most plumbing work is won on the phone, and most of those calls start with a search at 7am from a kitchen with water where water should not be. If the top results show your competitors, the job is gone before your kettle boils. A plumber's website has one job: make the call happen. Click-to-call in the thumb zone, your service area spelled out, your Gas Safe number where the customer can see it, and three real reviews doing the persuading. That converts better than any directory listing, and you stop paying lead fees for work that should have come to you directly.`,
    faqs: [
      ['Will my website help me rank on Google in {TOWN}?', 'It is built for it: meta tags, LocalBusiness schema, fast loading and {TOWN}-specific copy. Rankings are never guaranteed by anyone honest, but the technical foundation is done properly.'],
      ['Will my plumber website work on mobile phones?', 'Mobile is designed first. Most customers searching for plumbers in {TOWN} are on a phone, often mid-emergency, so the call button stays under the thumb.'],
      ['How fast will I see something?', `A real working preview lands in your inbox within ${D.preview_hours} hours of your brief. No card, no charge. If you keep it, the site is live within ${D.build_days} days.`],
      ['Do I need to sort hosting?', 'No. Hosting on Netlify with SSL is included. The optional £' + P.starter.monthly_optional + '/mo managed plan is there if you want edits, updates and reports handled for you.'],
    ],
  },
  {
    trade: 'electrician', tradeLabel: 'Electrician', plural: 'electricians', town: 'Leeds',
    services: ['Rewires and consumer units', 'EICR testing and certificates', 'EV charger installation', 'Fault finding', 'Lighting design', 'Landlord certificates'],
    pain: `Electrical work is distress-purchase or compliance-purchase: either something tripped, or a landlord needs an EICR by Friday. Both customers search, scan, and call the first electrician who looks legitimate. Looking legitimate means your NICEIC or NAPIT registration visible, your certificates listed plainly, real photographs of your work, and a number that answers. A page built around those four things wins jobs from electricians with twice your years and none of your presentation.`,
    faqs: [
      ['Will my website help me rank on Google in {TOWN}?', 'It is built for it: meta tags, LocalBusiness schema, fast loading and {TOWN}-specific copy. Rankings are never guaranteed by anyone honest, but the technical foundation is done properly.'],
      ['Can I show my certifications?', 'Yes, and you should. NICEIC, NAPIT, Part P: badges and registration numbers go above the fold, because compliance is what the customer is actually buying.'],
      ['How fast will I see something?', `A real working preview lands in your inbox within ${D.preview_hours} hours of your brief. No card, no charge. If you keep it, the site is live within ${D.build_days} days.`],
      ['Do I need to sort hosting?', 'No. Hosting on Netlify with SSL is included. The optional £' + P.starter.monthly_optional + '/mo managed plan is there if you want edits, updates and reports handled for you.'],
    ],
  },
  {
    trade: 'barber', tradeLabel: 'Barber', plural: 'barbers', town: 'Bristol',
    services: ['Skin fades', 'Beard sculpting', 'Hot towel shaves', 'Kids cuts', 'Walk-ins and bookings', 'Loyalty offers'],
    pain: `A barbershop lives and dies on two things: whether new faces can find the chair, and whether regulars can book without ringing mid-cut. Your Instagram shows the fades; your website does the boring work that pays: opening hours that are actually right, a booking link that works, the shop on a map, and your Google reviews pulled in where a new customer sees five stars before they see the price list. One walk-in a week from search pays for the site several times over.`,
    faqs: [
      ['Will my website help me rank on Google in {TOWN}?', 'It is built for it: meta tags, LocalBusiness schema, fast loading and {TOWN}-specific copy. Rankings are never guaranteed by anyone honest, but the technical foundation is done properly.'],
      ['Can it take bookings?', 'Yes. Your existing booking system (Booksy, Fresha, Squire or a simple form) is wired in so regulars book in two taps.'],
      ['How fast will I see something?', `A real working preview lands in your inbox within ${D.preview_hours} hours of your brief. No card, no charge. If you keep it, the site is live within ${D.build_days} days.`],
      ['Do I need to sort hosting?', 'No. Hosting on Netlify with SSL is included. The optional £' + P.starter.monthly_optional + '/mo managed plan is there if you want edits, updates and reports handled for you.'],
    ],
  },
];

const TRADES_GRID = ['electrician', 'plumber', 'builder', 'roofer', 'joiner', 'plasterer'];
const TOWNS_GRID = ['manchester', 'leeds', 'birmingham', 'liverpool', 'sheffield', 'bristol'];

function page(s) {
  const T = s.town, TL = s.tradeLabel, PLU = s.plural, slug = `${s.trade}-website-design-${T.toLowerCase()}`;
  const faqHtml = s.faqs.map(([q, a]) => {
    q = q.replaceAll('{TOWN}', T); a = a.replaceAll('{TOWN}', T);
    return `<div class="faq-i"><button class="faq-q" onclick="tf(this)">${q}<span aria-hidden="true">+</span></button><div class="faq-a">${a}</div></div>`;
  }).join('\n');
  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: s.faqs.map(([q, a]) => ({ '@type': 'Question', name: q.replaceAll('{TOWN}', T), acceptedAnswer: { '@type': 'Answer', text: a.replaceAll('{TOWN}', T) } })),
  });
  const bizSchema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'StaticSwift',
    url: 'https://staticswift.co.uk', telephone: C.whatsapp, email: C.email,
    description: `${TL} website design in ${T}. Free preview in ${D.preview_hours} hours, from £${P.starter.build}. Optional £${P.starter.monthly_optional}/mo managed plan.`,
    address: { '@type': 'PostalAddress', addressLocality: T, addressCountry: 'GB' },
    priceRange: `£${P.starter.build} - £${P.pro.build}`,
  });
  const svc = s.services.map(x => `<li>${x}</li>`).join('');
  const townLinks = TOWNS_GRID.filter(t => t !== T.toLowerCase()).slice(0, 5)
    .map(t => `<a href="/${s.trade}-website-design-${t}/">${TL}s in ${t[0].toUpperCase() + t.slice(1)}</a>`).join('');
  const tradeLinks = TRADES_GRID.filter(t => t !== s.trade).slice(0, 5)
    .map(t => `<a href="/${t}-website-design-${T.toLowerCase()}/">${t[0].toUpperCase() + t.slice(1).replace('-', ' ')}s in ${T}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${TL} Website Design ${T} (£${P.starter.build}, free 24h preview) · StaticSwift</title>
<meta name="description" content="${TL} websites in ${T} that make the phone ring. £${P.starter.build} once, optional £${P.starter.monthly_optional}/mo managed. Free working preview in ${D.preview_hours} hours, no card. First lead in ${G.days} days or full refund.">
<meta name="robots" content="noindex"><!-- TEMPLATE PREVIEW ONLY -->
<meta name="theme-color" content="#F2EFE7">
<script type="application/ld+json">${bizSchema}</script>
<script type="application/ld+json">${faqSchema}</script>
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=sentient@400,400i,500,500i&f[]=switzer@300,400,500,600&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--paper:#F2EFE7;--paper-deep:#EBE7DD;--ink:#0E0B07;--ink-soft:#29221C;--ink-mid:#5A4E40;--bronze:#8A7B62;--bronze-dim:#BFB4A0;--signal:#9C2615;--green:#347537;--hair:rgba(14,11,7,.22);--hair-soft:rgba(14,11,7,.10);
--serif:'Sentient',Georgia,serif;--sans:'Switzer','Helvetica Neue',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;--gutter:clamp(20px,5vw,72px)}
body{font-family:var(--sans);background:var(--paper);color:var(--ink);font-size:17px;line-height:1.55}
a{color:inherit;text-decoration:none}::selection{background:var(--ink);color:var(--paper)}
.rh{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;padding:13px var(--gutter);background:var(--paper);border-bottom:1px solid var(--hair)}
.rh-l{font-family:var(--serif);font-style:italic;font-weight:500;font-size:18px;display:flex;align-items:center;gap:10px}
.rh-l::before{content:"";width:7px;height:7px;background:var(--ink);border-radius:50%}
.rh-r a{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:10px 18px;border-radius:100px}
.mast{padding:clamp(48px,9vw,110px) var(--gutter) clamp(36px,5vw,64px);border-bottom:1px solid var(--hair)}
.mast-in{max-width:1100px;margin:0 auto}
.mark{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--bronze);display:flex;align-items:center;gap:14px;margin-bottom:26px}
.mark::before{content:"";width:36px;height:1px;background:var(--ink)}
h1{font-family:var(--serif);font-style:italic;font-weight:500;font-size:clamp(36px,7vw,76px);line-height:.95;letter-spacing:-.03em;margin-bottom:22px}
h1 em{color:var(--signal)}
.lede{font-family:var(--serif);font-size:clamp(18px,2.1vw,24px);line-height:1.42;color:var(--ink-soft);max-width:560px}
.lede b{color:var(--ink);font-weight:500}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(28px,5vw,64px);align-items:start;max-width:1100px;margin:0 auto}
@media(max-width:880px){.hero-grid{grid-template-columns:1fr}}
.lead-card{background:var(--paper-deep);border:1px solid var(--hair);padding:26px 24px;position:relative}
.lead-card::before,.lead-card::after{content:"";position:absolute;width:14px;height:14px;border-color:var(--ink);border-style:solid}
.lead-card::before{top:-1px;left:-1px;border-width:1px 0 0 1px}
.lead-card::after{bottom:-1px;right:-1px;border-width:0 1px 1px 0}
.lc-h{font-family:var(--serif);font-style:italic;font-weight:500;font-size:24px;margin-bottom:4px}
.lc-h em{color:var(--signal)}
.lc-sub{font-size:14px;color:var(--ink-mid);margin-bottom:18px}
.fg{margin-bottom:14px}
.fg label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--bronze);margin-bottom:6px}
.fg input,.fg select{width:100%;background:transparent;border:0;border-bottom:1px solid var(--hair);padding:9px 2px;font:inherit;font-size:16px;color:var(--ink);border-radius:0}
.fg input:focus,.fg select:focus{outline:none;border-bottom-color:var(--signal)}
.submit{width:100%;background:var(--ink);color:var(--paper);border:0;padding:16px;font:600 15.5px var(--sans);border-radius:100px;cursor:pointer;margin-top:6px}
.submit:hover{background:var(--signal)}
.lc-foot{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--bronze);margin-top:12px;text-align:center}
.ok-box,.err-box{display:none;padding:14px;margin-top:10px;font-size:15px}
.ok-box{border:1px solid var(--green);color:var(--green)}
.err-box{border:1px solid var(--signal);color:var(--signal)}
.ok-box.show,.err-box.show{display:block}
section{padding:clamp(40px,7vw,80px) var(--gutter);border-bottom:1px solid var(--hair-soft)}
.si{max-width:900px;margin:0 auto}
.tag{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--bronze);display:block;margin-bottom:14px}
h2{font-family:var(--serif);font-style:italic;font-weight:500;font-size:clamp(26px,4vw,44px);letter-spacing:-.02em;line-height:1.05;margin-bottom:18px}
h2 em{color:var(--signal)}
.body-text{color:var(--ink-soft);font-size:16.5px;line-height:1.7;max-width:680px;margin-bottom:14px}
.svc{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0;border-top:1px solid var(--hair);margin-top:20px;list-style:none}
.svc li{padding:14px 4px;border-bottom:1px solid var(--hair-soft);font-family:var(--serif);font-size:17px}
.pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:24px}
.pcard{border:1px solid var(--hair);padding:24px;background:var(--paper)}
.pcard.feat{background:var(--ink);color:var(--paper)}
.pcard.feat .pp,.pcard.feat .pname{color:var(--paper)}
.pname{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--bronze);margin-bottom:10px}
.pp{font-family:var(--serif);font-style:italic;font-size:38px;font-weight:500;margin-bottom:2px}
.pmo{font-size:13px;color:var(--bronze);margin-bottom:14px}
.pl{list-style:none;font-size:14.5px;line-height:2}
.pl li::before{content:"· "}
.guarantee{background:var(--paper-deep)}
.g-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,56px);max-width:1000px;margin:0 auto;align-items:center}
@media(max-width:760px){.g-grid{grid-template-columns:1fr}}
.founder{font-family:var(--serif);font-size:17px;line-height:1.65;color:var(--ink-soft)}
.founder b{font-style:italic}
.sig{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--bronze);margin-top:14px}
.faq-i{border-bottom:1px solid var(--hair-soft)}
.faq-q{width:100%;display:flex;justify-content:space-between;gap:16px;text-align:left;background:none;border:0;padding:18px 2px;font:500 17px var(--serif);font-style:italic;cursor:pointer;color:var(--ink)}
.faq-a{display:none;padding:0 2px 18px;color:var(--ink-soft);font-size:15.5px;line-height:1.65;max-width:640px}
.faq-i.open .faq-a{display:block}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.links a{font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;border:1px solid var(--hair);padding:9px 14px;border-radius:100px}
.links a:hover{border-color:var(--ink)}
footer{padding:34px var(--gutter);font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--bronze);display:flex;justify-content:space-between;flex-wrap:gap;gap:12px}
.msticky{display:none}
@media(max-width:768px){
.msticky{position:fixed;bottom:0;left:0;right:0;z-index:90;display:flex;gap:1px;box-shadow:0 -4px 18px rgba(0,0,0,.18);transition:transform .25s}
.msticky.off{transform:translateY(110%)}
.msticky a{flex:1;text-align:center;padding:15px 8px;font:600 15px/1.2 var(--sans);min-height:44px}
.msticky .wa{background:#1F8B47;color:#fff;flex:0 0 36%}
.msticky .go{background:var(--ink);color:var(--paper)}
body{padding-bottom:64px}}
@media(prefers-reduced-motion:no-preference){.fi{opacity:0;transform:translateY(12px);transition:opacity .6s,transform .6s}.fi.on{opacity:1;transform:none}}
</style>
</head>
<body>
<header class="rh">
  <div class="rh-l">StaticSwift</div>
  <div class="rh-r"><a href="#lead">Free preview · £${P.starter.build}</a></div>
</header>

<div class="mast">
  <div class="hero-grid">
    <div>
      <div class="mark">Field Guide · ${TL}s · ${T}</div>
      <h1>${TL} websites in ${T} that make the <em>phone ring.</em></h1>
      <p class="lede">£${P.starter.build} once. Optional £${P.starter.monthly_optional}/mo if you want it managed. <b>Real working preview in ${D.preview_hours} hours</b>, no card. First lead in ${G.days} days or your money back, and you keep the site.</p>
    </div>
    <form class="lead-card" id="lead" method="post" action="/.netlify/functions/handle-intake" novalidate>
      <div class="lc-h">Free preview in <em>${D.preview_hours} hours.</em></div>
      <div class="lc-sub">Four fields. No payment until you love it.</div>
      <div class="fg"><label>Your name</label><input type="text" name="name" required maxlength="60" placeholder="e.g. Sarah Jones" autocomplete="name"></div>
      <div class="fg"><label>WhatsApp / mobile</label><input type="tel" name="whatsapp" required maxlength="20" placeholder="07700 900000" autocomplete="tel"></div>
      <div class="fg"><label>Email</label><input type="email" name="delivery_email" required maxlength="100" placeholder="you@email.com" autocomplete="email"></div>
      <div class="fg"><label>Town / city</label><input type="text" name="location" required maxlength="60" value="${T}" autocomplete="address-level2"></div>
      <input type="hidden" name="business_type" value="${s.trade}">
      <input type="text" name="bot-field" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
      <button type="submit" class="submit">Get my free preview →</button>
      <div class="err-box" id="err">Could not send. WhatsApp ${C.whatsapp_display} and Harry will pick it up by hand.</div>
      <div class="ok-box" id="okb">Done. Preview lands within ${D.preview_hours} hours. WhatsApp from Harry within the hour, UK working hours.</div>
      <div class="lc-foot">No card needed · ${G.days}-day lead guarantee · You own it forever</div>
    </form>
  </div>
</div>

<section><div class="si fi">
  <span class="tag">Why ${PLU} need this</span>
  <h2>The job goes to whoever the phone <em>finds first.</em></h2>
  <p class="body-text">${s.pain}</p>
</div></section>

<section style="background:var(--paper-deep)"><div class="si fi">
  <span class="tag">Built into every ${s.trade} site</span>
  <h2>Everything that drives <em>enquiries.</em></h2>
  <ul class="svc">${svc}</ul>
</div></section>

<section><div class="si fi">
  <span class="tag">Pricing · from data, not from air</span>
  <h2>Two honest <em>numbers.</em></h2>
  <div class="pricing">
    <div class="pcard feat">
      <div class="pname">Starter</div>
      <div class="pp">£${P.starter.build}</div>
      <div class="pmo">once · optional £${P.starter.monthly_optional}/mo managed</div>
      <ul class="pl"><li>${P.starter.pages} pages, hand-coded</li><li>Google Business Profile wired in</li><li>Hosting and SSL included</li><li>Free preview in ${D.preview_hours}h</li><li>Live within ${D.build_days} days</li><li>${D.revisions_included} free revision</li></ul>
    </div>
    <div class="pcard">
      <div class="pname">Pro</div>
      <div class="pp">£${P.pro.build}</div>
      <div class="pmo">once · optional £${P.pro.monthly_optional}/mo managed</div>
      <ul class="pl"><li>${P.pro.pages} pages for multi-area operators</li><li>Gallery and testimonials</li><li>Priority build</li><li>Everything in Starter</li></ul>
    </div>
  </div>
</div></section>

<section class="guarantee"><div class="g-grid fi">
  <div>
    <span class="tag">The guarantee</span>
    <h2>First lead in ${G.days} days, or it's <em>free.</em></h2>
    <p class="body-text">If the site doesn't put a new enquiry in your hands within ${G.days} days of going live, you get the full £${P.starter.build} back. And you keep the site. That is the whole clause; there is no asterisk.</p>
  </div>
  <div>
    <p class="founder">I'm <b>Harry Yule</b>, one developer in Manchester. I write every site by hand, at night mostly, because I watched an agency take a roofer's £1,800 for a WordPress site that never worked. No templates, no page builders, no project managers. One craftsman, your trade, your town.</p>
    <div class="sig">Founder · StaticSwift · Manchester</div>
  </div>
</div></section>

<section><div class="si fi">
  <span class="tag">Questions ${PLU} ask</span>
  <h2>Straight <em>answers.</em></h2>
  ${faqHtml}
</div></section>

<section style="background:var(--paper-deep)"><div class="si fi">
  <span class="tag">Nearby</span>
  <div class="links">${townLinks}</div>
  <span class="tag" style="margin-top:26px">Other trades in ${T}</span>
  <div class="links">${tradeLinks}</div>
  <div class="links" style="margin-top:18px"><a href="/website-design-${T.toLowerCase()}/">All ${T} services</a><a href="/${s.trade}-website-design/">${TL}s nationwide</a></div>
</div></section>

<footer>
  <span>StaticSwift · MMXXVI · Manchester</span>
  <span><a href="https://wa.me/${C.whatsapp.replace('+', '')}">WhatsApp ${C.whatsapp_display}</a> · <a href="mailto:${C.email}">${C.email}</a></span>
</footer>

<div class="msticky" id="msticky">
  <a class="wa" href="https://wa.me/${C.whatsapp.replace('+', '')}" target="_blank" rel="noopener">WhatsApp</a>
  <a class="go" href="#lead">Free preview in ${D.preview_hours}h →</a>
</div>

<script>
function tf(b){b.parentElement.classList.toggle('open')}
(function(){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{threshold:.05});
  document.querySelectorAll('.fi').forEach(function(el){io.observe(el)});
  var bar=document.getElementById('msticky'),f=document.getElementById('lead');
  if(bar&&f&&'IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){bar.classList.toggle('off',e.isIntersecting)})},{threshold:.05}).observe(f)}
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    var bot=f.querySelector('[name="bot-field"]');if(bot&&bot.value)return;
    var btn=f.querySelector('.submit'),ok=document.getElementById('okb'),er=document.getElementById('err');
    er.classList.remove('show');btn.disabled=true;var orig=btn.textContent;btn.textContent='Sending…';
    var fd=new FormData(f),data={};fd.forEach(function(v,k){if(k!=='bot-field')data[k]=v});
    data.source='${slug}';data.stage='new-lead';data.createdAt=new Date().toISOString();
    try{
      var r=await fetch('/.netlify/functions/handle-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      var j=await r.json().catch(function(){return{ok:r.ok}});
      if(r.ok&&j&&j.ok!==false){
        f.querySelectorAll('.fg,.submit,.lc-sub').forEach(function(el){el.style.display='none'});
        ok.classList.add('show');
        try{if(typeof gtag==='function')gtag('event','generate_lead',{value:${P.starter.build},currency:'GBP',source:'${slug}'})}catch(_){}
      }else{er.classList.add('show');btn.disabled=false;btn.textContent=orig}
    }catch(_){er.classList.add('show');btn.disabled=false;btn.textContent=orig}
  });
})();
</script>
</body>
</html>`;
}

for (const s of SAMPLES) {
  const dir = join(ROOT, '_template-preview', `${s.trade}-website-design-${s.town.toLowerCase()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(s));
  console.log(`built _template-preview/${s.trade}-website-design-${s.town.toLowerCase()}/`);
}
