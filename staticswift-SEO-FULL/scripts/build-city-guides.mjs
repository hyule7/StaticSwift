/*
 * build-city-guides.mjs — editorial city guides under /guides/website-design-{city}/.
 *
 * These are NOT thin duplicates of the estate hubs. Each is a genuine, honest
 * guide to getting and ranking a website as a tradesperson in that city, that
 * links INTO the city's real estate hub and real trade pages. That internal
 * cross-linking is exactly what helps Google discover and rank the estate
 * (the SEO Director's "index coverage beats page count"), while giving each
 * guide unique, non-duplicate value (the real local links differ per city).
 *
 * Only links pages that actually exist on disk, so no broken internal links.
 * Run: node scripts/build-city-guides.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const P = { build: F.pricing.starter.build, mo: F.pricing.starter.monthly_optional, preview: F.delivery.preview_hours, days: F.delivery.build_days, guar: F.guarantee.days, waLink: F.contact.whatsapp, email: F.contact.email };
const SITE = 'https://staticswift.co.uk';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const waDigits = P.waLink.replace(/[^\d]/g, '');
const titleCase = s => s.replace(/[-\s]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const DISPLAY = { hull: 'Hull', york: 'York', 'stoke-on-trent': 'Stoke-on-Trent', 'newcastle': 'Newcastle' };
const cityName = slug => DISPLAY[slug] || titleCase(slug);

// Trades we will link to for a city, if that trade+city page exists.
const TRADES = [
  ['plumber', 'plumbers'], ['electrician', 'electricians'], ['builder', 'builders'], ['roofer', 'roofers'],
  ['plasterer', 'plasterers'], ['painter-decorator', 'painters and decorators'], ['joiner', 'joiners'],
  ['gardener', 'gardeners'], ['tiler', 'tilers'], ['mechanic', 'mechanics'], ['barber', 'barbers'],
  ['cleaning-company', 'cleaners'], ['scaffolder', 'scaffolders'], ['locksmith', 'locksmiths'],
];

function tradeLinks(citySlug) {
  const out = [];
  for (const [slug, label] of TRADES) {
    if (existsSync(join(ROOT, `${slug}-website-design-${citySlug}`))) {
      out.push(`<a href="/${slug}-website-design-${citySlug}/">${esc(label.replace(/^\w/, c => c.toUpperCase()))} in ${esc(cityName(citySlug))}</a>`);
    }
    if (out.length >= 10) break;
  }
  return out;
}

function page(slug) {
  const city = cityName(slug);
  const url = `${SITE}/guides/website-design-${slug}/`;
  const hubExists = existsSync(join(ROOT, `website-design-${slug}`));
  const hubHref = hubExists ? `/website-design-${slug}/` : '/';
  const links = tradeLinks(slug);
  const faqs = [
    { q: `How much does a website cost for a ${city} business?`, a: `Around ${P.build} pounds for a one-off hand-coded site with StaticSwift, or roughly 15 to 40 pounds a month on a DIY builder. In ${city} as anywhere, the one-off usually works out cheaper over a couple of years and you own it outright. See a free preview first, no card.` },
    { q: `How do I rank on Google in ${city}?`, a: `Claim and fill in your free Google Business Profile, gather genuine reviews, and have a fast website that names your trade and ${city}. Those three do most of the work for local ${city} searches. There is no instant number one, and anyone guaranteeing it is not being straight.` },
    { q: `Can you build a website for my ${city} trade quickly?`, a: `Yes. StaticSwift builds a free working preview within ${P.preview} hours from a short brief, and takes it live within ${P.days} days. You only pay the ${P.build} pounds if you keep it, with a ${P.guar}-day lead guarantee.` },
  ];
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: `Website design in ${city} for tradespeople`, description: `An honest guide to getting a website in ${city}: what it costs, what local trades need, and how to rank in ${city} on Google.`, author: { '@type': 'Person', name: 'Harry Yule' }, publisher: { '@id': `${SITE}/#org` }, mainEntityOfPage: url };
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE + '/guides/' }, { '@type': 'ListItem', position: 3, name: `Website design in ${city}`, item: url }] };
  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Website design in ${esc(city)} for tradespeople | StaticSwift</title>
<meta name="description" content="An honest guide to getting a website in ${esc(city)}: what it costs, what local trades need, and how to rank in ${esc(city)} on Google. Free preview in ${P.preview} hours.">
<link rel="canonical" href="${url}">
<meta property="og:title" content="Website design in ${esc(city)} for tradespeople">
<meta property="og:description" content="What a website costs in ${esc(city)}, what local trades need, and how to rank locally.">
<meta property="og:type" content="article"><meta property="og:url" content="${url}">
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(article)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#5A4E40;--line:#e2dccf;--card:#fbf9f4}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.65}
  h1,h2,h3{font-family:'Sentient',Georgia,serif;font-weight:700;line-height:1.12;letter-spacing:-.015em}
  a{color:var(--red)}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  header{padding:20px 22px;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;justify-content:space-between;align-items:center;padding:0}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
  .brand span{color:var(--red)}
  .crumb{font-size:13px;color:var(--muted);padding:20px 0 0}.crumb a{color:var(--muted)}
  article{padding:14px 0 40px}
  h1{font-size:clamp(30px,6vw,46px);margin:10px 0 20px}
  .lead{font-size:20px;line-height:1.6;margin-bottom:8px}
  h2{font-size:clamp(22px,4vw,30px);margin:38px 0 12px}
  p{margin-bottom:16px;font-size:17px}
  .localgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:14px 0}
  .localgrid a{display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:var(--ink);text-decoration:none;font-weight:500;font-size:15px}
  .localgrid a:hover{border-color:var(--red);color:var(--red)}
  .hublink{display:inline-block;margin-top:8px;font-weight:600}
  .cta{background:var(--ink);color:var(--cream);border-radius:18px;padding:28px;margin:40px 0;text-align:center}
  .cta h2{color:var(--cream);margin-top:0}.cta p{color:#cabfae}
  .btnrow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
  .btn{background:#fff;color:var(--ink);text-decoration:none;font-weight:600;padding:14px 26px;border-radius:100px;font-size:16px}.btn.wa{background:var(--red);color:#fff}
  .faq{border-top:1px solid var(--line);margin-top:34px;padding-top:10px}.faq h3{font-size:19px;margin:20px 0 6px}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${SITE}/">Static<span>Swift</span></a><a href="${SITE}/guides/" style="font-size:14px;color:var(--ink);text-decoration:none">Guides</a></div></header>
<div class="wrap">
  <div class="crumb"><a href="${SITE}/">Home</a> / <a href="${SITE}/guides/">Guides</a> / Website design in ${esc(city)}</div>
  <article>
    <h1>Website design in ${esc(city)} for tradespeople</h1>
    <p class="lead">If you run a trade business in ${esc(city)} and need a website, here is the honest version: a hand-coded site costs around ${P.build} pounds as a one-off, a free working preview can be in your inbox within ${P.preview} hours, and getting found on Google in ${esc(city)} comes down to your Google Business Profile, real reviews, and a fast local website. This guide covers what it costs, what a ${esc(city)} trade site needs, and how to rank locally.</p>

    <h2>What a website costs in ${esc(city)}</h2>
    <p>Prices in ${esc(city)} are the same as anywhere in the UK: roughly 15 to 40 pounds a month on a DIY builder like Wix, a few hundred to a few thousand from a ${esc(city)} agency or freelancer, or a fixed ${P.build} pounds once for a hand-coded site from a productised service like StaticSwift. The one-off usually works out cheaper over two or three years and you own it outright. StaticSwift shows you a free preview first, so there is no risk in seeing what yours would look like.</p>

    <h2>What a ${esc(city)} trade website needs</h2>
    <p>Whatever your trade, the same few things win calls: it loads fast on a phone, a click-to-call button is easy to reach, it names your services and that you cover ${esc(city)} and nearby, and it shows real reviews. Most enquiries come from someone on a phone searching in a hurry, so making it dead easy to call you is the whole job.</p>

    <h2>How to rank in ${esc(city)} on Google</h2>
    <p>To show up when someone in ${esc(city)} searches for your trade: claim and fully fill in your free Google Business Profile, ask every happy customer for a review with a direct link, and have a fast website that names your trade and ${esc(city)}. Those three move the needle most for local searches. There is no instant number one, and a young website earns its place over time with reviews and a few genuine links. Anyone promising a guaranteed top spot tomorrow is not being straight with you.</p>

    ${links.length ? `<h2>Websites for specific trades in ${esc(city)}</h2>
    <p>We build for every trade. A few of the ${esc(city)} pages:</p>
    <div class="localgrid">
      ${links.join('\n      ')}
    </div>
    <a class="hublink" href="${hubHref}">See all website design in ${esc(city)} &rarr;</a>` : `<p><a class="hublink" href="${hubHref}">See website design in ${esc(city)} &rarr;</a></p>`}

    <div class="cta">
      <h2>Want to see your ${esc(city)} website?</h2>
      <p>Free working preview within ${P.preview} hours. ${P.build} pounds once if you keep it, ${P.guar}-day lead guarantee.</p>
      <div class="btnrow"><a class="btn" href="${SITE}/order.html?town=${esc(city)}">Get my free preview</a><a class="btn wa" href="https://wa.me/${waDigits}">WhatsApp Harry</a></div>
    </div>

    <div class="faq">
      <h2>Common questions</h2>
      ${faqs.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n      ')}
    </div>
  </article>
</div>
<footer><div class="wrap">StaticSwift · Hand-coded websites for UK trades · Manchester · <a href="mailto:${P.email}">${P.email}</a></div></footer>
</body>
</html>`;
}

// Auto-discover every city that has an estate hub AND enough real trade pages
// to link to, so each guide is genuinely substantive (real internal links, not
// a thin doorway). This scales the city guides across the whole estate while
// keeping each one worth indexing.
const MIN_TRADES = 6;   // only cities with at least this many linkable trade pages
const hubSlugs = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && /^website-design-[a-z0-9-]+$/.test(d.name))
  .map(d => d.name.replace(/^website-design-/, ''));
const CITY_SLUGS = hubSlugs
  .filter(slug => tradeLinks(slug).length >= MIN_TRADES)
  .sort();
console.log(`Discovered ${hubSlugs.length} city hubs; ${CITY_SLUGS.length} qualify (>= ${MIN_TRADES} trade pages).`);

let n = 0; const built = [];
for (const slug of CITY_SLUGS) {
  const dir = join(ROOT, 'guides', `website-design-${slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(slug));
  built.push(slug); n++;
}

// Sitemap for the city guides.
const today = new Date().toISOString().slice(0, 10);
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  built.map(s => `  <url><loc>${SITE}/guides/website-design-${s}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('\n') +
  `\n</urlset>\n`;
writeFileSync(join(ROOT, 'sitemap-city-guides.xml'), sm);

// Link the city guides from the /guides/ index so Google crawls them.
try {
  const idxPath = join(ROOT, 'guides', 'index.html');
  let idx = readFileSync(idxPath, 'utf8');
  const cityBlock = `  <div class="list" id="city-guides"><h2 style="font-size:26px;margin:34px 0 6px">Website design by city</h2>\n    ` +
    built.map(s => `<a href="/guides/website-design-${s}/">Website design in ${esc(cityName(s))}</a>`).join('\n    ') +
    `\n  </div>`;
  // Remove any prior injected block (idempotent), then insert inside .wrap,
  // right after the topic list and before the wrap-closing div + footer.
  idx = idx.replace(/\s*<div class="list" id="city-guides">[\s\S]*?<\/div>(?=\s*<\/div>\s*<footer)/, '');
  idx = idx.replace(/(\n  <\/div>\n)<\/div>\n<footer/, `$1${cityBlock}\n</div>\n<footer`);
  writeFileSync(idxPath, idx);
} catch (e) { console.warn('index link injection skipped:', e.message); }

console.log(`Built ${n} city guides + sitemap-city-guides.xml + linked from /guides/`);
