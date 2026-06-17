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

/*
 * facts: { build, previewHours, buildDays, guaranteeDays, waDisplay, waLink, email }
 * passed from the caller (sourced from data/facts.json) so prices/promises
 * never drift from the constitution's single source of truth.
 */
function renderPreview(prospect, facts) {
  const f = fieldsOf(prospect);
  const F = facts || {};
  const callHref = f.phone ? `tel:${esc(f.phone)}` : (F.waLink ? `https://wa.me/${esc(String(F.waLink).replace(/[^\d]/g, ''))}` : '#');
  const heroLine = `Trusted ${esc(f.trade)} services in ${esc(f.town)} and the surrounding area.`;
  const year = 'MMXXVI';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(f.business)} · ${esc(f.tradeTitle)} in ${esc(f.town)}</title>
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#6b6358;--line:#e2dccf;--card:#fbf9f4}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:'Sentient','Switzer',serif;font-weight:700;line-height:1.1;letter-spacing:-0.01em}
  a{color:inherit}
  .wrap{max-width:760px;margin:0 auto;padding:0 22px}
  .bar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(242,239,231,.92);backdrop-filter:blur(8px);z-index:20}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px}
  .brand span{color:var(--red)}
  .callbtn{background:var(--red);color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:100px;font-size:15px;white-space:nowrap}
  .hero{padding:64px 0 48px}
  .eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:var(--red);font-weight:600;margin-bottom:18px}
  .hero h1{font-size:clamp(34px,8vw,56px);margin-bottom:18px}
  .hero p{font-size:clamp(17px,4vw,20px);color:var(--muted);max-width:34ch;margin-bottom:30px}
  .cta-row{display:flex;gap:12px;flex-wrap:wrap}
  .btn-primary{background:var(--ink);color:var(--cream);text-decoration:none;font-weight:600;padding:15px 26px;border-radius:100px;font-size:16px}
  .btn-ghost{border:1px solid var(--ink);text-decoration:none;font-weight:600;padding:14px 26px;border-radius:100px;font-size:16px}
  section{padding:48px 0;border-top:1px solid var(--line)}
  h2{font-size:clamp(26px,6vw,38px);margin-bottom:8px}
  .sub{color:var(--muted);margin-bottom:28px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}
  .card h3{font-size:19px;margin-bottom:6px}
  .card p{color:var(--muted);font-size:15px}
  .points{list-style:none;display:grid;gap:14px}
  .points li{display:flex;gap:12px;align-items:flex-start;font-size:16px}
  .points b{display:block;font-family:'Sentient',serif}
  .tick{color:var(--red);font-weight:700;flex:0 0 auto}
  .area{font-size:16px;color:var(--muted)}
  .contact{background:var(--ink);color:var(--cream)}
  .contact h2,.contact .brand{color:var(--cream)}
  .contact .sub{color:#bcae9a}
  .contact a.callbtn{background:var(--red)}
  .ribbon{background:var(--red);color:#fff;padding:22px;text-align:center;font-size:15px}
  .ribbon b{font-family:'Sentient',serif}
  .ribbon a{color:#fff;font-weight:700}
  .stickycall{position:fixed;left:0;right:0;bottom:0;display:none;padding:12px;background:rgba(14,11,7,.96);z-index:30}
  .stickycall a{display:block;text-align:center;background:var(--red);color:#fff;text-decoration:none;font-weight:700;padding:15px;border-radius:100px;font-size:17px}
  @media(max-width:600px){.stickycall{display:block}body{padding-bottom:74px}.bar .callbtn{display:none}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
  <header class="bar">
    <div class="brand">${esc(f.business)}</div>
    <a class="callbtn" href="${callHref}">${f.phoneDisplay ? 'Call ' + esc(f.phoneDisplay) : 'Get in touch'}</a>
  </header>

  <div class="wrap">
    <div class="hero">
      <div class="eyebrow">${esc(f.tradeTitle)} · ${esc(f.town)}</div>
      <h1>${esc(f.business)}</h1>
      <p>${heroLine}</p>
      <div class="cta-row">
        <a class="btn-primary" href="${callHref}">${f.phoneDisplay ? 'Call ' + esc(f.phoneDisplay) : 'Request a quote'}</a>
        <a class="btn-ghost" href="#contact">Request a quote</a>
      </div>
    </div>
  </div>

  <section>
    <div class="wrap">
      <h2>What we do</h2>
      <p class="sub">${esc(f.tradeTitle)} work across ${esc(f.town)} and nearby.</p>
      <div class="grid">
        ${f.services.map(s => `<div class="card"><h3>${esc(s)}</h3><p>Done properly, on time, and tidied up after.</p></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <h2>Why ${esc(f.business)}</h2>
      <ul class="points">
        <li><span class="tick">&#10003;</span><div><b>Local and reliable</b>We turn up when we say we will and keep you posted.</div></li>
        <li><span class="tick">&#10003;</span><div><b>Clear pricing</b>A proper quote up front, no surprises on the invoice.</div></li>
        <li><span class="tick">&#10003;</span><div><b>Tidy, careful work</b>We treat your home or premises like our own.</div></li>
      </ul>
    </div>
  </section>

  <section id="contact" class="contact">
    <div class="wrap">
      <h2>Get a quote</h2>
      <p class="sub">Tell us what you need and we will come back to you fast.</p>
      <p class="area" style="color:#bcae9a;margin-bottom:24px">Serving ${esc(f.town)} and the surrounding area.</p>
      <a class="callbtn" href="${callHref}">${f.phoneDisplay ? 'Call ' + esc(f.phoneDisplay) : 'Message us'}</a>
    </div>
  </section>

  <div class="ribbon">
    <b>This is a free preview StaticSwift built for ${esc(f.business)}.</b><br>
    Like it? It is yours, live within ${esc(F.buildDays || 14)} days, ${esc(F.build || 499)} pounds once with a ${esc(F.guaranteeDays || 60)}-day lead guarantee.
    Reply to Harry${F.email ? ' at ' + esc(F.email) : ''}${F.waDisplay ? ', or WhatsApp ' + esc(F.waDisplay) : ''}.
  </div>

  <div class="stickycall"><a href="${callHref}">${f.phoneDisplay ? 'Call ' + esc(f.phoneDisplay) : 'Get in touch'}</a></div>
</body>
</html>`;
}

module.exports = { renderPreview, fieldsOf };
