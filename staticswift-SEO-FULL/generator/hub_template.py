"""
Hub page template — niche-level landing pages.

Each niche hub lives at /<niche>-website-design/ and links down to every
city we cover for that niche. This consolidates internal link authority
into a single canonical page per niche, which then funnels signal down to
the leaf city pages.
"""
import json
import html
from . import niches as niches_lib
from . import locales as locales_lib

SITE = "https://staticswift.co.uk"


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def render_niche_hub(niche_slug: str, cities: list[str]) -> str:
    """Render a hub page listing all cities for the given niche."""
    n = niches_lib.get(niche_slug)
    page_path = f"/{niche_slug}-website-design/"
    page_url = SITE + page_path

    # Sort cities, then bucket alphabetically for a clean A-Z list
    cities_sorted = sorted(cities)
    by_letter = {}
    for c in cities_sorted:
        letter = locales_lib.city_display(c)[0].upper()
        by_letter.setdefault(letter, []).append(c)

    letters_html = ""
    for letter in sorted(by_letter):
        items = "".join(
            f'<li><a href="{SITE}/{niche_slug}-website-design-{c}/">{_esc(locales_lib.city_display(c))}</a></li>'
            for c in sorted(by_letter[letter])
        )
        letters_html += (
            f'<div class="letter-block">'
            f'<div class="letter">{letter}</div>'
            f'<ul class="city-list">{items}</ul>'
            f'</div>'
        )

    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": f"{n['h1_label']} Website Design", "item": page_url},
        ],
    }
    org_ref = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": f"{n['h1_label']} Website Design",
        "serviceType": "Website Design",
        "category": f"{n['singular']} website design",
        "provider": {"@id": SITE + "/#org"},
        "areaServed": {"@type": "Country", "name": "United Kingdom"},
        "offers": [
            {"@type": "Offer", "name": "Starter", "price": "149", "priceCurrency": "GBP"},
            {"@type": "Offer", "name": "Advanced", "price": "299", "priceCurrency": "GBP"},
        ],
    }
    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": SITE + "/#org",
        "name": "StaticSwift",
        "url": SITE + "/",
        "description": "StaticSwift handcrafts fast, premium static websites for UK small businesses. Delivered in 24 hours from £149.",
        "email": "hello@staticswift.co.uk",
        "founder": {"@type": "Person", "@id": SITE + "/about/#harry", "name": "Harry Yule"},
        "areaServed": {"@type": "Country", "name": "United Kingdom"},
    }

    title = f"{n['h1_label']} Website Design &mdash; UK Coverage | StaticSwift"
    meta_desc = (
        f"Bespoke {n['singular']} website design across the UK. "
        f"Custom-built, mobile-ready, delivered in 24 hours from £149. "
        f"Pick your town below — we cover {len(cities_sorted):,} UK locations."
    )

    return f"""<!DOCTYPE html>
<html lang="en-gb">
<head>
<!-- ss:hub-v1 -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{_esc(meta_desc)}">
<link rel="canonical" href="{page_url}">
<meta property="og:title" content="{_esc(title)}">
<meta property="og:description" content="{_esc(meta_desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url}">
<link rel="alternate" hreflang="en-gb" href="{page_url}">
<script type="application/ld+json">
{json.dumps(org, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(org_ref, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(breadcrumb, ensure_ascii=False)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{{--bg:#fff;--bg2:#f9f8f6;--bg3:#f2f0ec;--ink:#0a0a0a;--muted:#6a6a6a;--dim:#9a9a9a;--gold:#b08a3e;--gold2:#c9a256;--gold-b:rgba(176,138,62,.2);--border:rgba(0,0,0,.07);--green:#16a34a;--r:16px}}
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}}
body{{background:var(--bg);color:var(--ink);font-family:'Outfit',sans-serif;line-height:1.6}}
h1,h2,h3{{font-family:'Instrument Serif',serif;font-weight:400;line-height:1.1}}
a{{color:inherit;text-decoration:none}}
header{{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.9);border-bottom:1px solid var(--border);padding:0 clamp(16px,4vw,48px);height:60px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(20px) saturate(1.8)}}
.logo{{font-family:'Instrument Serif',serif;font-size:18px;display:flex;align-items:center;gap:8px}}
.hcta{{background:var(--ink);color:#fff;padding:10px 22px;border-radius:100px;font-size:13px;font-weight:600;transition:all .25s}}
.hcta:hover{{opacity:.85}}
.hero{{padding:clamp(48px,8vw,100px) clamp(16px,4vw,48px) clamp(40px,6vw,72px);text-align:center;border-bottom:1px solid var(--border)}}
.hero-tag{{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold-b);padding:6px 16px;border-radius:100px;margin-bottom:24px}}
h1{{font-size:clamp(28px,5vw,56px);letter-spacing:-.04em;max-width:820px;margin:0 auto 18px}}
h1 em{{font-style:italic;color:var(--gold)}}
.hero-sub{{font-size:clamp(15px,2vw,18px);color:var(--muted);max-width:580px;margin:0 auto 24px;font-weight:300;line-height:1.6}}
.trust{{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}}
.tb{{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);border:1px solid var(--border);border-radius:100px;padding:6px 14px}}
.tb::before{{content:'\\2713';color:var(--green);font-weight:700}}
section{{padding:clamp(48px,8vw,100px) clamp(16px,4vw,48px)}}
.si{{max-width:1080px;margin:0 auto}}
h2{{font-size:clamp(24px,4vw,40px);letter-spacing:-.03em;margin-bottom:14px}}
h2 em{{font-style:italic;color:var(--gold)}}
.tag{{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:block}}
.body-text{{font-size:15px;color:var(--muted);line-height:1.8;margin-bottom:18px;max-width:680px}}
.svc-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:24px 0}}
.svc-item{{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;font-size:14px;font-weight:500;display:flex;align-items:center;gap:10px}}
.svc-ico{{font-size:18px}}
.letter-grid{{column-count:auto;column-width:240px;column-gap:36px;margin-top:18px}}
.letter-block{{break-inside:avoid;page-break-inside:avoid;margin-bottom:28px}}
.letter{{font-family:'Instrument Serif',serif;font-size:28px;color:var(--gold);margin-bottom:6px;font-style:italic}}
.city-list{{list-style:none;display:flex;flex-direction:column;gap:2px}}
.city-list li a{{font-size:14px;color:var(--ink);display:block;padding:4px 0;border-bottom:1px solid transparent;transition:all .15s}}
.city-list li a:hover{{color:var(--gold);border-bottom-color:var(--gold-b)}}
.cta-band{{background:var(--ink);padding:clamp(48px,8vw,80px) clamp(16px,4vw,48px);text-align:center}}
.cta-band h2{{color:#fff;font-size:clamp(24px,4vw,40px);margin-bottom:14px}}
.cta-band h2 em{{color:var(--gold2)}}
.cta-band p{{color:rgba(255,255,255,.5);margin-bottom:24px;font-size:15px}}
.cta-btn{{display:inline-block;background:var(--gold);color:var(--ink);font-weight:600;font-size:16px;padding:14px 36px;border-radius:100px;transition:all .3s}}
.cta-btn:hover{{background:var(--gold2);transform:translateY(-2px)}}
.stat-row{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;margin:36px 0 0}}
.stat{{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:22px 22px}}
.stat .n{{font-family:'Instrument Serif',serif;font-size:36px;color:var(--gold);line-height:1;margin-bottom:6px}}
.stat .l{{font-size:12px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.1em}}
footer{{background:var(--ink);padding:40px clamp(16px,4vw,48px) 24px;text-align:center;color:rgba(255,255,255,.35)}}
footer p{{font-size:12px;line-height:1.7;margin:0 0 6px}}
footer a{{color:inherit}}
footer a:hover{{color:var(--gold2)}}
footer em{{font-style:italic;color:var(--gold2)}}
@media(max-width:600px){{.svc-grid{{grid-template-columns:1fr}}}}
</style>
</head>
<body>
<header>
<a href="{SITE}" class="logo"><svg viewBox="0 0 28 28" fill="none" width="22" height="22"><polygon points="14,1 27,7.5 27,20.5 14,27 1,20.5 1,7.5" fill="none" stroke="#b08a3e" stroke-width="1.2" opacity=".7"/><polygon points="14,6 22,10 22,18 14,22 6,18 6,10" fill="#b08a3e" opacity=".12"/><polygon points="14,10 18,12 18,16 14,18 10,16 10,12" fill="#b08a3e" opacity=".45"/></svg><span>StaticSwift</span></a>
<a class="hcta" href="/order.html?niche={niche_slug}">Get Started from £149</a>
</header>

<div class="hero">
<div class="hero-tag">{_esc(n['h1_label'])} &middot; UK Coverage</div>
<h1>{n['h1_label']} Website Design — <em>From £149</em>, built in 24 hours by <em>StaticSwift.</em></h1>
<p class="hero-sub">Bespoke {n['singular']} websites delivered in 24 hours. One-time payment, mobile-ready, SEO-optimised for the town you serve. We cover <strong>{len(cities_sorted):,} UK locations</strong>.</p>
<div class="trust"><span class="tb">24-hour delivery</span><span class="tb">No monthly fees</span><span class="tb">Free preview first</span></div>
</div>

<section style="background:var(--bg2)"><div class="si">
<span class="tag">For {n['singular']}s</span>
<h2>Built specifically for <em>{n['plural']}.</em></h2>
<p class="body-text">{_esc(n['intro'])} {_esc(n['body_2'])}</p>
<div class="svc-grid">
{''.join(f'<div class="svc-item"><span class="svc-ico">{n["icon"]}</span>{_esc(s)}</div>' for s in n['services'])}
</div>
<div class="stat-row">
<div class="stat"><div class="n">£149</div><div class="l">From, one-time</div></div>
<div class="stat"><div class="n">24h</div><div class="l">From brief to preview</div></div>
<div class="stat"><div class="n">{len(cities_sorted):,}</div><div class="l">UK towns covered</div></div>
<div class="stat"><div class="n">247+</div><div class="l">Live sites delivered</div></div>
</div>
</div></section>

<div class="cta-band">
<h2>Free preview in <em>24 hours.</em></h2>
<p>Tell us about your {n['singular']} business. No payment until you love it.</p>
<a class="cta-btn" href="/order.html?niche={niche_slug}">Start a project &rarr;</a>
</div>

<section><div class="si">
<span class="tag">Find your town</span>
<h2>{n['h1_label']} website design — <em>by location.</em></h2>
<p class="body-text">Tap your town below to see a {n['singular']}-specific landing page tailored to local search.</p>
<div class="letter-grid">{letters_html}</div>
</div></section>

<footer>
<p>Built by <a href="{SITE}/about/" rel="author"><em>Harry Yule</em></a> &middot; UK studio based in Manchester &middot; <a href="{SITE}/">staticswift.co.uk</a></p>
<p>&copy; StaticSwift &middot; <a href="{SITE}/about/">About</a> &middot; <a href="{SITE}/showcase/">Showcase</a> &middot; <a href="{SITE}/order.html">Start a project</a></p>
</footer>
</body>
</html>
"""
