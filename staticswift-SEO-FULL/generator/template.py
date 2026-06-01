"""
Clean page template. Takes (niche_slug, city_slug) and returns full HTML.

Bugs from the old corpus this template fixes:
- Slug is never reversed-with-comma-and-space into URLs.
- Services list is per-niche, not hardcoded barber.
- Body copy is per-niche, not 'busy London market' everywhere.
- LocalBusiness schema uses correct locality, conservative region, country=GB.
- areaServed schema removed (was 'United Kingdom' globally; per-page locality is enough).
- 'Nearby areas' links pull real sibling cities from the input nearby list.
- Hero subtag = city only (no ', London' suffix).
- Tattoo niche uses tattoo-studio slug, never 'tattoo artist' with a space.
- Dropdown has the niche selected from the canonical option, no duplicates.
"""

import json
import html
from . import niches as niches_lib
from . import locales as locales_lib


SITE = "https://staticswift.co.uk"


# The dropdown list is a fixed canonical menu. The selected option is set
# server-side; no duplicate entries.
BUSINESS_TYPES = [
    ("accountant", "Accountant"),
    ("architect", "Architect"),
    ("bakery", "Bakery"),
    ("barber", "Barber / Hair Salon"),
    ("beauty-salon", "Beauty / Nail Bar"),
    ("blacksmith", "Blacksmith"),
    ("builder", "Builder"),
    ("butcher", "Butcher"),
    ("cafe", "Cafe"),
    ("cake-maker", "Cake Maker"),
    ("carpet-cleaner", "Carpet Cleaner"),
    ("caterer", "Caterer"),
    ("childminder", "Childminder"),
    ("cleaning-company", "Cleaning Company"),
    ("dentist", "Dentist"),
    ("dj", "DJ / Entertainer"),
    ("dog-groomer", "Dog Groomer"),
    ("driving-instructor", "Driving Instructor"),
    ("dry-cleaner", "Dry Cleaner"),
    ("electrician", "Electrician"),
    ("estate-agent", "Estate Agent"),
    ("florist", "Florist"),
    ("food-truck", "Food Truck"),
    ("gardener", "Gardener / Landscaper"),
    ("gym", "Gym"),
    ("joiner", "Joiner"),
    ("locksmith", "Locksmith"),
    ("mechanic", "Mechanic"),
    ("mobile-hairdresser", "Mobile Hairdresser"),
    ("music-teacher", "Music Teacher"),
    ("nursery", "Nursery / Pre-school"),
    ("optician", "Optician"),
    ("painter-decorator", "Painter & Decorator"),
    ("personal-trainer", "Personal Trainer"),
    ("pest-control", "Pest Control"),
    ("photographer", "Photographer"),
    ("plasterer", "Plasterer"),
    ("plumber", "Plumber"),
    ("pub", "Pub / Bar"),
    ("removals", "Removals"),
    ("restaurant", "Restaurant"),
    ("retail", "Retail / Shop"),
    ("roofer", "Roofer"),
    ("scaffolder", "Scaffolder"),
    ("skip-hire", "Skip Hire"),
    ("solicitor", "Solicitor"),
    ("tattoo-studio", "Tattoo Studio"),
    ("therapist", "Therapist"),
    ("tiler", "Tiler"),
    ("tutor", "Tutor"),
    ("vet", "Vet"),
    ("web-designer", "Web Designer"),
    ("wedding-planner", "Wedding Planner"),
    ("window-cleaner", "Window Cleaner"),
    ("yoga-studio", "Yoga Studio"),
    ("other", "Other"),
]


def _dropdown(selected_slug: str) -> str:
    out = []
    for slug, label in BUSINESS_TYPES:
        sel = " selected" if slug == selected_slug else ""
        out.append(f'<option value="{slug}"{sel}>{html.escape(label)}</option>')
    return "".join(out)


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def render(niche_slug: str, city_slug: str, nearby_cities: list[str], cross_niches: list[str]) -> str:
    """Render one page.

    niche_slug:    canonical niche key (e.g. 'plumber')
    city_slug:     canonical city slug (e.g. 'stratford-upon-avon')
    nearby_cities: list of OTHER city slugs to cross-link within the same niche
    cross_niches:  list of OTHER niche slugs to cross-link within the same city
    """
    n = niches_lib.get(niche_slug)
    city_display = locales_lib.city_display(city_slug)
    region = locales_lib.address_region(city_slug)

    # Canonical URL — always clean, always slug-based.
    page_path = f"/{niche_slug}-website-design-{city_slug}/"
    page_url = SITE + page_path

    # Schema
    address = {
        "@type": "PostalAddress",
        "addressLocality": city_display,
        "addressCountry": "GB",
    }
    if region:
        address["addressRegion"] = region
    local_business = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "StaticSwift",
        "url": SITE,
        "description": f"Custom {n['singular']} website design in {city_display}, delivered in 24 hours from £149.",
        "address": address,
        "priceRange": "£149 - £299",
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question",
             "name": f"Will my website help me rank on Google in {city_display}?",
             "acceptedAnswer": {"@type": "Answer",
                 "text": f"Yes. Every page is built with local SEO best practices including meta tags, schema markup, fast loading speeds, and {city_display}-specific content. This helps you appear in local search results."}},
            {"@type": "Question",
             "name": f"Will my {n['singular']} website work on mobile phones?",
             "acceptedAnswer": {"@type": "Answer",
                 "text": f"Every StaticSwift website is designed mobile-first. Over 70% of customers searching for {n['plural']} in {city_display} use their phone, so your site will look perfect on every screen size."}},
            {"@type": "Question",
             "name": f"How quickly can I get a website for my {n['singular']} business?",
             "acceptedAnswer": {"@type": "Answer",
                 "text": f"We deliver your preview within 24 hours of receiving your brief. Most {city_display} clients get theirs the same day. No payment until you approve the design."}},
            {"@type": "Question",
             "name": "Do I need to buy hosting separately?",
             "acceptedAnswer": {"@type": "Answer",
                 "text": "No. We offer free hosting through Netlify, which includes SSL security and fast global loading. The optional £29 hosting add-on means we set it all up for you."}},
        ],
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": f"{n['h1_label']} Website Design",
             "item": f"{SITE}/{niche_slug}-website-design/"},
            {"@type": "ListItem", "position": 3, "name": city_display, "item": page_url},
        ],
    }
    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": SITE + "/#org",
        "name": "StaticSwift",
        "alternateName": "StaticSwift Studio",
        "url": SITE + "/",
        "logo": SITE + "/logo.png",
        "description": "StaticSwift handcrafts fast, premium static websites for UK small businesses. Delivered in 24 hours from £149.",
        "email": "hello@staticswift.co.uk",
        "founder": {"@type": "Person", "@id": SITE + "/about/#harry", "name": "Harry Yule"},
        "areaServed": {"@type": "Country", "name": "United Kingdom"},
        "sameAs": [SITE + "/"],
    }
    # Per-page Service + Offer schema for richer AI/LLM + Google understanding
    service = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": f"{n['h1_label']} Website Design in {city_display}",
        "serviceType": "Website Design",
        "category": f"{n['singular']} website design",
        "provider": {"@id": SITE + "/#org"},
        "areaServed": {"@type": "Place", "name": city_display},
        "offers": [
            {"@type": "Offer", "name": "Starter", "price": "149", "priceCurrency": "GBP",
             "description": f"Custom single-page {n['singular']} website, 24h delivery",
             "url": SITE + "/order.html"},
            {"@type": "Offer", "name": "Advanced", "price": "299", "priceCurrency": "GBP",
             "description": f"Multi-section {n['singular']} site with gallery & testimonials",
             "url": SITE + "/order.html"},
            {"@type": "Offer", "name": "Hosting", "price": "29", "priceCurrency": "GBP",
             "description": "Upload, domain connection, free Netlify hosting + SSL",
             "url": SITE + "/order.html"},
        ],
    }

    # Service grid
    service_items = "".join(
        f'<div class="svc-item"><span class="svc-ico">{n["icon"]}</span>{_esc(s)}</div>'
        for s in n["services"]
    )

    # Cross-links — only render if we have any
    nearby_links = ""
    if nearby_cities:
        items = "".join(
            f'<a href="{SITE}/{niche_slug}-website-design-{c}/">{n["singular"].title()} in {_esc(locales_lib.city_display(c))}</a>'
            for c in nearby_cities
        )
        nearby_links = (
            '<span class="tag">More towns we serve</span>'
            f'<div class="links">{items}</div>'
        )

    cross_links = ""
    if cross_niches:
        items = "".join(
            f'<a href="{SITE}/{cn}-website-design-{city_slug}/">{niches_lib.get(cn)["display"]} in {_esc(city_display)}</a>'
            for cn in cross_niches
        )
        cross_links = (
            f'<span class="tag" style="margin-top:32px;display:block">Other services in {_esc(city_display)}</span>'
            f'<div class="links">{items}</div>'
        )

    title = f"StaticSwift &mdash; {n['h1_label']} Website Design in {_esc(city_display)} (&pound;149, 24h delivery)"
    meta_desc = (
        f"Professional {n['singular']} website design in {city_display}. "
        f"Custom-built, mobile-ready, delivered in 24 hours. From £149, no monthly fees. Free preview."
    )
    og_title = f"{n['h1_label']} Website Design in {city_display} | From £149 | StaticSwift"

    return f"""<!DOCTYPE html>
<html lang="en-gb">
<head>
<!-- ss:brand-v2 -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{_esc(meta_desc)}">
<link rel="canonical" href="{page_url}">
<meta property="og:title" content="{_esc(og_title)}">
<meta property="og:description" content="{_esc(meta_desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url}">
<link rel="alternate" hreflang="en-gb" href="{page_url}">
<script type="application/ld+json">
{json.dumps(local_business, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(faq, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(breadcrumb, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(org, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(service, ensure_ascii=False)}
</script>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@1,400;1,500&display=swap" rel="stylesheet">
<style>
:root{{
  --ink:#06070b; --ink-2:#0c0f17; --ink-3:#161a25;
  --paper:#fff; --paper-2:#fafaf7; --paper-3:#f3f3ef;
  --muted:#5e6573; --dim:#8a91a0;
  --cyan:#00c6ff; --cyan-2:#7de8ff; --cyan-dim:#00a0cc; --cyan-b:rgba(0,168,216,.16);
  --gold:#d4af37;
  --line:rgba(6,7,11,.08); --line-d:rgba(6,7,11,.16);
  --green:#16a34a; --red:#dc2626;
  --r:14px; --r-lg:22px;
  --spring:cubic-bezier(.19,1,.22,1);
}}
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}}
body{{background:var(--paper);color:var(--ink);font-family:'Switzer','Inter Tight',sans-serif;line-height:1.55;font-size:15px;font-weight:400}}
h1,h2,h3{{font-weight:400;line-height:1.05;letter-spacing:-.02em}}
.serif-i{{font-family:'Cormorant',Georgia,serif;font-style:italic;font-weight:400}}
a{{color:inherit;text-decoration:none}}
::selection{{background:var(--cyan);color:var(--ink)}}
header{{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.86);border-bottom:1px solid var(--line);padding:0 clamp(16px,4vw,48px);height:64px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px) saturate(1.6)}}
.logo{{display:flex;align-items:center;gap:.55rem}}
.logo svg{{display:block;width:28px;height:28px;color:var(--ink);transition:transform .6s var(--spring)}}
.logo:hover svg{{transform:rotate(180deg)}}
.logo-stack{{display:flex;flex-direction:column;line-height:1.05}}
.logo-name{{font-family:'Switzer','Inter Tight',sans-serif;font-size:.95rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink)}}
.logo-by{{font-size:.66rem;letter-spacing:.06em;color:var(--dim);font-weight:500;text-transform:uppercase}}
.hcta{{background:var(--ink);color:#fff;padding:.6rem 1.1rem;border-radius:100px;font-size:.82rem;font-weight:600;letter-spacing:.01em;transition:all .4s var(--spring)}}
.hcta:hover{{background:var(--cyan-dim);transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,160,204,.25)}}
.hero{{padding:clamp(56px,9vw,120px) clamp(16px,4vw,48px) clamp(40px,6vw,72px);text-align:center;background:linear-gradient(180deg,var(--paper) 0%,var(--paper-2) 100%);border-bottom:1px solid var(--line);position:relative;overflow:hidden}}
.hero::after{{content:'';position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(1200px,140vw);height:520px;background:radial-gradient(ellipse at center top,var(--cyan-b),transparent 60%);pointer-events:none;z-index:0}}
.hero > *{{position:relative;z-index:1}}
.hero-tag{{display:inline-flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan-dim);background:#fff;border:1px solid var(--line);padding:8px 16px;border-radius:100px;margin-bottom:22px;box-shadow:0 2px 8px rgba(0,0,0,.04)}}
.hero-tag::before{{content:'';width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(22,163,74,.12);animation:pulse 2s var(--spring) infinite}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.5}}}}
h1{{font-size:clamp(34px,5.5vw,64px);letter-spacing:-.035em;max-width:880px;margin:0 auto 20px;font-weight:500;line-height:1.04}}
h1 em{{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-dim);font-weight:400}}
.hero-sub{{font-size:clamp(15px,1.6vw,18px);color:var(--muted);max-width:580px;margin:0 auto 30px;font-weight:400;line-height:1.6}}
.trust{{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:24px}}
.tb{{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:100px;padding:7px 14px}}
.tb::before{{content:'';width:14px;height:14px;border-radius:50%;background:var(--cyan-dim) center/8px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='%23fff'%3E%3Cpath d='M10 3L4.5 8.5 2 6'  stroke='%23fff' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");flex-shrink:0}}
section{{padding:clamp(56px,8vw,108px) clamp(16px,4vw,48px)}}
.si{{max-width:980px;margin:0 auto}}
.tag{{font-size:10.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan-dim);margin-bottom:14px;display:block}}
h2{{font-size:clamp(26px,4.2vw,46px);letter-spacing:-.03em;margin-bottom:18px;font-weight:500;line-height:1.05}}
h2 em{{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-dim);font-weight:400}}
.body-text{{font-size:16px;color:var(--muted);line-height:1.75;margin-bottom:18px;max-width:680px}}
.body-text strong{{color:var(--ink);font-weight:600}}
.svc-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:24px 0}}
.svc-item{{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;font-size:14px;font-weight:500;display:flex;align-items:center;gap:12px;transition:all .25s var(--spring)}}
.svc-item:hover{{border-color:var(--cyan-b);transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.04)}}
.svc-ico{{font-size:18px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--cyan-b),rgba(125,232,255,.06));border-radius:8px;flex-shrink:0}}
.steps{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;margin:32px 0}}
.step{{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:30px 26px;transition:all .3s var(--spring)}}
.step:hover{{border-color:var(--cyan-b);box-shadow:0 14px 36px rgba(0,0,0,.06)}}
.step-n{{font-family:'Cormorant',Georgia,serif;font-style:italic;font-size:46px;color:var(--cyan-dim);margin-bottom:14px;line-height:1;font-weight:400}}
.step h3{{font-size:17px;margin-bottom:8px;font-weight:600;letter-spacing:-.01em}}
.step p{{font-size:14px;color:var(--muted);line-height:1.7}}
.pgrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin:32px 0}}
.pcard{{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:30px 26px;transition:all .3s var(--spring);position:relative}}
.pcard:hover{{transform:translateY(-3px);box-shadow:0 18px 44px rgba(0,0,0,.07)}}
.pcard.feat{{border-color:var(--cyan-dim);background:linear-gradient(180deg,#fff,rgba(125,232,255,.04))}}
.pbadge{{display:inline-block;background:var(--ink);color:#fff;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;padding:5px 12px;border-radius:100px;margin-bottom:18px}}
.pcard.feat .pbadge{{background:linear-gradient(135deg,#7de8ff,#00a8d8);color:var(--ink)}}
.pname{{font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px}}
.pprice{{font-size:42px;letter-spacing:-.04em;line-height:1;font-weight:500}}
.pprice span{{font-size:14px;color:var(--dim);font-weight:400;letter-spacing:0}}
.pdesc{{font-size:12.5px;color:var(--dim);margin:6px 0 22px;padding-bottom:22px;border-bottom:1px solid var(--line)}}
.plist{{list-style:none;display:flex;flex-direction:column;gap:8px;margin-bottom:26px}}
.plist li{{font-size:13.5px;color:var(--muted);display:flex;align-items:center;gap:10px}}
.plist li::before{{content:'';width:5px;height:5px;border-radius:50%;background:var(--cyan-dim);flex-shrink:0}}
.pbtn{{display:block;width:100%;text-align:center;padding:12px;border-radius:100px;font-size:13.5px;font-weight:600;transition:all .25s var(--spring)}}
.pbtn-o{{border:1.5px solid var(--line-d);color:var(--ink)}}.pbtn-o:hover{{border-color:var(--ink);background:var(--ink);color:#fff}}
.pbtn-f{{background:var(--ink);color:#fff;border:1.5px solid var(--ink)}}.pbtn-f:hover{{background:var(--cyan-dim);border-color:var(--cyan-dim)}}
.cta-band{{background:var(--ink);padding:clamp(52px,8vw,90px) clamp(16px,4vw,48px);text-align:center;position:relative;overflow:hidden}}
.cta-band::before{{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(0,168,216,.22),transparent 60%);pointer-events:none}}
.cta-band > *{{position:relative}}
.cta-band h2{{color:#fff;font-size:clamp(26px,4vw,46px);margin-bottom:14px;font-weight:500}}
.cta-band h2 em{{color:var(--cyan-2)}}
.cta-band p{{color:rgba(255,255,255,.55);margin-bottom:26px;font-size:15px;max-width:480px;margin-left:auto;margin-right:auto}}
.cta-btn{{display:inline-flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,#7de8ff,#00c6ff);color:var(--ink);font-weight:600;font-size:15px;padding:14px 36px;border-radius:100px;transition:all .35s var(--spring);box-shadow:0 10px 30px rgba(0,168,216,.35)}}
.cta-btn:hover{{transform:translateY(-2px);box-shadow:0 14px 38px rgba(0,168,216,.5)}}
.fq{{width:100%;background:none;border:none;border-bottom:1px solid var(--line);color:var(--ink);font-family:inherit;font-size:16px;font-weight:500;padding:18px 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:14px;text-align:left;letter-spacing:-.01em}}
.fq:hover{{color:var(--cyan-dim)}}
.fp{{font-size:18px;color:var(--dim);transition:transform .3s;flex-shrink:0}}
.fq.open .fp{{transform:rotate(45deg);color:var(--cyan-dim)}}
.fa{{font-size:14px;color:var(--muted);line-height:1.75;max-height:0;overflow:hidden;transition:max-height .4s,padding .4s}}
.fa.open{{max-height:300px;padding-bottom:20px}}
.links{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
.links a{{font-size:13px;color:var(--muted);background:#fff;border:1px solid var(--line);padding:7px 14px;border-radius:100px;transition:all .2s}}
.links a:hover{{border-color:var(--cyan-dim);color:var(--cyan-dim);transform:translateY(-1px)}}
footer{{background:var(--ink);padding:48px clamp(16px,4vw,48px) 28px;text-align:center}}
.ft-logo{{font-size:15px;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;justify-content:center;font-weight:700;letter-spacing:.04em;text-transform:uppercase}}
.ft-logo svg{{width:24px;height:24px;color:#fff}}
footer p{{font-size:12.5px;color:rgba(255,255,255,.35);line-height:1.75}}
footer a{{color:rgba(255,255,255,.55);transition:color .2s}}
footer a:hover{{color:var(--cyan-2)}}
footer em{{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-2);font-weight:400}}
.fi{{opacity:0;transform:translateY(20px);transition:opacity .9s var(--spring),transform .9s var(--spring)}}
.fi.on{{opacity:1;transform:none}}
.ss-form{{max-width:540px;margin:24px auto 0;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:26px 24px;text-align:left;box-shadow:0 14px 40px rgba(0,0,0,.06)}}
.ss-form-h{{font-size:21px;letter-spacing:-.02em;margin-bottom:6px;color:var(--ink);text-align:center;font-weight:500}}
.ss-form-h em{{color:var(--cyan-dim)}}
.ss-form-sub{{font-size:13px;color:var(--muted);text-align:center;margin-bottom:18px;line-height:1.5}}
.ss-row{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}}
.ss-fg{{display:flex;flex-direction:column;margin-bottom:10px}}
.ss-fg label{{font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px}}
.ss-fg input,.ss-fg select{{width:100%;background:var(--paper-2);border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-size:14px;color:var(--ink);font-family:inherit;outline:none;transition:all .2s}}
.ss-fg input:focus,.ss-fg select:focus{{border-color:var(--cyan-dim);background:#fff;box-shadow:0 0 0 4px rgba(0,168,216,.1)}}
.ss-submit{{display:block;width:100%;background:var(--ink);color:#fff;border:none;font-family:inherit;font-weight:600;font-size:14.5px;padding:14px;border-radius:100px;cursor:pointer;transition:all .25s var(--spring);margin-top:6px;letter-spacing:.01em}}
.ss-submit:hover{{background:var(--cyan-dim);transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,168,216,.3)}}
.ss-foot{{font-size:11.5px;color:var(--dim);text-align:center;margin-top:10px}}
.ss-ok{{display:none;background:rgba(22,163,74,.07);border:1px solid rgba(22,163,74,.22);border-radius:12px;padding:18px;text-align:center;color:var(--green);font-size:14px;font-weight:500;margin-top:14px}}
.ss-err{{display:none;font-size:12px;color:var(--red);text-align:center;margin-top:8px}}
/* social-proof bar shown just under the form */
.proof{{margin-top:18px;display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);letter-spacing:.02em}}
.proof b{{color:var(--ink);font-weight:600}}
.proof .star{{color:var(--gold)}}
@media(max-width:640px){{
  h1{{font-size:30px}}
  .steps,.pgrid,.svc-grid,.ss-row{{grid-template-columns:1fr}}
  header{{height:58px}}
  .logo-by{{display:none}}
}}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4BZHQMG0RF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','G-4BZHQMG0RF');</script>
</head>
<body>
<header>
<a href="{SITE}" class="logo"><svg viewBox="0 0 28 28" fill="none" width="22" height="22"><polygon points="14,1 27,7.5 27,20.5 14,27 1,20.5 1,7.5" fill="none" stroke="#b08a3e" stroke-width="1.2" opacity=".7"/><polygon points="14,6 22,10 22,18 14,22 6,18 6,10" fill="#b08a3e" opacity=".12"/><polygon points="14,10 18,12 18,16 14,18 10,16 10,12" fill="#b08a3e" opacity=".45"/></svg><span>StaticSwift</span></a>
<a class="hcta" href="#ss-seo-form" data-cta-from="seo-{niche_slug}-{city_slug}">Get Started from £149</a>
</header>

<div class="hero">
<div class="hero-tag">{_esc(city_display)}</div>
<h1>{n['h1_label']} Website Design in {_esc(city_display)} — <em>From £149</em>, built by <em>StaticSwift.</em></h1>
<p class="hero-sub">Custom-designed, mobile-ready, delivered in 24 hours. One-time payment. No monthly fees. You own it forever.</p>
<form class="ss-form" id="ss-seo-form" data-source="seo-{niche_slug}-{city_slug}" novalidate>
<div class="ss-form-h">Free preview in <em>24 hours.</em></div>
<div class="ss-form-sub">Tell us where to send it. No payment until you love it.</div>
<div class="ss-row">
<div class="ss-fg"><label>Your name</label><input type="text" name="name" required maxlength="60" placeholder="e.g. Sarah Jones" autocomplete="name"></div>
<div class="ss-fg"><label>Email</label><input type="email" name="delivery_email" required maxlength="100" placeholder="you@email.com" autocomplete="email"></div>
</div>
<div class="ss-row">
<div class="ss-fg"><label>Business type</label><select name="business_type" required>{_dropdown(niche_slug)}</select></div>
<div class="ss-fg"><label>Town / city</label><input type="text" name="location" required maxlength="60" value="{_esc(city_display)}" placeholder="e.g. Manchester" autocomplete="address-level2"></div>
</div>
<input type="text" name="bot-field" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
<button type="submit" class="ss-submit">Get my free preview &rarr;</button>
<div class="ss-foot">No card needed. We reply within 24 hours.</div>
<div class="ss-err" id="ss-seo-err">Something went wrong &mdash; please try again or email hello@staticswift.co.uk.</div>
<div class="ss-ok" id="ss-seo-ok">&#10003; Thanks &mdash; preview lands in your inbox within 24h.</div>
</form>
<div class="trust"><span class="tb">24-hour delivery</span><span class="tb">No monthly fees</span><span class="tb">Free preview first</span><span class="tb">Money-back guarantee</span></div>
</div>

<section style="background:var(--bg2)"><div class="si fi">
<span class="tag">Why you need a website</span>
<h2>Grow your {n['singular']} business <em>online.</em></h2>
<p class="body-text">{_esc(n['intro'])} StaticSwift gives {n['plural']} in {_esc(city_display)} a clean, fast site that converts visitors into enquiries — without the monthly fees.</p>
<p class="body-text">{_esc(n['body_2'])}</p>
</div></section>

<section><div class="si fi">
<span class="tag">What we build for you</span>
<h2>Everything your {n['singular']} website <em>needs.</em></h2>
<p class="body-text">Every StaticSwift website for {n['plural']} includes the features that actually drive enquiries. Custom-designed for your business, not a generic template.</p>
<div class="svc-grid">{service_items}</div>
</div></section>

<section style="background:var(--bg2)"><div class="si fi">
<span class="tag">Process</span>
<h2>Three steps. <em>Done.</em></h2>
<div class="steps">
<div class="step"><div class="step-n">01</div><h3>Tell us about your business</h3><p>Fill in a quick form with your business details. Takes about 3 minutes. No design experience needed.</p></div>
<div class="step"><div class="step-n">02</div><h3>We build your website</h3><p>Within 24 hours you receive a full preview. We design everything based on your brief. You review it before paying anything.</p></div>
<div class="step"><div class="step-n">03</div><h3>Approve and go live</h3><p>Happy with your {n['singular']} website? Pay once and receive your files. One free revision included. Yours forever.</p></div>
</div>
</div></section>

<section><div class="si fi">
<span class="tag">Pricing</span>
<h2>Simple, honest <em>pricing.</em></h2>
<div class="pgrid">
<div class="pcard"><div class="pname">Starter</div><div class="pprice">£149 <span>one-time</span></div><div class="pdesc">Single-page site for {n['plural']}</div><ul class="plist"><li>Custom single-page design</li><li>Mobile responsive</li><li>SEO optimised for {_esc(city_display)}</li><li>Contact form</li><li>24-hour delivery</li><li>1 free revision</li></ul><a class="pbtn pbtn-o" href="#ss-seo-form" data-cta-from="seo-{niche_slug}-{city_slug}">Get started →</a></div>
<div class="pcard feat"><div class="pbadge">Most popular</div><div class="pname">Advanced</div><div class="pprice">£299 <span>one-time</span></div><div class="pdesc">Multi-section site with extras</div><ul class="plist"><li>Everything in Starter</li><li>Gallery section</li><li>Testimonials</li><li>About section</li><li>Premium animations</li><li>Priority build</li></ul><a class="pbtn pbtn-f" href="#ss-seo-form" data-cta-from="seo-{niche_slug}-{city_slug}">Get started →</a></div>
<div class="pcard"><div class="pname">Hosting</div><div class="pprice">£29 <span>one-time</span></div><div class="pdesc">We upload and connect your domain</div><ul class="plist"><li>We handle upload</li><li>Connect your domain</li><li>Free Netlify hosting</li><li>SSL included</li></ul><a class="pbtn pbtn-o" href="#ss-seo-form" data-cta-from="seo-{niche_slug}-{city_slug}">Add to order →</a></div>
</div>
</div></section>

<div class="cta-band fi">
<h2>Ready to grow your {n['singular']} business in <em>{_esc(city_display)}?</em></h2>
<p>Get a free preview in 24 hours. Pay only when you love it.</p>
<a class="cta-btn" href="#ss-seo-form" data-cta-from="seo-{niche_slug}-{city_slug}">Get started — free preview →</a>
</div>

<section style="background:var(--bg2)"><div class="si fi">
<span class="tag">FAQ</span>
<h2>Common questions about {n['singular']} websites in <em>{_esc(city_display)}.</em></h2>
<div class="fi"><button class="fq" onclick="tf(this)">Will my website help me rank on Google in {_esc(city_display)}?<span class="fp">+</span></button><div class="fa">Yes. Every page is built with local SEO best practices including meta tags, schema markup, fast loading speeds, and {_esc(city_display)}-specific content. This helps you appear in local search results.</div></div>
<div class="fi"><button class="fq" onclick="tf(this)">Will my {n['singular']} website work on mobile phones?<span class="fp">+</span></button><div class="fa">Every StaticSwift website is designed mobile-first. Over 70% of customers searching for {n['plural']} in {_esc(city_display)} use their phone, so your site will look perfect on every screen size.</div></div>
<div class="fi"><button class="fq" onclick="tf(this)">How quickly can I get a website for my {n['singular']} business?<span class="fp">+</span></button><div class="fa">We deliver your preview within 24 hours of receiving your brief. Most {_esc(city_display)} clients get theirs the same day. No payment until you approve the design.</div></div>
<div class="fi"><button class="fq" onclick="tf(this)">Do I need to buy hosting separately?<span class="fp">+</span></button><div class="fa">No. We offer free hosting through Netlify, which includes SSL security and fast global loading. The optional £29 hosting add-on means we set it all up for you.</div></div>
</div></section>

<section><div class="si fi">
{nearby_links}
{cross_links}
</div></section>

<footer>
<div class="ft-logo"><svg viewBox="0 0 28 28" fill="none" width="22" height="22"><polygon points="14,1 27,7.5 27,20.5 14,27 1,20.5 1,7.5" fill="none" stroke="#b08a3e" stroke-width="1.2" opacity=".7"/><polygon points="14,6 22,10 22,18 14,22 6,18 6,10" fill="#b08a3e" opacity=".12"/><polygon points="14,10 18,12 18,16 14,18 10,16 10,12" fill="#b08a3e" opacity=".45"/></svg><span>StaticSwift</span></div>
<p>Built by <a href="{SITE}/about/" rel="author"><em style="color:var(--gold2);font-style:italic">Harry Yule</em></a> &middot; UK studio based in Manchester &middot; <a href="{SITE}/">staticswift.co.uk</a></p>
<p style="margin-top:6px;font-size:11px">&copy; StaticSwift &middot; <a href="{SITE}/about/">About</a> &middot; <a href="{SITE}/showcase/">Showcase</a> &middot; <a href="{SITE}/#contact">Start a project</a></p>
</footer>

<script>
function tf(b){{const a=b.nextElementSibling,o=b.classList.contains('open');document.querySelectorAll('.fq').forEach(q=>{{q.classList.remove('open');q.nextElementSibling.classList.remove('open')}});if(!o){{b.classList.add('open');a.classList.add('open')}}}}
const _o=new IntersectionObserver(es=>{{es.forEach(e=>{{if(e.isIntersecting){{e.target.classList.add('on');_o.unobserve(e.target)}}}})}},{{threshold:.05}});
document.querySelectorAll('.fi').forEach(el=>_o.observe(el));
(function(){{
 var f=document.getElementById('ss-seo-form');if(!f)return;
 var src=f.dataset.source||'';
 f.addEventListener('submit',async function(e){{
  e.preventDefault();
  var bot=f.querySelector('[name="bot-field"]');if(bot&&bot.value)return;
  var btn=f.querySelector('.ss-submit');var ok=document.getElementById('ss-seo-ok');var er=document.getElementById('ss-seo-err');
  er.style.display='none';btn.disabled=true;var orig=btn.innerHTML;btn.innerHTML='Sending&hellip;';
  var fd=new FormData(f);var data={{}};fd.forEach(function(v,k){{if(k!=='bot-field')data[k]=v;}});
  data.source=src;data.stage='new-lead';data.createdAt=new Date().toISOString();
  try{{
   var r=await fetch('/.netlify/functions/handle-intake',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(data)}});
   var j=await r.json().catch(function(){{return{{ok:r.ok}};}});
   if(r.ok&&j&&j.ok!==false){{
    f.querySelectorAll('input,select,button').forEach(function(el){{el.style.display='none';}});
    f.querySelector('.ss-form-h').style.display='none';
    f.querySelector('.ss-form-sub').style.display='none';
    f.querySelector('.ss-foot').style.display='none';
    ok.style.display='block';
    try{{if(typeof gtag==='function')gtag('event','generate_lead',{{value:149,currency:'GBP',source:src,business_type:data.business_type,location:data.location}});}}catch(e){{}}
   }}else{{er.style.display='block';btn.disabled=false;btn.innerHTML=orig;}}
  }}catch(err){{er.style.display='block';btn.disabled=false;btn.innerHTML=orig;}}
 }});
}})();
</script>
</body>
</html>
"""
