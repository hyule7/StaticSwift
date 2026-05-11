#!/usr/bin/env node
/**
 * StaticSwift Programmatic SEO Generator
 * Generates ~32,510 Google-safe unique landing pages
 * Run: node generate.js
 */

const fs = require('fs');
const path = require('path');

const cities = JSON.parse(fs.readFileSync('./cities.json', 'utf8'));
const niches = JSON.parse(fs.readFileSync('./niches.json', 'utf8'));
const contentBank = JSON.parse(fs.readFileSync('./content-bank.json', 'utf8'));

const OUTPUT_DIR = process.env.SS_OUTPUT || '../staticswift-site';
// Override with: SS_OUTPUT=./output node generate.js (for local preview)
// Default writes directly into the staticswift-site repo
const START_TIME = Date.now();
let count = 0;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getNicheContent(nicheSlug) {
  return contentBank.niches[nicheSlug] || {
    introParagraph: `Professional ${nicheSlug.replace(/-website-design$/,'')} businesses across the UK are increasingly finding new clients through their website. A StaticSwift site puts you in front of local customers at exactly the moment they are searching.`,
    whyNeedsWebsite: `Customers search online before making decisions. A professional website is how you capture those searches and turn them into enquiries.`,
    faqQ1: 'How quickly will my website be built?', faqA1: 'We deliver your preview within 24 hours of receiving your completed brief.',
    faqQ2: 'What is included in the price?', faqA2: 'A fully custom single-page website, mobile responsive, SEO optimised, with contact form and free support forever.'
  };
}

function getCityIntro(citySlug) {
  return contentBank.topCities[citySlug]?.localSentence || null;
}

function buildPageHTML({ title, metaDesc, canonical, h1, cityName, region, postcode, nearbyAreas, nicheName, nicheSlug, nicheContent, cityIntro, isNicheCity }) {
  const nearbyStr = nearbyAreas.slice(0, 3).join(', ');
  const utmCampaign = `${nicheSlug}-${slug(cityName)}`;
  const ctaUrl = `https://staticswift.co.uk/#get-started?utm_source=landing_page&utm_campaign=${utmCampaign}`;

  const localContextPara = cityIntro
    ? `${cityIntro} For ${nicheName.toLowerCase()} businesses in the ${postcode} area, having a professional website means being present when local customers search — and that is exactly what a StaticSwift site delivers.`
    : `For ${nicheName.toLowerCase()} businesses in ${cityName}, ${region}, a professional website means being visible to the customers in the ${postcode} postcode district and beyond who are actively searching right now. We serve businesses across ${cityName} and throughout ${nearbyStr}.`;

  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${metaDesc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<link rel="hreflang" hreflang="en-gb" href="${canonical}">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"LocalBusiness","name":"StaticSwift","url":"https://staticswift.co.uk","description":"Professional website design for UK small businesses from £149","address":{"@type":"PostalAddress","addressLocality":"${cityName}","addressRegion":"${region}","addressCountry":"GB"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${nicheContent.faqQ1}","acceptedAnswer":{"@type":"Answer","text":"${nicheContent.faqA1}"}},{"@type":"Question","name":"${nicheContent.faqQ2}","acceptedAnswer":{"@type":"Answer","text":"${nicheContent.faqA2}"}},{"@type":"Question","name":"How much does a website cost for a ${nicheName.toLowerCase()} in ${cityName}?","acceptedAnswer":{"@type":"Answer","text":"StaticSwift websites for ${nicheName.toLowerCase()} businesses in ${cityName} start from £149 as a one-time payment with no monthly fees. The Advanced site is £299. Both include mobile responsive design, SEO optimisation, and free support forever."}},{"@type":"Question","name":"How quickly can StaticSwift build my website in ${cityName}?","acceptedAnswer":{"@type":"Answer","text":"We deliver your website preview within 24 hours of receiving your completed brief. No payment until you approve the design. Free revision included."}}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://staticswift.co.uk"},{"@type":"ListItem","position":2,"name":"${nicheName} Website Design","item":"https://staticswift.co.uk/${nicheSlug}"},{"@type":"ListItem","position":3,"name":"${cityName}","item":"${canonical}"}]}
</script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--cyan:#00C8E0;--dark:#07090f;--dark2:#0d1018;--dark3:#12151f;--surface:#181b26;--text:#f0f2f8;--muted:#8890a8;--border:rgba(255,255,255,0.07);--green:#22c55e}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}body{background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif;line-height:1.6}
a{color:var(--cyan);text-decoration:none}h1,h2,h3{font-family:'Syne',sans-serif;letter-spacing:-.02em}
header{position:sticky;top:0;z-index:100;background:rgba(7,9,15,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text)}.logo span{color:var(--cyan)}
.btn-cta{background:var(--cyan);color:#07090f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none}
.hero{padding:80px 24px 64px;text-align:center;border-bottom:1px solid var(--border)}
.hero-inner{max-width:800px;margin:0 auto}
.hero-tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--cyan);border:1px solid rgba(0,200,224,.25);padding:5px 14px;border-radius:100px;margin-bottom:20px}
h1{font-size:clamp(28px,5vw,52px);font-weight:800;margin-bottom:16px;line-height:1.1}
.hero-sub{font-size:17px;color:var(--muted);margin-bottom:36px}
.hero-cta{display:inline-block;background:var(--cyan);color:#07090f;font-weight:800;font-size:16px;padding:16px 36px;border-radius:10px;margin-bottom:24px}
.trust-strip{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.trust-badge{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted);border:1px solid rgba(0,200,224,.2);border-radius:100px;padding:6px 14px}
.trust-badge::before{content:'✓';color:var(--cyan)}
section{padding:72px 24px}
.section-inner{max-width:1000px;margin:0 auto}
.section-tag{font-family:'DM Mono',monospace;font-size:11px;color:var(--cyan);letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px;display:block}
.section-title{font-size:clamp(24px,4vw,40px);font-weight:800;margin-bottom:16px}
.section-body{font-size:16px;color:var(--muted);max-width:680px;line-height:1.8;margin-bottom:24px}
.steps{display:flex;gap:32px;flex-wrap:wrap}
.step{flex:1;min-width:200px}
.step-num{font-family:'Syne',sans-serif;font-size:56px;font-weight:800;color:var(--cyan);opacity:.7;line-height:1;margin-bottom:10px}
.step h3{font-size:18px;font-weight:700;margin-bottom:8px}
.step p{font-size:14px;color:var(--muted)}
.pricing-grid{display:flex;gap:20px;flex-wrap:wrap;margin-top:8px}
.pricing-card{flex:1;min-width:260px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px}
.pricing-card.featured{border-color:var(--cyan)}
.pricing-card h3{font-size:18px;font-weight:700;margin-bottom:6px}
.price{font-family:'Syne',sans-serif;font-size:48px;font-weight:800;color:var(--cyan);line-height:1;margin-bottom:16px}
.price sup{font-size:22px;vertical-align:top;margin-top:8px}
.features{list-style:none;margin-bottom:24px;display:flex;flex-direction:column;gap:8px}
.features li{font-size:14px;color:var(--muted);display:flex;align-items:center;gap:8px}
.features li::before{content:'✓';color:var(--cyan);font-weight:700;flex-shrink:0}
.pricing-btn{display:block;text-align:center;background:var(--cyan);color:#07090f;font-weight:700;font-size:15px;padding:13px;border-radius:8px}
.pricing-card:not(.featured) .pricing-btn{background:transparent;color:var(--cyan);border:1.5px solid var(--cyan)}
.local-box{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px;margin-top:8px}
.local-box h3{font-size:18px;font-weight:700;margin-bottom:10px}
.local-box p{font-size:15px;color:var(--muted);line-height:1.8}
.guarantee-inner{background:var(--dark2);border-top:2px solid rgba(0,200,224,.2);border-bottom:2px solid rgba(0,200,224,.2);padding:56px 24px;text-align:center}
.guarantee-inner h2{font-size:clamp(22px,3vw,32px);font-weight:800;margin-bottom:20px}
.g-points{list-style:none;display:flex;flex-direction:column;gap:10px;align-items:center}
.g-points li{font-size:15px;color:var(--muted);display:flex;align-items:center;gap:8px}
.g-points li::before{content:'✓';color:var(--cyan);font-weight:700}
.cta-section{background:var(--dark3);text-align:center;padding:80px 24px}
.cta-section h2{font-size:clamp(26px,4vw,44px);font-weight:800;margin-bottom:14px}
.cta-section p{color:var(--muted);margin-bottom:32px;font-size:16px}
.cta-big{display:inline-block;background:var(--cyan);color:#07090f;font-weight:800;font-size:17px;padding:18px 40px;border-radius:10px;font-family:'Syne',sans-serif}
.faq-list{max-width:680px}
.faq-list details{border-bottom:1px solid var(--border);padding:4px 0}
.faq-list summary{cursor:pointer;list-style:none;padding:16px 0;font-size:15px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:16px;user-select:none}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:'+';font-size:20px;color:var(--cyan);flex-shrink:0;transition:transform .2s}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list details p{font-size:14px;color:var(--muted);padding:0 0 16px;line-height:1.7}
.internal-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.internal-links a{font-size:13px;color:var(--muted);border:1px solid var(--border);padding:6px 12px;border-radius:6px;transition:all .2s}
.internal-links a:hover{border-color:var(--cyan);color:var(--cyan)}
footer{background:var(--dark2);border-top:1px solid var(--border);padding:40px 24px 28px;text-align:center;font-size:13px;color:var(--muted)}
footer a{color:var(--muted)}footer .logo{display:inline-block;margin-bottom:16px}
@media(max-width:600px){.steps,.pricing-grid{flex-direction:column}.step{min-width:unset}}
</style>
</head>
<body>
<header>
  <a href="https://staticswift.co.uk" class="logo">STATIC<span>SWIFT</span></a>
  <a href="${ctaUrl}" class="btn-cta">Get Started from £149</a>
</header>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-tag">${cityName}, ${region}</div>
    <h1>${h1}</h1>
    <p class="hero-sub">One-time payment. No monthly fees. Delivered in 24 hours. You own it forever.</p>
    <a href="${ctaUrl}" class="hero-cta">Get Your ${cityName} Website — From £149</a>
    <div class="trust-strip">
      <div class="trust-badge">Delivered in 24hrs</div>
      <div class="trust-badge">No Monthly Fees</div>
      <div class="trust-badge">Files Yours Forever</div>
      <div class="trust-badge">Money-Back Guarantee</div>
      <div class="trust-badge">Free Support Forever</div>
    </div>
  </div>
</div>

<section>
  <div class="section-inner">
    <span class="section-tag">About This Service</span>
    <h2 class="section-title">${nicheName} website design in ${cityName}</h2>
    <p class="section-body">${nicheContent.introParagraph}</p>
    <p class="section-body">${localContextPara}</p>
    <p class="section-body">${nicheContent.whyNeedsWebsite}</p>
  </div>
</section>

<section style="background:var(--dark2)">
  <div class="section-inner">
    <span class="section-tag">How It Works</span>
    <h2 class="section-title">Three steps. Done.</h2>
    <div class="steps">
      <div class="step"><div class="step-num">01</div><h3>Fill in our 2-minute form.</h3><p>Tell us about your business, your style, and what you need. No technical knowledge required.</p></div>
      <div class="step"><div class="step-num">02</div><h3>We build your site in 24 hours.</h3><p>A real human designer builds your custom website and sends you a preview link to review.</p></div>
      <div class="step"><div class="step-num">03</div><h3>Preview, approve, go live.</h3><p>Happy with it? Pay and receive your files. Not happy? We revise it free. Still not? Full refund.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <span class="section-tag">Pricing</span>
    <h2 class="section-title">Simple, honest pricing.</h2>
    <p class="section-body">One payment. No subscriptions. No renewals. Yours forever.</p>
    <div class="pricing-grid">
      <div class="pricing-card">
        <h3>Starter Site</h3>
        <div class="price"><sup>£</sup>149</div>
        <ul class="features">
          <li>Custom single-page website</li><li>Mobile responsive design</li>
          <li>SEO optimised for ${cityName}</li><li>Contact form included</li>
          <li>Delivered in 24 hours</li><li>1 free revision included</li>
          <li>Free support forever</li><li>Files yours forever</li>
        </ul>
        <a href="${ctaUrl}&package=starter" class="pricing-btn">Get Starter Site</a>
      </div>
      <div class="pricing-card featured">
        <h3>Advanced Site</h3>
        <div class="price"><sup>£</sup>299</div>
        <ul class="features">
          <li>Everything in Starter</li><li>Multi-page structure</li>
          <li>Services detail pages</li><li>Photo gallery section</li>
          <li>Testimonials section</li><li>About page</li>
          <li>Advanced animations</li><li>Priority delivery</li>
        </ul>
        <a href="${ctaUrl}&package=advanced" class="pricing-btn">Get Advanced Site</a>
      </div>
    </div>
  </div>
</section>

<div class="guarantee-inner">
  <h2>Our guarantee is unconditional.</h2>
  <ul class="g-points">
    <li>Not happy with the preview? We redesign it free.</li>
    <li>Still not satisfied? Full refund, no questions asked.</li>
    <li>Free support forever, no exceptions.</li>
  </ul>
</div>

<section style="background:var(--dark2)">
  <div class="section-inner">
    <span class="section-tag">Serving Your Area</span>
    <h2 class="section-title">We build websites for ${nicheName.toLowerCase()} businesses across ${cityName}.</h2>
    <div class="local-box">
      <p>We serve ${nicheName.toLowerCase()} businesses throughout ${cityName} (${postcode}) and the surrounding areas including ${nearbyStr}. Wherever you are based in ${region}, we deliver your website within 24 hours with no upfront payment required.</p>
    </div>
    <div class="internal-links" style="margin-top:20px">
      <a href="https://staticswift.co.uk">StaticSwift Home</a>
      <a href="https://staticswift.co.uk/${nicheSlug}">${nicheName} Website Design UK</a>
      <a href="https://staticswift.co.uk/website-design-${slug(cityName)}">Website Design ${cityName}</a>
      ${nearbyAreas.slice(0,3).map(a => `<a href="https://staticswift.co.uk/${nicheSlug}-${slug(a)}">${nicheContent.faqQ1.split(' ')[0]} Website Design ${a}</a>`).join('')}
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <span class="section-tag">FAQ</span>
    <h2 class="section-title">Common questions.</h2>
    <div class="faq-list" itemscope itemtype="https://schema.org/FAQPage">
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <summary itemprop="name">${nicheContent.faqQ1}</summary>
        <p itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><span itemprop="text">${nicheContent.faqA1}</span></p>
      </details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <summary itemprop="name">${nicheContent.faqQ2}</summary>
        <p itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><span itemprop="text">${nicheContent.faqA2}</span></p>
      </details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <summary itemprop="name">How much does a website cost for a ${nicheName.toLowerCase()} in ${cityName}?</summary>
        <p itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><span itemprop="text">StaticSwift websites for ${nicheName.toLowerCase()} businesses in ${cityName} start from £149 as a one-time payment. No monthly fees, no subscriptions. The Advanced site is £299 and includes multiple pages, a gallery, and testimonials. Both include mobile responsive design, SEO optimisation, and free support forever.</span></p>
      </details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <summary itemprop="name">How quickly will my ${cityName} website be built?</summary>
        <p itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><span itemprop="text">We deliver your website preview within 24 hours of receiving your completed brief — including weekends. No payment is required until you have reviewed and approved your design. One free revision is included with every order.</span></p>
      </details>
    </div>
  </div>
</section>

<div class="cta-section">
  <h2>Get your ${nicheName.toLowerCase()} website<br>in ${cityName} from £149.</h2>
  <p>No payment until you love the preview. Free revision included. Money-back guarantee.</p>
  <a href="${ctaUrl}" class="cta-big">Start My Website</a>
</div>

<footer>
  <div class="logo">STATIC<span>SWIFT</span></div>
  <p>Professional website design for ${nicheName.toLowerCase()} businesses in ${cityName}, ${region} and across the UK.</p>
  <p style="margin-top:8px"><a href="https://staticswift.co.uk">staticswift.co.uk</a> &nbsp;|&nbsp; <a href="mailto:hello@staticswift.co.uk">hello@staticswift.co.uk</a></p>
  <p style="margin-top:8px;font-size:12px;opacity:.5">&copy; ${new Date().getFullYear()} StaticSwift. ${cityName}, ${postcode}.</p>
</footer>
</body>
</html>`;
}

// ==========================================
// GENERATE CITY-ONLY PAGES
// ==========================================
function generateCityPage(city) {
  const citySlug = city.slug || slug(city.name);
  const dir = path.join(OUTPUT_DIR, `website-design-${citySlug}`);
  ensureDir(dir);
  const title = `Website Design ${city.name} from £149 | StaticSwift`.slice(0, 60);
  const metaDesc = `Professional website design in ${city.name}, ${city.region}. From £149 one-time, no monthly fees. Delivered in 24 hours. Free support. Money-back guarantee.`.slice(0, 155);
  const canonical = `https://staticswift.co.uk/website-design-${citySlug}/`;
  const nicheLinks = niches.map(n => `<a href="https://staticswift.co.uk/${n.slug}-${citySlug}" style="color:var(--muted);text-decoration:none;font-size:13px;border:1px solid rgba(255,255,255,.07);padding:5px 12px;border-radius:6px;display:inline-block;margin:4px">${n.name} Website Design</a>`).join('');
  const html = `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><meta name="description" content="${metaDesc}"><link rel="canonical" href="${canonical}"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>:root{--cyan:#00C8E0;--dark:#07090f;--surface:#181b26;--text:#f0f2f8;--muted:#8890a8;--border:rgba(255,255,255,0.07)}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif}a{color:var(--cyan);text-decoration:none}header{background:rgba(7,9,15,.95);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text)}.logo span{color:var(--cyan)}.btn{background:var(--cyan);color:#07090f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px}.wrap{max-width:1000px;margin:0 auto;padding:64px 24px}h1{font-family:'Syne',sans-serif;font-size:clamp(28px,5vw,48px);font-weight:800;margin-bottom:16px;letter-spacing:-.02em}p{color:var(--muted);font-size:16px;line-height:1.8;margin-bottom:16px}h2{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;margin:40px 0 16px}</style></head><body>
<header><a href="https://staticswift.co.uk" class="logo">STATIC<span>SWIFT</span></a><a href="https://staticswift.co.uk/#get-started?utm_source=city_page&utm_campaign=website-design-${citySlug}" class="btn">Get Started from £149</a></header>
<div class="wrap">
  <h1>Website Design ${city.name}</h1>
  <p>StaticSwift builds professional websites for small businesses in ${city.name}, ${city.region}. From £149 as a one-time payment — no monthly fees, no subscriptions, files yours forever.</p>
  <p>We serve businesses across ${city.name} (${city.postcode}) and the surrounding areas including ${(city.nearby||[]).join(', ')}. Every website is custom built and delivered within 24 hours.</p>
  <h2>Website design for every type of business in ${city.name}</h2>
  <p>We build websites for all types of local businesses in ${city.name}. Choose your business type below:</p>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:40px">${nicheLinks}</div>
  <p><a href="https://staticswift.co.uk/#get-started?utm_source=city_page&utm_campaign=website-design-${citySlug}" style="background:var(--cyan);color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block">Get your ${city.name} website — from £149</a></p>
</div>
<footer style="border-top:1px solid var(--border);padding:32px 24px;text-align:center;font-size:13px;color:var(--muted)"><a href="https://staticswift.co.uk" style="font-family:'Syne',sans-serif;font-weight:800;color:var(--text)">STATIC<span style="color:var(--cyan)">SWIFT</span></a><p style="margin-top:8px">staticswift.co.uk | hello@staticswift.co.uk</p></footer>
</body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  count++;
}

// ==========================================
// GENERATE NICHE ROOT PAGES
// ==========================================
function generateNichePage(niche) {
  const dir = path.join(OUTPUT_DIR, niche.slug);
  ensureDir(dir);
  const title = `${niche.name} Website Design UK from £149 | StaticSwift`.slice(0, 60);
  const metaDesc = `Professional ${niche.shortName} website design across the UK. From £149 one-time, no monthly fees. Delivered in 24 hours. Free support. Money-back guarantee.`.slice(0, 155);
  const canonical = `https://staticswift.co.uk/${niche.slug}/`;
  const topCities = ['manchester','birmingham','leeds','liverpool','sheffield','bristol','edinburgh','glasgow','newcastle','nottingham','coventry','leicester','brighton','reading','oxford','cambridge','bath','york','exeter','cardiff'];
  const cityLinks = topCities.map(c => { const city = cities.find(x => x.slug === c || slug(x.name) === c); if(!city) return ''; return `<a href="https://staticswift.co.uk/${niche.slug}-${city.slug||slug(city.name)}" style="color:var(--muted);text-decoration:none;font-size:13px;border:1px solid rgba(255,255,255,.07);padding:5px 12px;border-radius:6px;display:inline-block;margin:4px">${niche.name.split(' ')[0]} Website Design ${city.name}</a>`; }).join('');
  const nicheContent = getNicheContent(niche.slug);
  const html = `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><meta name="description" content="${metaDesc}"><link rel="canonical" href="${canonical}"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>:root{--cyan:#00C8E0;--dark:#07090f;--surface:#181b26;--text:#f0f2f8;--muted:#8890a8;--border:rgba(255,255,255,0.07)}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif}a{color:var(--cyan)}header{background:rgba(7,9,15,.95);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text)}.logo span{color:var(--cyan)}.btn{background:var(--cyan);color:#07090f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none}.wrap{max-width:1000px;margin:0 auto;padding:64px 24px}h1{font-family:'Syne',sans-serif;font-size:clamp(28px,5vw,48px);font-weight:800;margin-bottom:16px;letter-spacing:-.02em}p{color:var(--muted);font-size:16px;line-height:1.8;margin-bottom:16px}h2{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;margin:40px 0 16px}</style></head><body>
<header><a href="https://staticswift.co.uk" class="logo">STATIC<span>SWIFT</span></a><a href="https://staticswift.co.uk/#get-started?utm_source=niche_page&utm_campaign=${niche.slug}" class="btn">Get Started from £149</a></header>
<div class="wrap">
  <h1>${niche.name} Website Design UK — From £149</h1>
  <p>${nicheContent.introParagraph}</p>
  <p>${nicheContent.whyNeedsWebsite}</p>
  <h2>${niche.name} website design by city</h2>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:40px">${cityLinks}</div>
  <p><a href="https://staticswift.co.uk/#get-started?utm_source=niche_page&utm_campaign=${niche.slug}" style="background:var(--cyan);color:#07090f;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block;text-decoration:none">Get your ${niche.shortName} website — from £149</a></p>
</div>
<footer style="border-top:1px solid var(--border);padding:32px 24px;text-align:center;font-size:13px;color:var(--muted)"><a href="https://staticswift.co.uk" style="font-family:'Syne',sans-serif;font-weight:800;color:var(--text);text-decoration:none">STATIC<span style="color:var(--cyan)">SWIFT</span></a><p style="margin-top:8px">staticswift.co.uk | hello@staticswift.co.uk</p></footer>
</body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  count++;
}

// ==========================================
// GENERATE NICHE + CITY COMBINATION PAGES
// ==========================================
function generateNicheCityPage(niche, city) {
  const citySlug = city.slug || slug(city.name);
  const dir = path.join(OUTPUT_DIR, `${niche.slug}-${citySlug}`);
  ensureDir(dir);
  const title = `${niche.name} Website Design in ${city.name} from £149 | StaticSwift`.slice(0, 60);
  const metaDesc = `Professional ${niche.shortName} website design in ${city.name}, ${city.region}. From £149 one-time, no monthly fees. Delivered in 24 hours. Free support. Money-back guarantee.`.slice(0, 155);
  const canonical = `https://staticswift.co.uk/${niche.slug}-${citySlug}/`;
  const h1 = `${niche.name} Website Design in ${city.name} — From £149`;
  const nicheContent = getNicheContent(niche.slug);
  const cityIntro = getCityIntro(citySlug);
  const html = buildPageHTML({
    title, metaDesc, canonical, h1,
    cityName: city.name, region: city.region, postcode: city.postcode || '',
    nearbyAreas: city.nearby || [],
    nicheName: niche.name, nicheSlug: niche.slug,
    nicheContent, cityIntro, isNicheCity: true
  });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  count++;
}

// ==========================================
// GENERATE COMPARISON PAGES
// ==========================================
function generateComparisonPages() {
  const comparisons = [
    { slug: 'staticswift-vs-wix', competitor: 'Wix', price: '£14/mo', threeYear: '£504+' },
    { slug: 'staticswift-vs-squarespace', competitor: 'Squarespace', price: '£15/mo', threeYear: '£540+' },
    { slug: 'staticswift-vs-freelancer', competitor: 'a Freelancer', price: '£500–£3,000', threeYear: '£500–£3,000+' },
  ];
  comparisons.forEach(c => {
    const dir = path.join(OUTPUT_DIR, c.slug);
    ensureDir(dir);
    const html = `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>StaticSwift vs ${c.competitor} — Why StaticSwift Wins | StaticSwift</title><meta name="description" content="Compare StaticSwift vs ${c.competitor}. StaticSwift: £149 one-time, files yours forever, delivered in 24hrs. ${c.competitor}: ${c.price}. See the full comparison."><link rel="canonical" href="https://staticswift.co.uk/${c.slug}/"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>:root{--cyan:#00C8E0;--dark:#07090f;--surface:#181b26;--text:#f0f2f8;--muted:#8890a8;--border:rgba(255,255,255,0.07);--green:#22c55e;--red:#ef4444}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif}a{color:var(--cyan)}header{background:rgba(7,9,15,.95);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text)}.logo span{color:var(--cyan)}.btn{background:var(--cyan);color:#07090f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none}.wrap{max-width:900px;margin:0 auto;padding:64px 24px}h1{font-family:'Syne',sans-serif;font-size:clamp(28px,5vw,48px);font-weight:800;margin-bottom:16px;letter-spacing:-.02em}p{color:var(--muted);font-size:16px;line-height:1.8;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:14px;margin:32px 0;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}th{padding:12px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border);color:var(--muted)}th.ss{color:var(--cyan);background:rgba(0,200,224,.05)}td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.04)}td.ss{background:rgba(0,200,224,.04)}.yes{color:var(--green);font-weight:700}.no{color:var(--red);font-weight:700}.cta{background:var(--cyan);color:#07090f;font-weight:700;padding:16px 32px;border-radius:10px;display:inline-block;font-size:16px;text-decoration:none;margin-top:16px}</style></head><body>
<header><a href="https://staticswift.co.uk" class="logo">STATIC<span>SWIFT</span></a><a href="https://staticswift.co.uk/#get-started?utm_source=comparison&utm_campaign=${c.slug}" class="btn">Get Started from £149</a></header>
<div class="wrap">
  <h1>StaticSwift vs ${c.competitor}</h1>
  <p>Thinking about ${c.competitor} for your business website? Here is a straight comparison so you can make an informed decision.</p>
  <table>
    <thead><tr><th>Feature</th><th class="ss">StaticSwift</th><th>${c.competitor}</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td class="ss yes">£149 once</td><td class="no">${c.price}</td></tr>
      <tr><td>3-Year Cost</td><td class="ss yes">£149</td><td class="no">${c.threeYear}</td></tr>
      <tr><td>You Own The Files</td><td class="ss yes">YES</td><td class="no">NO</td></tr>
      <tr><td>No Monthly Fees</td><td class="ss yes">YES</td><td class="no">NO</td></tr>
      <tr><td>Delivered in 24hrs</td><td class="ss yes">YES</td><td class="no">NO</td></tr>
      <tr><td>Free Support Forever</td><td class="ss yes">YES</td><td class="no">NO</td></tr>
      <tr><td>Money-Back Guarantee</td><td class="ss yes">YES</td><td class="no">NO</td></tr>
      <tr><td>Custom Design</td><td class="ss yes">YES</td><td>Template only</td></tr>
      <tr><td>Works on Any Host</td><td class="ss yes">YES</td><td class="no">Locked in</td></tr>
    </tbody>
  </table>
  <p>StaticSwift builds you a completely custom website, delivers it in 24 hours, and charges £149 once. You own the HTML file outright and can host it for free on Netlify indefinitely. No lock-in, no subscriptions, no surprises.</p>
  <a href="https://staticswift.co.uk/#get-started?utm_source=comparison&utm_campaign=${c.slug}" class="cta">Get your website from £149</a>
</div>
<footer style="border-top:1px solid var(--border);padding:32px 24px;text-align:center;font-size:13px;color:var(--muted)"><a href="https://staticswift.co.uk" style="font-family:'Syne',sans-serif;font-weight:800;color:var(--text);text-decoration:none">STATIC<span style="color:var(--cyan)">SWIFT</span></a><p style="margin-top:8px">staticswift.co.uk | hello@staticswift.co.uk</p></footer>
</body></html>`;
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    count++;
  });
}

// ==========================================
// GENERATE SITEMAP
// ==========================================
function generateSitemap(urls) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-pages.xml'), xml);
  console.log(`Sitemap written: ${urls.length} URLs`);
}

// ==========================================
// GENERATE SITEMAP INDEX
// ==========================================
function generateSitemapIndex() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://staticswift.co.uk/sitemap.xml</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod></sitemap>
  <sitemap><loc>https://staticswift.co.uk/sitemap-pages.xml</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod></sitemap>
</sitemapindex>`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-index.xml'), xml);
  // Also update the sitemap.xml in site root to reference the index
  console.log('sitemap-index.xml written to site root');
  console.log('sitemap-index.xml written');
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  if (!fs.existsSync('./cities.json')) {
    console.error('ERROR: cities.json not found. Generate it first — see README.md for instructions.');
    process.exit(1);
  }
  ensureDir(OUTPUT_DIR);
  const urls = [];
  console.log(`Starting generation...`);
  console.log(`Cities: ${cities.length} | Niches: ${niches.length}`);

  // City pages
  console.log('\n[1/4] Generating city pages...');
  for (const city of cities) {
    const citySlug = city.slug || slug(city.name);
    generateCityPage(city);
    urls.push(`https://staticswift.co.uk/website-design-${citySlug}/`);
    if (count % 100 === 0) process.stdout.write(`  ${count} pages (${Math.round((Date.now()-START_TIME)/1000)}s)\n`);
  }

  // Niche root pages
  console.log('\n[2/4] Generating niche root pages...');
  for (const niche of niches) {
    generateNichePage(niche);
    urls.push(`https://staticswift.co.uk/${niche.slug}/`);
  }

  // Comparison pages
  console.log('\n[3/4] Generating comparison pages...');
  generateComparisonPages();
  ['staticswift-vs-wix','staticswift-vs-squarespace','staticswift-vs-freelancer'].forEach(s => urls.push(`https://staticswift.co.uk/${s}/`));

  // Niche + city combinations
  console.log('\n[4/4] Generating niche-city combination pages...');
  for (const niche of niches) {
    for (const city of cities) {
      const citySlug = city.slug || slug(city.name);
      generateNicheCityPage(niche, city);
      urls.push(`https://staticswift.co.uk/${niche.slug}-${citySlug}/`);
      if (count % 100 === 0) process.stdout.write(`  ${count} pages (${Math.round((Date.now()-START_TIME)/1000)}s)\n`);
    }
  }

  generateSitemap(urls);
  generateSitemapIndex();

  const elapsed = Math.round((Date.now() - START_TIME) / 1000);
  console.log(`\n✓ Complete. ${count} pages generated in ${elapsed}s.`);
  console.log(`Output: ${OUTPUT_DIR}/`);
  console.log('\nNext steps:');
  console.log('1. Copy output/ contents into your staticswift-site GitHub repo');
  console.log('2. Follow the batch publishing schedule — start with 500 pages (top 25 cities x 20 niches)');
  console.log('3. Run: node publish-batch.js 500');
}

main().catch(console.error);
