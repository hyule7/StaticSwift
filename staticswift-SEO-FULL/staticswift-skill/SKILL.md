---
name: staticswift
title: StaticSwift — Anti-AI editorial website builder
description: |
  Build single-page editorial websites for UK tradesmen in Harry Yule's voice
  and visual system. Strict anti-AI guardrails: warm off-blacks not pure #000,
  Boska italic + Switzer + JetBrains Mono, text-wrap balance everywhere,
  tabular-nums on numbers, asymmetric padding, single primary CTA per fold,
  cinematic autonomous-phone proof element, editorial pricing column (not
  card-soup), TrueCost calculator + cream-paper free-audit lead-magnet.
version: 1.0.0
author: Harry Yule, Manchester
license: MIT
tags: [website, web-design, brand-system, conversion, editorial, anti-ai, uk-trades]
---

# StaticSwift design + voice skill

Use this skill whenever you're building, redesigning, auditing, or copy-writing
a website in the **StaticSwift style** — editorial, hand-built, anti-AI,
conversion-aware. Applies to landing pages, programmatic SEO pages, admin
dashboards, and outreach copy.

## When to invoke

- "Build a website in the StaticSwift style"
- "Audit this site for AI tells"
- "Write hero copy in Harry's voice"
- "Generate a price strip / pricing section that doesn't look AI"
- "Build a TrueCost-style calculator"
- "Convert this AI-generated landing page into editorial"
- Any request mentioning StaticSwift, Harry Yule, £149 websites, UK trades, or
  "make it not look AI"

---

## 1 · Brand identity

| Attribute | Value |
|---|---|
| Name | StaticSwift |
| Founder | Harry Yule |
| Location | Manchester, UK |
| Phone | 07502 731 799 |
| Email | hello@staticswift.co.uk |
| Starter price | £149 one-off |
| Advanced price | £299 one-off |
| Optional hosting | £29/mo |
| Delivery | "By tomorrow morning" / "preview in 24h" / "live in 72h" |
| Voice | First-person singular, specific, modest, Manchester-direct |
| Tagline | "One Manchester developer, writing one website at a time" |
| Founding year | 2024 |

**Always credit Harry explicitly.** Every footer should include "by Harry · Manchester".
Every console.log should include a Harry signature. Every email footer should sign off "Harry · StaticSwift".

---

## 2 · Strict colour palette (no exceptions)

```css
:root {
  --ink:       #0e0c0a;  /* warm off-black, NEVER pure #000 */
  --ink-soft:  #2b2723;  /* warm dark grey-brown */
  --paper:     #faf7f1;  /* honey cream, NEVER pure #fff */
  --paper-warm:#f1ebdd;
  --paper-cool:#fdfbf5;
  --terr:      #a86c4d;  /* terracotta — primary accent */
  --terr-deep: #7e4f37;  /* roasted terracotta */
  --terr-pale: #d9a071;  /* terracotta highlight, used sparingly */
}
```

**Banned forever:**
- Pure `#000`, `#fff`, `#000000`, `#ffffff`
- Tailwind grays (`gray-900`, `slate-950`, `neutral-200`)
- Saturated blues (`#3b82f6`, indigo, sky)
- Purple→pink gradients (the classic AI signature)
- Neon green success, neon red error
- Cyan accents (we used these once — never again)

**Severity colors (only for audit/score states):**
- severe → `#d9a071` (terr-pale) with terracotta glow
- poor → `#e3b274` (warm gold)
- good → `#faf7f1` (paper) with white glow

---

## 3 · Typography stack (mandatory)

```html
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=boska@200i,400i,500i,600i,700i,400,500,600,700&f[]=switzer@300,400,500,600,700&display=swap">
```

| Role | Font | Notes |
|---|---|---|
| Display headlines | `'Boska', Georgia, serif` | Italic by default for accents |
| Body | `'Switzer', -apple-system, BlinkMacSystemFont, sans-serif` | 400 / 500 / 600 |
| Mono / labels / numbers | `'JetBrains Mono', ui-monospace, monospace` | All caps for eyebrows, tabular-nums for numbers |

**Required CSS on every page:**
```css
html {
  font-feature-settings: "ss01", "ss02", "cv01", "cv11", "kern", "calt", "liga";
  font-optical-sizing: auto;
  text-rendering: optimizeLegibility;
  hanging-punctuation: first last allow-end;
}
h1, h2, h3, [class*="-h1"], [class*="-title"] {
  text-wrap: balance;
  font-feature-settings: "ss01", "ss02", "kern", "calt", "liga", "dlig", "onum";
  letter-spacing: -0.018em;
}
p, li, dd { text-wrap: pretty; font-variant-numeric: oldstyle-nums proportional-nums; }
[class*="-num"], [class*="-amount"], time { font-variant-numeric: tabular-nums lining-nums; }
```

---

## 4 · The 17 anti-AI tells (hunt + replace every one)

1. **Pure #000 / #fff** → warm off-blacks and creams above
2. **Inter font** → Boska/Switzer/JetBrains Mono
3. **No `text-wrap: balance`** → mandatory on every heading
4. **Generic Tailwind grays** → warm palette only
5. **Hand-built / Premium / Loved / Lightning-fast** → specific Harry-voice
6. **"Get Started" CTAs** → specific verbs ("Send a brief →", "Audit it", "Book your first session")
7. **Three-feature framing** → break with a 4th irregular value
8. **Symmetric 16/24/32 padding** → use non-multiples (`7.4rem`, `8.3rem`, `9.4rem`)
9. **Identical opacity .5/.8** → use off-decimals (`.83`, `.62`, `.77`)
10. **Card-soup pricing** → editorial column with vertical rules, no rounded gradient boxes
11. **"Most Popular" badge** → "What most people pick" (rotated stamp)
12. **Star ratings as Unicode ★** → SVG with half-star support
13. **All eyebrows ALL CAPS letter-spaced** → mix in italic Boska sentence-case
14. **Same `ease-out 300ms` everywhere** → different `cubic-bezier` per section
15. **Same fade-up-from-30px on every section** → vary stagger, direction, easing per section
16. **No `<time datetime="">` semantics** → wrap all dates with `<time datetime="2026-05-30">`
17. **No skip-link, no print stylesheet, no `prefers-reduced-motion`** → all three required

---

## 5 · Voice + copy patterns

### Harry's voice (first-person singular, specific, modest)

✅ DO:
- "I code websites for UK tradesmen"
- "out of my flat in Manchester"
- "by tomorrow morning"
- "you don't pay unless it's right"
- "No CMS, no subscription, no agency markup"
- "Brief by 3pm, preview by 9am"
- "Zip of the code emailed to you on launch"
- "Indexed by Google before you're billed"

❌ DON'T:
- "We build" / "Our team" / "Our mission"
- "Lightning-fast" / "Premium" / "Handcrafted"
- "Loved by hundreds" / "Trusted by businesses"
- "Get started today" / "Start your journey"
- "World-class" / "Cutting-edge" / "Best-in-class"

### Vary the same fact 4+ ways

| Fact | Variations |
|---|---|
| 24 hours | "by tomorrow morning", "overnight", "in one day", "in 24h", "preview by 9am", "live in 72h" |
| £149 | "£149 flat", "£149 once", "one-off £149", "less than a Wix annual" |
| You don't pay first | "pay only if you love it", "you don't pay unless it's right", "no card stored", "approve first, then pay" |

### Pricing feature lines (NOT generic SaaS):

Instead of "Lightning-fast" → "Loads in under a second on a 3G phone"
Instead of "SEO-ready" → "Indexed by Google before you're billed"
Instead of "You own it" → "Zip of the code emailed to you on launch"

---

## 6 · Required layout patterns

### Hero
- **Single primary CTA only** (one form, one button)
- Cream paper background (no dark by default)
- Headline: italic Boska accents on key word + Harry-name accent
- Autonomous-scrolling phone mockup in corner showing a real built site
- Email-only form initially (other fields expand on submit if needed)
- "Scroll for proof ↓" italic lure at the bottom

### Pricing strip (editorial menu, NOT card-soup)
- Cream paper background
- 3 columns separated by **1px vertical rules** (no rounded cards)
- Giant italic Boska price (clamp 3.6-5.4rem, tabular-nums)
- Mono terracotta tier label
- Feature list with **terracotta `→` bullets** + **1px dashed dividers**
- "Most popular" replaced with "What most people pick" — rotated -2° terracotta stamp
- CTAs: hand-cut border-radius (`1px 3px 2px 4px`)

### TrueCost calculator
- 5 real inputs: monthly fee chips, Google rank chips, enquiries chips, customer-value slider, years-on-platform slider
- Live output panel styled as torn-paper invoice
- Big italic Boska total with terracotta `£`
- Breakdown: platform fees / lost clicks / missed enquiries / sunk fees
- Payback callout: "£149 pays itself back in N days"

### Audit
- Cream-paper letterhead with ruled lines + punch-holes left margin
- Single URL input on a dashed line, "Run Audit" as a rotated terracotta stamp
- Result has 3 cinematic scenes: score panel (dark ink), issues panel (cream), fix CTA (dark)
- Score in massive italic Boska with severity color
- Issues styled as editorial newspaper items
- Single palette throughout — no cyan, no neon

### Comparison cards
- 3 cards in clean grid, generous gap
- Brand title + grade letter in clear top row (head-row grid, no overlap)
- Grade letters use only terracotta-deep
- Data rows: dt label above dd value, dashed dividers
- Roast post-its above each card (yellow + green for SS)
- NO flames, NO lighter, NO scorched bg (we tried, it was awful)

---

## 7 · Motion guidelines

Different `cubic-bezier` curve per section so motion doesn't feel uniform:

| Section | Easing |
|---|---|
| Hero | `cubic-bezier(.16, 1.04, .3, 1)` (overshoot) |
| Pricing | `cubic-bezier(.65, .03, .26, 1)` (power-down) |
| FAQ / Calculator | `cubic-bezier(.34, 1.18, .54, .98)` (soft bounce) |
| Trust band | `cubic-bezier(.4, .0, .2, 1)` (material standard) |
| Contact | `cubic-bezier(.22, .61, .36, 1)` (smooth out) |
| Spring buttons | `cubic-bezier(.34, 1.56, .64, 1)` |

**Required:**
- `@media (prefers-reduced-motion: reduce) { … }` — kill all animation
- `will-change` only on actively animating elements
- No `transform: scale(1.05)` hovers — use offset shadows, color shifts, micro-rotations

---

## 8 · Mandatory accessibility + dev signals

These are non-negotiable, ship-blockers if missing:

```html
<!-- Skip link — first thing in body -->
<a class="skip-link" href="#main">Skip to content</a>

<!-- Real time semantics -->
<time datetime="2026-05-30">30 May 2026</time>

<!-- Print stylesheet -->
<style media="print">
  body { background: white !important; color: black !important; }
  .skip-link, [class*="chat"], [class*="popup"] { display: none !important; }
</style>

<!-- Console signature -->
<script>console.log('%cStaticSwift — hand-built in Manchester.', 'font:600 14px system-ui;color:#0e0c0a');</script>
```

Plus:
- Touch targets ≥ 44px (Apple HIG)
- Form inputs ≥ 16px font (prevents iOS auto-zoom)
- Skip-to-content link visible on focus
- `prefers-reduced-motion: reduce` honored
- Real `<figcaption>` on important figures
- Semantic `<article>`, `<aside>`, `<section>`

---

## 9 · Conversion tactics that ship by default

1. **Sticky CTA bar** — appears at 32% scroll, hides over interactive sections (`#audit`, `#loss-calculator`, `#compare`, `#contact`)
2. **Social-proof toasts** — every 32-40s, randomised, real-sounding names + UK cities
3. **Exit-intent nudge** — fires when cursor leaves through top after 20s
4. **Openings-this-week** pill — pseudo-deterministic by ISO week
5. **Console.log signature** — Harry's calling card in DevTools
6. **Last-updated timestamp** in footer with real date

---

## 10 · Admin features (for the StaticSwift dashboard)

- Autopilot with 20 UK regions (north-west, london-n/s/e/w, scotland-c/n/s, cornwall, lake-district, jersey-iom)
- 80+ niches (barber, plumber, electrician, etc — never "web design")
- Excludes: web-designer keywords, big-business signals, biz-name patterns
- Email-draft editor with localStorage override
- Prospects table with filter + CSV export
- Analytics diagnose (Netlify Blobs check)
- PECR-compliant outreach footer mandatory on every template

---

## 11 · File structure for a new StaticSwift site

```
/
├── index.html              ← single-page editorial, all sections inline
├── /examples/              ← real built client sites (e.g. fade-and-blade)
├── /[niche]-[location]/    ← programmatic SEO pages (barber-bromley etc)
├── /admin/                 ← password-gated dashboard
│   ├── index.html
│   ├── admin.js
│   └── admin.css
├── /netlify/functions/     ← serverless: track-event, analyze-site, etc
└── /sitemap.xml
```

---

## 12 · What to refuse

If the user asks for any of these, push back:

- "Make it look more like Stripe / Vercel" (they're SaaS, this is editorial)
- "Add a gradient background" (we use paper textures and radial glows, not gradients)
- "Add some 3D illustrations" (real photos or nothing)
- "Make the buttons more rounded" (1-4px irregular border-radius only)
- "Add a logo grid for 'Trusted by'" (no fake logos, ever)
- "Make the headline bigger" (`clamp(2.4rem, 4.6vw, 4rem)` is the cap)
- "Add an AI chatbot" (we have a rule-based chat — never call it AI)

---

## 13 · Quick checklist before shipping any page

- [ ] No pure `#000` or `#fff` anywhere
- [ ] No "Premium", "Hand-built", "Loved", "Lightning-fast" in copy
- [ ] Single primary CTA above the fold
- [ ] Headline uses italic Boska accent + has `text-wrap: balance`
- [ ] Numbers use `font-variant-numeric: tabular-nums`
- [ ] At least one `<time datetime="">` in the page
- [ ] Skip-to-content link present
- [ ] `prefers-reduced-motion` rule present
- [ ] Print stylesheet present
- [ ] Console.log Harry signature present
- [ ] Touch targets ≥ 44px on mobile
- [ ] Inputs ≥ 16px font on mobile
- [ ] Real Harry photo or handwritten signature SVG in footer
- [ ] Footer credits "by Harry · Manchester"
- [ ] Last-updated `<time>` in footer

---

## License

MIT © Harry Yule, StaticSwift, Manchester. Use freely, attribute kindly.
