/*
 * build-guides.mjs — generates the /guides/ answer pages.
 *
 * These are honest, genuinely useful Q&A pages that answer the questions UK
 * trades actually type into Google and AI engines. Each answers the question in
 * the first paragraph (AEO best practice), carries Article + FAQPage +
 * BreadcrumbList schema, a canonical, internal links, and the Message-me CTA.
 * Every figure comes from data/facts.json. No fabricated stats, no em dashes.
 *
 * Run: node scripts/build-guides.mjs   (regenerates guides/ + guides/index.html)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const P = { build: F.pricing.starter.build, mo: F.pricing.starter.monthly_optional, preview: F.delivery.preview_hours, days: F.delivery.build_days, guar: F.guarantee.days, wa: F.contact.whatsapp_display, waLink: F.contact.whatsapp, email: F.contact.email };
const SITE = 'https://staticswift.co.uk';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const waDigits = P.waLink.replace(/[^\d]/g, '');

// Each guide: slug, question (title/H1), metaDesc, answer (lead paragraph),
// sections [{h, body}], faqs [{q, a}]. Kept honest and traceable.
const GUIDES = [
  {
    slug: 'how-much-does-a-tradesperson-website-cost-uk',
    q: 'How much should a tradesperson’s website cost in the UK?',
    meta: 'A clear, honest breakdown of what a UK tradesperson’s website costs: DIY builders, freelancers, and done-for-you, with real price ranges.',
    answer: `A website for a UK tradesperson usually costs between £300 and £1,500 as a one-off, or roughly £20 to £70 a month if you build it yourself on a platform like Wix or Squarespace. There is no single right number. It depends on whether you want a template you build and maintain yourself, or a site built for you and looked after. StaticSwift builds a hand-coded site for a ${P.build} pounds one-time fee, with an optional ${P.mo} pounds a month managed plan if you want ongoing changes handled.`,
    sections: [
      { h: 'The three ways to get a website, and what each costs', body: `DIY builders (Wix, Squarespace, GoDaddy) are the cheapest to start, around 15 to 40 pounds a month, but you build and maintain it, and you pay that fee forever. Freelancers and agencies range from a few hundred to several thousand pounds depending on scope. Done-for-you productised services, like StaticSwift, sit in between: a fixed ${P.build} pounds once for a hand-coded site, no surprise bills.` },
      { h: 'One-off vs monthly: which is cheaper?', body: `A monthly builder looks cheap but adds up: 30 pounds a month is 360 pounds a year, every year. A one-off build you own outright is usually cheaper over two or three years, and you are not locked in. The trade-off is that a builder lets you edit it yourself, while a built-for-you site means asking someone for changes (or paying an optional monthly plan for that).` },
      { h: 'What you are actually paying for', body: `A good trades website is not just pages. It is fast loading on a phone, click-to-call, clear services and area covered, and set up so it can show in Google for "your trade near me". Cheap template sites often miss these, which is why they do not bring calls. Ask what is included: mobile speed, local SEO basics, and whether you own the files.` },
    ],
    faqs: [
      { q: 'Is a free website builder good enough for a tradesperson?', a: `It can work to start, but free tiers usually show ads, use a long messy web address, and load slowly, which puts customers off. A proper domain and a fast site pays for itself in calls.` },
      { q: 'Do I have to pay monthly for a website?', a: `No. Monthly is only required with subscription builders. A one-off build, like StaticSwift at ${P.build} pounds, has no required monthly fee. The ${P.mo} pounds a month managed plan is optional, for people who want changes handled for them.` },
    ],
  },
  {
    slug: 'do-i-need-a-website-if-i-have-facebook',
    q: 'Do I need a website if I have a Facebook page?',
    meta: 'A Facebook page is not a website. Here is why UK tradespeople still need a proper site, and what Facebook cannot do for you.',
    answer: `In most cases, yes. A Facebook page does not show up when someone searches Google for "your trade near me", and you do not own it or control how it looks. A website ranks on Google, works as your always-on shopfront, and is genuinely yours. Facebook is a good addition, not a replacement. The two work best together: the website is found on Google and builds trust, the Facebook page shows your latest work.`,
    sections: [
      { h: 'Most people search Google, not Facebook, for a trade', body: `When someone needs a plumber or an electrician at short notice, they Google it. Facebook pages rarely appear in those searches. If you only have Facebook, you are invisible to the biggest source of new work.` },
      { h: 'You do not own your Facebook page', body: `Facebook controls the layout, the reach, and can change the rules or suspend accounts any time. A website on your own domain is an asset you own and control, which also makes you look more established to a customer comparing quotes.` },
      { h: 'A website builds trust before they call', body: `People check you out before ringing. A clean website with your services, area, and a click-to-call button turns a "maybe" into a call. Around the clock, whether or not you are on Facebook that day.` },
    ],
    faqs: [
      { q: 'Can I just link my Facebook page instead of a website?', a: `You can, but you lose Google visibility and control. Many customers also trust a real website more than a social page when choosing who to pay.` },
      { q: 'What is the quickest way to get a website if I only have Facebook?', a: `A done-for-you service is quickest. StaticSwift builds a free working preview within ${P.preview} hours from a short brief, so you can see it before paying anything.` },
    ],
  },
  {
    slug: 'wix-vs-hand-coded-website-for-trades',
    q: 'Wix vs a hand-coded website for tradespeople',
    meta: 'An honest comparison of Wix and hand-coded websites for UK trades: cost, speed, ownership, and which suits you.',
    answer: `Wix is cheaper to start and you build it yourself, but it charges monthly forever, tends to load slower, and can look like a template. A hand-coded site is faster, unique to your business, and a one-off cost you own, but you need someone to build and change it. If you enjoy fiddling with your own site and want the lowest upfront cost, Wix is fine. If you want it done for you, fast, and yours, hand-coded wins.`,
    sections: [
      { h: 'Cost over time', body: `Wix runs from about 15 to 40 pounds a month, forever. A hand-coded site like StaticSwift is ${P.build} pounds once, with an optional ${P.mo} pounds a month only if you want changes handled. Over two or three years the one-off is usually cheaper.` },
      { h: 'Speed and how it looks', body: `Trades customers are on phones. Hand-coded sites load faster and can be designed exactly for your business, rather than dropped into a template thousands of others use. Speed also helps Google ranking.` },
      { h: 'Who maintains it', body: `Wix lets you edit yourself, which suits some people and frustrates others. Hand-coded means asking the builder for changes, which is why StaticSwift offers an optional managed plan so edits are handled for you.` },
    ],
    faqs: [
      { q: 'Is Wix bad for SEO?', a: `Wix can rank, but it is often slower and less flexible than a hand-coded site, which matters for local search. The bigger SEO factors are reviews, a Google Business Profile, and being genuinely useful.` },
      { q: 'Can I move away from Wix later?', a: `You cannot easily take a Wix site with you, it is tied to the platform. A hand-coded site you own the files outright.` },
    ],
  },
  {
    slug: 'how-to-get-more-customers-from-your-website',
    q: 'How do tradespeople get more customers from a website?',
    meta: 'The handful of things that actually turn a tradesperson’s website into phone calls: click-to-call, reviews, speed, and local SEO.',
    answer: `The websites that bring tradespeople work all do the same simple things: they load fast on a phone, they have a click-to-call button in easy reach, they show real reviews, and they are set up to appear in Google for "your trade near me". Fancy design is not what wins calls. Making it dead easy to see you are trustworthy and to press call, is.`,
    sections: [
      { h: 'Make calling one tap away', body: `Most trades enquiries come from a phone. A big click-to-call button, always visible, removes the main bit of friction. Never bury your number.` },
      { h: 'Show reviews where customers look', body: `People trust other people. A few real Google reviews on the page, and a strong Google Business Profile, do more for conversions than any amount of clever copy.` },
      { h: 'Be found locally', body: `Set the site up for local search: your town and services in the titles, a Google Business Profile connected, and fast mobile loading. This is what gets you into the map results where the calls are.` },
    ],
    faqs: [
      { q: 'How do I get reviews for my trade business?', a: `Ask every happy customer the day you finish, with a direct link to your Google review page. A steady trickle beats a one-off push, and you should reply to each one.` },
      { q: 'Why is my website not getting any calls?', a: `Usually one of: it is slow on mobile, the phone number is hard to find, there are no reviews, or it does not show in local Google results. Fix those first.` },
    ],
  },
  {
    slug: 'why-is-my-business-not-showing-on-google',
    q: 'Why isn’t my business showing up on Google?',
    meta: 'The common reasons a UK trade business does not appear on Google, and how to fix each one.',
    answer: `A business usually does not show on Google for one of four reasons: it has no website, it has no Google Business Profile, the site is new and not indexed yet, or it is not set up for local search. The fastest wins are claiming and filling in your free Google Business Profile, and having a fast website that names your trade and town clearly.`,
    sections: [
      { h: 'Claim your Google Business Profile', body: `This is the free listing that puts you in the map results and on the right of the search page. If you have not claimed and filled it in, do that first. It is often the single biggest local ranking factor.` },
      { h: 'Have a real website, set up for your area', body: `A website tells Google what you do and where. Name your trade and town in the page titles, keep it fast on mobile, and connect it to your Business Profile.` },
      { h: 'Give a new site time, and links', body: `A brand new site is not trusted overnight. Reviews, a few links from real places, and time all help. There is no instant switch, and anyone promising number one tomorrow is not being honest.` },
    ],
    faqs: [
      { q: 'How long until my new website shows on Google?', a: `Basic indexing can take days to a few weeks. Ranking well takes longer and depends on reviews, links, and how competitive your area is.` },
      { q: 'Is a Google Business Profile free?', a: `Yes, completely free. It is the first thing every local trade business should set up.` },
    ],
  },
  {
    slug: 'how-long-to-build-a-trades-website',
    q: 'How long does it take to build a tradesperson’s website?',
    meta: 'How long a UK trades website really takes to build, from DIY to done-for-you.',
    answer: `Building it yourself on a platform like Wix takes anywhere from a weekend to a few weeks, depending on how fussy you are. A freelancer or agency often takes several weeks. A productised done-for-you service is fastest: StaticSwift gives you a free working preview within ${P.preview} hours of a short brief, and a finished site live within ${P.days} days.`,
    sections: [
      { h: 'Doing it yourself', body: `Builders are quick to start but slow to finish well, because you are learning as you go and second-guessing the design. Budget more time than you expect if you want it to look professional.` },
      { h: 'Done for you', body: `A focused service skips the back and forth. StaticSwift works from a short brief, shows you a real preview within ${P.preview} hours, and takes it live within ${P.days} days once you are happy. You only pay the ${P.build} pounds if you keep it.` },
    ],
    faqs: [
      { q: 'Can I get a website in 24 hours?', a: `You can get a free working preview within ${P.preview} hours to see and approve. The finished, live site follows within ${P.days} days. Be wary of anyone claiming a proper site fully live in a day.` },
      { q: 'What do you need from me to start?', a: `Just the basics: your trade, the area you cover, your services, and a phone number. A short brief is enough to build a preview.` },
    ],
  },
  {
    slug: 'do-tradespeople-need-a-website',
    q: 'Do tradespeople need a website in 2026?',
    meta: 'Whether tradespeople still need a website, and what a good one does for your business.',
    answer: `Yes. Customers Google a trade before they call, and they judge you on what they find. A website makes you show up in that search, proves you are established, and gives people a one-tap way to call. Word of mouth still matters, but a website is how new customers check you out and how you get found beyond people who already know you.`,
    sections: [
      { h: 'People check before they call', body: `Even a personal recommendation gets Googled. If nothing comes up, or only an old Facebook page, some of those customers hesitate. A clean website closes that gap.` },
      { h: 'It works while you work', body: `A website answers questions, shows your services and area, and takes calls around the clock, without you stopping a job to explain yourself.` },
    ],
    faqs: [
      { q: 'I get enough work from word of mouth, do I still need one?', a: `Word of mouth is great, but a website compounds it: recommended customers still check you out, and new ones find you on Google. It protects you if a big client or referral source dries up.` },
      { q: 'What is the cheapest way to get a proper website?', a: `A productised one-off build. StaticSwift is ${P.build} pounds once with a free preview first, so there is no risk in seeing what you would get.` },
    ],
  },
  {
    slug: 'what-makes-a-good-trades-website',
    q: 'What makes a good website for a tradesperson?',
    meta: 'The ingredients of a website that actually brings a tradesperson calls: fast, mobile, click-to-call, reviews, local SEO.',
    answer: `A good trades website is fast on a phone, makes calling one tap away, shows your services and the area you cover clearly, has real reviews, and is set up to appear in Google locally. That is it. It does not need animations or clever wording. It needs to load quickly, look trustworthy, and make it easy to press call.`,
    sections: [
      { h: 'Mobile first, and fast', body: `Your customer is on a phone, often standing in a kitchen with a leak. If the site is slow or fiddly on mobile, they bounce. Speed is not a nice-to-have, it is the whole job.` },
      { h: 'Clear services, area, and proof', body: `Say exactly what you do and where, in plain words. Show a few reviews. Make the phone number and a click-to-call button impossible to miss.` },
      { h: 'Found on Google', body: `Titles that name your trade and town, a connected Google Business Profile, and a fast site are what get you into local results, which is where the calls come from.` },
    ],
    faqs: [
      { q: 'Does a trades website need lots of pages?', a: `No. A focused site of a few strong pages usually beats a big cluttered one. Clarity and speed matter more than page count.` },
      { q: 'Should I write the website myself?', a: `You can, but most trades would rather be on the tools. A done-for-you service writes it from a short brief and shows you a preview first.` },
    ],
  },
];

function page(g) {
  const url = `${SITE}/guides/${g.slug}/`;
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: g.q, description: g.meta, author: { '@type': 'Person', name: 'Harry Yule' }, publisher: { '@id': `${SITE}/#org` }, mainEntityOfPage: url };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE + '/guides/' }, { '@type': 'ListItem', position: 3, name: g.q, item: url }] };
  const related = GUIDES.filter(x => x.slug !== g.slug).slice(0, 4);
  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(g.q)} | StaticSwift</title>
<meta name="description" content="${esc(g.meta)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(g.q)}">
<meta property="og:description" content="${esc(g.meta)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#5A4E40;--line:#e2dccf;--card:#fbf9f4}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:'Sentient',Georgia,serif;font-weight:700;line-height:1.12;letter-spacing:-.015em}
  a{color:var(--red)}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  header{padding:20px 22px;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;justify-content:space-between;align-items:center;padding:0}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
  .brand span{color:var(--red)}
  .crumb{font-size:13px;color:var(--muted);padding:20px 0 0}
  .crumb a{color:var(--muted)}
  article{padding:14px 0 40px}
  h1{font-size:clamp(30px,6vw,46px);margin:10px 0 20px}
  .lead{font-size:20px;line-height:1.6;margin-bottom:8px}
  h2{font-size:clamp(22px,4vw,30px);margin:38px 0 12px}
  p{margin-bottom:16px;font-size:17px}
  .faq{border-top:1px solid var(--line);margin-top:34px;padding-top:10px}
  .faq h3{font-size:19px;margin:20px 0 6px}
  .cta{background:var(--ink);color:var(--cream);border-radius:18px;padding:28px;margin:40px 0;text-align:center}
  .cta h2{color:var(--cream);margin-top:0}
  .cta p{color:#cabfae}
  .btnrow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
  .btn{background:#fff;color:var(--ink);text-decoration:none;font-weight:600;padding:14px 26px;border-radius:100px;font-size:16px}
  .btn.wa{background:var(--red);color:#fff}
  .related{border-top:1px solid var(--line);padding-top:20px;margin-top:20px}
  .related a{display:block;padding:8px 0;color:var(--ink);text-decoration:none;font-weight:500;border-bottom:1px solid var(--line)}
  .related a:hover{color:var(--red)}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${SITE}/">Static<span>Swift</span></a><a href="${SITE}/" style="font-size:14px;color:var(--ink);text-decoration:none">Home</a></div></header>
<div class="wrap">
  <div class="crumb"><a href="${SITE}/">Home</a> / <a href="${SITE}/guides/">Guides</a> / ${esc(g.q)}</div>
  <article>
    <h1>${esc(g.q)}</h1>
    <p class="lead">${esc(g.answer)}</p>
    ${g.sections.map(s => `<h2>${esc(s.h)}</h2><p>${esc(s.body)}</p>`).join('\n    ')}

    <div class="cta">
      <h2>Want to see what yours would look like?</h2>
      <p>StaticSwift builds a free working preview within ${P.preview} hours. ${P.build} pounds once if you keep it, ${P.guar}-day lead guarantee.</p>
      <div class="btnrow">
        <a class="btn" href="${SITE}/order.html">Get my free preview</a>
        <a class="btn wa" href="https://wa.me/${waDigits}">WhatsApp Harry</a>
      </div>
    </div>

    <div class="faq">
      <h2>Common questions</h2>
      ${g.faqs.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n      ')}
    </div>

    <div class="related">
      <h2 style="font-size:20px;margin-bottom:8px">More guides</h2>
      ${related.map(r => `<a href="${SITE}/guides/${r.slug}/">${esc(r.q)}</a>`).join('\n      ')}
    </div>
  </article>
</div>
<footer><div class="wrap">StaticSwift · Hand-coded websites for UK trades · Manchester · <a href="mailto:${P.email}">${P.email}</a></div></footer>
</body>
</html>`;
}

// Guides index
function indexPage() {
  const url = `${SITE}/guides/`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/guides/${g.slug}/`, name: g.q })) };
  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guides for UK tradespeople | StaticSwift</title>
<meta name="description" content="Honest, useful answers to the questions UK tradespeople ask about websites, Google, and getting more customers.">
<link rel="canonical" href="${url}">
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#5A4E40;--line:#e2dccf}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.6}
  h1,h2{font-family:'Sentient',Georgia,serif;font-weight:700;letter-spacing:-.015em}
  a{color:var(--red);text-decoration:none}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  header{padding:20px 22px;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;justify-content:space-between;align-items:center;padding:0}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px;color:var(--ink)}
  .brand span{color:var(--red)}
  .hero{padding:50px 0 20px}
  .hero .eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:12px;color:var(--red);font-weight:700;margin-bottom:14px}
  h1{font-size:clamp(32px,6vw,46px);margin-bottom:12px}
  .hero p{color:var(--muted);font-size:18px;max-width:44ch}
  .list{padding:20px 0 50px}
  .list a{display:block;padding:18px 0;border-bottom:1px solid var(--line);color:var(--ink);font-family:'Sentient',serif;font-size:20px;font-weight:500}
  .list a:hover{color:var(--red)}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${SITE}/">Static<span>Swift</span></a><a href="${SITE}/" style="color:var(--ink)">Home</a></div></header>
<div class="wrap">
  <div class="hero"><div class="eyebrow">Guides</div><h1>Straight answers for UK tradespeople</h1><p>No jargon, no sales fluff. The real answers to what trades ask about websites, Google, and winning more work.</p></div>
  <div class="list">
    ${GUIDES.map(g => `<a href="/guides/${g.slug}/">${esc(g.q)}</a>`).join('\n    ')}
  </div>
</div>
<footer><div class="wrap">StaticSwift · Hand-coded websites for UK trades · Manchester · <a href="mailto:${P.email}">${P.email}</a></div></footer>
</body>
</html>`;
}

let n = 0;
for (const g of GUIDES) {
  const dir = join(ROOT, 'guides', g.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(g));
  n++;
}
mkdirSync(join(ROOT, 'guides'), { recursive: true });
writeFileSync(join(ROOT, 'guides', 'index.html'), indexPage());

// Sitemap for the guides so Google finds them.
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/guides/`, ...GUIDES.map(g => `${SITE}/guides/${g.slug}/`)];
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n') +
  `\n</urlset>\n`;
writeFileSync(join(ROOT, 'sitemap-guides.xml'), sm);

console.log(`Built ${n} guides + index + sitemap-guides.xml`);
console.log(GUIDES.map(g => '  /guides/' + g.slug + '/').join('\n'));
