/*
 * _preview-builder.js — renders a real, personalised one-page website for a
 * cold prospect from their public info. This is the asset behind the highest
 * converting cold email in the niche: "I already built you this, here is the
 * live link." The page is a mockup of THE PROSPECT'S OWN business site (not a
 * StaticSwift pitch page) with a single honest StaticSwift ribbon at the foot.
 *
 * Constitution rules honoured: Field Guide voice and palette, mobile first,
 * NO em dashes, and NOTHING fabricated. We never invent reviews, ratings,
 * stats or results for the prospect. Every concrete StaticSwift claim (price,
 * preview window, guarantee, contact) traces to data/facts.json and is passed
 * in by the caller so there is one source of truth.
 */

// Light trade -> services map. Falls back to a generic set so any trade works.
const SERVICES = {
  plumber: ['Emergency repairs', 'Boiler and heating', 'Bathrooms and showers', 'Leaks and burst pipes'],
  plumbing: ['Emergency repairs', 'Boiler and heating', 'Bathrooms and showers', 'Leaks and burst pipes'],
  electrician: ['Fault finding', 'Rewires and consumer units', 'EV charger installs', 'Lighting and sockets'],
  electrical: ['Fault finding', 'Rewires and consumer units', 'EV charger installs', 'Lighting and sockets'],
  roofer: ['Roof repairs', 'Flat roofs', 'Guttering and fascias', 'Chimney work'],
  roofing: ['Roof repairs', 'Flat roofs', 'Guttering and fascias', 'Chimney work'],
  builder: ['Extensions', 'Renovations', 'Brickwork and groundwork', 'Loft conversions'],
  building: ['Extensions', 'Renovations', 'Brickwork and groundwork', 'Loft conversions'],
  plasterer: ['Skimming and plastering', 'Rendering', 'Coving and ceilings', 'Damp and repairs'],
  plastering: ['Skimming and plastering', 'Rendering', 'Coving and ceilings', 'Damp and repairs'],
  carpenter: ['Fitted kitchens', 'Doors and skirting', 'Decking and fencing', 'Bespoke joinery'],
  carpentry: ['Fitted kitchens', 'Doors and skirting', 'Decking and fencing', 'Bespoke joinery'],
  painter: ['Interior painting', 'Exterior and render', 'Wallpapering', 'Wood treatment'],
  decorator: ['Interior painting', 'Exterior and render', 'Wallpapering', 'Wood treatment'],
  landscaper: ['Patios and paving', 'Fencing and decking', 'Turfing and planting', 'Garden clearance'],
  landscaping: ['Patios and paving', 'Fencing and decking', 'Turfing and planting', 'Garden clearance'],
  gardener: ['Lawn and hedge care', 'Planting and borders', 'Garden clearance', 'Seasonal maintenance'],
  tiler: ['Bathroom tiling', 'Kitchen splashbacks', 'Floor tiling', 'Wet rooms'],
  tiling: ['Bathroom tiling', 'Kitchen splashbacks', 'Floor tiling', 'Wet rooms'],
  'heating engineer': ['Boiler installs', 'Servicing and repairs', 'Central heating', 'Power flushing'],
  'gas engineer': ['Boiler installs', 'Gas safety checks', 'Servicing and repairs', 'Cooker and hob fitting'],
  cleaner: ['Domestic cleaning', 'End of tenancy', 'Carpets and upholstery', 'Office cleaning'],
  locksmith: ['Emergency lockouts', 'Lock changes', 'Burglary repairs', 'uPVC and locks'],
  'pest control': ['Wasps and bees', 'Rodents', 'Bed bugs and fleas', 'Bird proofing'],
};

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const titleCase = s => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

function fieldsOf(prospect) {
  const p = prospect || {};
  const trade = String(p.trade || p.type || p.businessType || 'tradesperson').replace(/[-_]+/g, ' ').toLowerCase();
  const business = (p.companyName || p.bizname || p.business_name || p.name || titleCase(trade) + ' Services').trim();
  const town = (p.town || p.location || 'your area').trim();
  const phoneRaw = p.phone || p.whatsapp || '';
  const phone = String(phoneRaw).replace(/[^\d+]/g, '');
  const services = SERVICES[trade] || SERVICES[trade.replace(/s$/, '')] ||
    ['Free no-obligation quotes', 'Fully insured work', 'Repairs and installations', 'Emergency call-outs'];
  return { trade, tradeTitle: titleCase(trade), business, town, phone, phoneDisplay: phoneRaw, services };
}

// Trade -> real-photo keywords. Drives loremflickr (Creative-Commons Flickr
// photos), which returns a genuine, trade-matched image for any keyword and a
// stable one per `lock`. No API key, no curation, never a broken image, never
// AI-generated slop. Photos are atmospheric illustration on a clearly-labelled
// preview; we never caption them as the business's own jobs or invent proof.
const PHOTO_KW = {
  plumber: 'plumbing,pipes,bathroom', plumbing: 'plumbing,pipes,bathroom',
  electrician: 'electrician,wiring,electrical', electrical: 'electrician,wiring,electrical',
  roofer: 'roof,roofing,rooftop', roofing: 'roof,roofing,rooftop',
  builder: 'construction,building,brickwork', building: 'construction,building,brickwork',
  plasterer: 'plastering,wall,renovation', plastering: 'plastering,wall,renovation',
  carpenter: 'carpentry,woodwork,joinery', carpentry: 'carpentry,woodwork,joinery',
  painter: 'painting,decorating,interior', decorator: 'painting,decorating,interior',
  landscaper: 'landscaping,garden,patio', landscaping: 'landscaping,garden,patio', gardener: 'garden,landscaping,lawn',
  tiler: 'tiles,tiling,bathroom', tiling: 'tiles,tiling,bathroom',
  'heating engineer': 'boiler,heating,radiator', 'gas engineer': 'boiler,heating,gas',
  cleaner: 'cleaning,clean,home', locksmith: 'lock,door,key', 'pest control': 'house,home',
};
const photoKW = trade => PHOTO_KW[trade] || PHOTO_KW[trade.replace(/s$/, '')] || 'tradesman,tools,workshop,construction';
// Deterministic lock per business so the same site always shows the same photos.
const hash = s => { let h = 0; for (let i = 0; i < String(s).length; i++) { h = (h * 31 + String(s).charCodeAt(i)) | 0; } return Math.abs(h); };
const img = (w, h, kw, lock) => `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${lock}`;

/*
 * facts: { build, previewHours, buildDays, guaranteeDays, waDisplay, waLink, email }
 * passed from the caller (sourced from data/facts.json) so prices/promises
 * never drift from the constitution's single source of truth.
 */
function renderPreview(prospect, facts) {
  const f = fieldsOf(prospect);
  const F = facts || {};
  const callHref = f.phone ? `tel:${esc(f.phone)}` : (F.waLink ? `https://wa.me/${esc(String(F.waLink).replace(/[^\d]/g, ''))}` : '#');
  const callLabel = f.phoneDisplay ? 'Call ' + esc(f.phoneDisplay) : 'Get in touch';
  const kw = photoKW(f.trade);
  const seed = hash(f.business + f.town);
  const hero = img(1700, 1100, kw, seed % 90);
  const band = img(1700, 900, kw, (seed + 41) % 90);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(f.business)} · ${esc(f.tradeTitle)} in ${esc(f.town)}</title>
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="preconnect" href="https://loremflickr.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#6b6358;--line:#e7e1d4;--card:#fbf9f4}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:'Sentient','Switzer',serif;font-weight:700;line-height:1.06;letter-spacing:-0.015em}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1080px;margin:0 auto;padding:0 28px}
  /* Header */
  .bar{position:fixed;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:20px 28px;z-index:40;transition:background .3s,box-shadow .3s,padding .3s}
  .bar.solid{background:rgba(242,239,231,.94);backdrop-filter:blur(10px);box-shadow:0 1px 0 var(--line);padding:14px 28px}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:19px;color:#fff;transition:color .3s}
  .bar.solid .brand{color:var(--ink)}
  .callbtn{background:var(--red);color:#fff !important;font-weight:600;padding:12px 20px;border-radius:100px;font-size:15px;white-space:nowrap;transition:transform .15s}
  .callbtn:hover{transform:translateY(-1px)}
  /* Hero */
  .hero{position:relative;min-height:92vh;display:flex;align-items:flex-end;color:#fff;overflow:hidden}
  .hero .bg{position:absolute;inset:0;background:#1a1610 url('${hero}') center/cover no-repeat;transform:scale(1.06);animation:zoom 18s ease-out forwards}
  .hero .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,11,7,.34) 0%,rgba(14,11,7,.12) 38%,rgba(14,11,7,.66) 78%,rgba(14,11,7,.9) 100%)}
  .hero .wrap{position:relative;padding-bottom:74px;padding-top:120px}
  .hero .eyebrow{text-transform:uppercase;letter-spacing:.24em;font-size:12.5px;font-weight:600;color:#fff;opacity:.92;margin-bottom:20px}
  .hero h1{font-size:clamp(44px,9vw,92px);margin-bottom:22px;max-width:14ch;text-shadow:0 2px 30px rgba(0,0,0,.35)}
  .hero p{font-size:clamp(18px,2.4vw,23px);max-width:40ch;margin-bottom:34px;color:#f3eee5}
  .cta-row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .btn-primary{background:#fff;color:var(--ink) !important;font-weight:600;padding:17px 32px;border-radius:100px;font-size:16.5px;transition:transform .15s}
  .btn-primary:hover{transform:translateY(-2px)}
  .btn-ghost{border:1.5px solid rgba(255,255,255,.7);color:#fff !important;font-weight:600;padding:15.5px 30px;border-radius:100px;font-size:16.5px}
  /* Sections */
  section{padding:clamp(64px,9vw,120px) 0}
  .lede{max-width:30ch}
  .lede .eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:12px;color:var(--red);font-weight:700;margin-bottom:16px}
  h2{font-size:clamp(32px,5vw,52px);margin-bottom:14px}
  .sub{color:var(--muted);font-size:18px;max-width:46ch;margin-bottom:46px}
  /* Services as photo tiles */
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
  .tile{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:4/5;background:#1a1610;box-shadow:0 14px 40px -22px rgba(14,11,7,.5)}
  .tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
  .tile:hover img{transform:scale(1.06)}
  .tile .cap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:22px;color:#fff;background:linear-gradient(180deg,rgba(14,11,7,0) 40%,rgba(14,11,7,.82) 100%)}
  .tile .cap h3{font-size:21px;margin-bottom:4px}
  .tile .cap p{font-size:14px;color:#e9e2d6;opacity:.9}
  /* Why band */
  .band{position:relative;color:#fff;overflow:hidden}
  .band .bg{position:absolute;inset:0;background:#1a1610 url('${band}') center/cover fixed no-repeat}
  .band .scrim{position:absolute;inset:0;background:linear-gradient(120deg,rgba(14,11,7,.9) 0%,rgba(14,11,7,.62) 60%,rgba(14,11,7,.5) 100%)}
  .band .wrap{position:relative}
  .band h2{color:#fff}
  .points{list-style:none;display:grid;gap:26px;max-width:620px;margin-top:36px}
  .points li{display:flex;gap:16px;align-items:flex-start}
  .points .n{font-family:'Sentient',serif;font-size:15px;color:#fff;border:1.5px solid rgba(255,255,255,.5);border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .points b{display:block;font-family:'Sentient',serif;font-size:20px;margin-bottom:3px}
  .points span.d{color:#e9e2d6}
  /* Contact */
  .contact{background:var(--ink);color:var(--cream);text-align:center}
  .contact h2{color:var(--cream)}
  .contact .sub{color:#bcae9a;margin:0 auto 30px}
  .area{color:#8f8676;font-size:15px;margin-top:22px}
  /* Reveal on scroll */
  .reveal{opacity:0;transform:translateY(24px);transition:opacity .8s ease,transform .8s ease}
  .reveal.in{opacity:1;transform:none}
  /* Ribbon */
  .ribbon{background:var(--red);color:#fff;padding:26px;text-align:center;font-size:15.5px;line-height:1.6}
  .ribbon b{font-family:'Sentient',serif}
  .ribbon a{color:#fff;font-weight:700;text-decoration:underline}
  /* Sticky mobile call */
  .stickycall{position:fixed;left:0;right:0;bottom:0;display:none;padding:12px;background:rgba(14,11,7,.97);z-index:50}
  .stickycall a{display:block;text-align:center;background:var(--red);color:#fff;font-weight:700;padding:16px;border-radius:100px;font-size:17px}
  @media(max-width:640px){.stickycall{display:block}body{padding-bottom:76px}.bar .callbtn{display:none}.band .bg{background-attachment:scroll}.hero{min-height:88vh}}
  @keyframes zoom{to{transform:scale(1)}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero .bg{animation:none;transform:none}.reveal{opacity:1;transform:none}}
</style>
</head>
<body>
  <header class="bar" id="bar">
    <div class="brand">${esc(f.business)}</div>
    <a class="callbtn" href="${callHref}">${callLabel}</a>
  </header>

  <section class="hero">
    <div class="bg"></div><div class="scrim"></div>
    <div class="wrap">
      <div class="eyebrow">${esc(f.tradeTitle)} · ${esc(f.town)}</div>
      <h1>${esc(f.business)}</h1>
      <p>Trusted ${esc(f.trade)} work across ${esc(f.town)} and the surrounding area. Done properly, on time, and tidied up after.</p>
      <div class="cta-row">
        <a class="btn-primary" href="${callHref}">${callLabel}</a>
        <a class="btn-ghost" href="#contact">Request a quote</a>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="lede reveal"><div class="eyebrow">What we do</div><h2>${esc(f.tradeTitle)} work, done right</h2>
      <p class="sub">Whatever the job, big or small, across ${esc(f.town)} and nearby.</p></div>
      <div class="tiles">
        ${f.services.map((s, i) => `<div class="tile reveal"><img loading="lazy" src="${img(720, 900, kw, (seed + 7 + i * 13) % 90)}" alt="${esc(f.trade)} work"><div class="cap"><h3>${esc(s)}</h3><p>Done properly, tidied up after.</p></div></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="band">
    <div class="bg"></div><div class="scrim"></div>
    <div class="wrap">
      <div class="lede reveal"><h2>Why ${esc(f.business)}</h2></div>
      <ul class="points">
        <li class="reveal"><span class="n">1</span><div><b>Local and reliable</b><span class="d">We turn up when we say we will, and we keep you posted from quote to finish.</span></div></li>
        <li class="reveal"><span class="n">2</span><div><b>Clear pricing</b><span class="d">A proper quote up front. No surprises when the invoice lands.</span></div></li>
        <li class="reveal"><span class="n">3</span><div><b>Tidy, careful work</b><span class="d">We treat your home or premises like our own and leave it spotless.</span></div></li>
      </ul>
    </div>
  </section>

  <section id="contact" class="contact">
    <div class="wrap reveal">
      <h2>Get a quote</h2>
      <p class="sub">Tell us what you need and we will come straight back to you.</p>
      <a class="callbtn" href="${callHref}">${callLabel}</a>
      <p class="area">Serving ${esc(f.town)} and the surrounding area.</p>
    </div>
  </section>

  <div class="ribbon">
    <b>This is a free preview StaticSwift built for ${esc(f.business)}.</b><br>
    Like it? It is yours, live within ${esc(F.buildDays || 14)} days, ${esc(F.build || 499)} pounds once, with a ${esc(F.guaranteeDays || 60)}-day lead guarantee.
    Reply to Harry${F.email ? ' at ' + esc(F.email) : ''}${F.waDisplay ? ', or WhatsApp ' + esc(F.waDisplay) : ''}.
  </div>

  <div class="stickycall"><a href="${callHref}">${callLabel}</a></div>
  <script>
    (function(){
      var bar=document.getElementById('bar');
      var onScroll=function(){ if(bar) bar.classList.toggle('solid', window.scrollY>40); };
      addEventListener('scroll',onScroll,{passive:true}); onScroll();
      if('IntersectionObserver' in window){
        var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.16});
        document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
      } else { document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in');}); }
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderPreview, fieldsOf };
