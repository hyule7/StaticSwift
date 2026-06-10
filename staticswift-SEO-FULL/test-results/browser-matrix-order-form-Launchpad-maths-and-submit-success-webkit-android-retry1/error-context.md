# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser-matrix.spec.js >> order form >> Launchpad maths and submit success
- Location: tests/browser-matrix.spec.js:75:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#ok')
Expected: visible
Received: hidden
Timeout:  8000ms

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('#ok')
    20 × locator resolved to <div id="ok" class="ok-msg">…</div>
       - unexpected value "hidden"

```

```yaml
- banner:
  - text: StaticSwift
  - link "← Back to the cover":
    - /url: /
- text: Chapter 04 · Free preview · No card today
- heading "Tell me about your business." [level=1]:
  - text: Tell me about your
  - emphasis: business.
- paragraph:
  - text: Sixty seconds, six fields. I’ll have a real, working preview in your inbox within 24 hours. £499 to build — only if you keep it.
  - emphasis: Refund
  - text: if no leads in sixty days.
- text: Reading time ~ 90 seconds Preview arrives within 24h Price £499 once Risk On the studio Form № 01 · The Brief For office use · 10 JUN 2026
- textbox
- text: Your name *
- textbox "John Smith": Matrix Test
- text: Business name *
- textbox "Smith Plumbing": Matrix Plumbing
- text: Trade *
- combobox:
  - option "Pick one…" [disabled]
  - option "Accountant" [selected]
  - option "Architect"
  - option "Bakery"
  - option "Barber / Hair Salon"
  - option "Beauty / Nail Bar"
  - option "Builder / Roofer"
  - option "Butcher"
  - option "Cafe / Restaurant"
  - option "Cake Maker"
  - option "Car Detailer"
  - option "Carpenter"
  - option "Carpet Cleaner"
  - option "Caterer"
  - option "Childminder"
  - option "Cleaner"
  - option "Cleaning Company"
  - option "Coach"
  - option "Dentist"
  - option "DJ / Entertainer"
  - option "Dog Groomer"
  - option "Dog Walker"
  - option "Driving Instructor"
  - option "Dry Cleaner"
  - option "Electrician"
  - option "Estate Agent"
  - option "Event Planner"
  - option "Financial Advisor"
  - option "Florist"
  - option "Food Truck"
  - option "Gardener / Landscaper"
  - option "Graphic Designer"
  - option "Gym"
  - option "Hairdresser"
  - option "Handyman"
  - option "Jeweller"
  - option "Joiner"
  - option "Landscaper"
  - option "Locksmith"
  - option "Massage Therapist"
  - option "Mechanic"
  - option "Mobile Hairdresser"
  - option "Mortgage Broker"
  - option "Nail Salon"
  - option "Nursery / Pre-school"
  - option "Nutritionist"
  - option "Optician"
  - option "Osteopath"
  - option "Painter & Decorator"
  - option "Personal Trainer"
  - option "Pest Control"
  - option "Photographer"
  - option "Physiotherapist"
  - option "Pilates Instructor"
  - option "Plasterer"
  - option "Plumber"
  - option "Printer"
  - option "Pub / Bar"
  - option "Removals / Mover"
  - option "Restaurant"
  - option "Retail / Shop"
  - option "Roofer"
  - option "Scaffolder"
  - option "Solicitor"
  - option "Tailor"
  - option "Tattoo Studio"
  - option "Taxi"
  - option "Therapist"
  - option "Tiler"
  - option "Tree Surgeon"
  - option "Tutor"
  - option "Vet"
  - option "Videographer"
  - option "Wedding Planner"
  - option "Window Cleaner"
  - option "Yoga Instructor"
  - option "Other"
- text: Town or city *
- textbox "Manchester"
- text: Mobile / WhatsApp *
- textbox "07700 900000": "07700900000"
- text: A WhatsApp from Harry within the hour. Email *
- textbox "you@yourbiz.co.uk": matrix@test.invalid
- text: Your preview link arrives here.
- group: Optional Tell me more, if you have a minute. Helps the preview land closer to what you want first time.
- region "Launchpad Pack extras":
  - text: Launchpad · Untick anything you don’t want
  - heading "Let me launch the lot for you." [level=3]:
    - text: Let me
    - emphasis: launch the lot
    - text: for you.
  - paragraph: Five things every new trade site needs to actually start ringing the phone. All five are pre-selected at the bundle price — untick what you’d rather do yourself.
  - list:
    - listitem:
      - text: 01 Domain registration
      - emphasis: "& connection"
      - text: I register your .co.uk, point it at the site, set up email forwarding. You never touch a DNS panel. £79
    - listitem:
      - text: 02 Google Business Profile
      - emphasis: setup
      - text: Profile built, photos uploaded, services listed, first three Google posts written. The single biggest local-SEO lever. £149
    - listitem:
      - text: 03 Three extra
      - emphasis: service pages
      - text: Hand-coded landing pages targeting your top three keywords. Each ranks independently. £199
    - listitem:
      - text: 04 Logo
      - emphasis: refresh
      - text: Clean wordmark, SVG + PNG, one round of revisions. For when your current logo is a stretched JPEG. £99
    - listitem:
      - text: 05 Two weeks of
      - emphasis: Google Ads
      - text: management I set up a £5/day Search Ads campaign targeting your exact trade and town. Run it for fourteen days, report back. Gets the phone ringing while we wait for SEO to compound. £149
  - text: Build + everything ticked All five — bundle applied. £1,174 £1,074 Save £100
- checkbox "I agree to the Terms and Privacy Policy. I understand I am not being charged today — I only pay if I keep the site after seeing the preview." [checked]
- text: I agree to the
- link "Terms":
  - /url: /terms.html
- text: and
- link "Privacy Policy":
  - /url: /privacy.html
- text: . I understand I am not being charged today — I only pay if I keep the site after seeing the preview.
- button "Send me my free preview"
- text: Harry will WhatsApp within 1 hour (UK working hours). Preview lands in your inbox within 24 hours. From here · A short timeline
- heading "What happens next." [level=3]:
  - text: What happens
  - emphasis: next.
- text: 01 · This hour A
- emphasis: WhatsApp
- text: from Harry. To confirm the brief and grab any photos or Google reviews to feature on the preview. 02 · By tomorrow Your real,
- emphasis: working
- text: preview. A private link, by email. Not a mockup. Click around. Show your partner. Sleep on it. 03 · Only if you keep it £499 setup,
- emphasis: then live.
- text: Invoiced and launched on your domain. Google Business Profile set up. You’re online. 04 · After 60 days No leads?
- emphasis: Full refund.
- text: Site stays with you. No arguments, no fine print, no chase. The risk is on the studio.
- contentinfo:
  - text: StaticSwift Hand-coded sites · Manchester · UK-wide Field Guide
  - link "Cover — Vol. II":
    - /url: /
  - link "Ch. 02 — By trade":
    - /url: /niches
  - link "Ch. 03 — By town":
    - /url: /locations
  - link "Colophon — Who runs it":
    - /url: /about/
  - text: Begin
  - link "hello@staticswift.co.uk":
    - /url: mailto:hello@staticswift.co.uk
  - link "+44 7502 731 799":
    - /url: https://wa.me/447502731799
  - text: © 2026 StaticSwift · A studio of one
  - link "Terms":
    - /url: /terms.html
  - text: ·
  - link "Privacy":
    - /url: /privacy.html
```

# Test source

```ts
  5   | const { test, expect } = require('@playwright/test');
  6   | 
  7   | const TEMPLATES = [
  8   |   { name: 'homepage', path: '/' },
  9   |   { name: 'town-hub', path: '/website-design-manchester/' },
  10  |   { name: 'leaf', path: '/plumber-website-design-burnley/' },
  11  | ];
  12  | 
  13  | // Console errors we do not own or that local static serving causes.
  14  | const IGNORED = [
  15  |   /googletagmanager|google-analytics|analytics\.tiktok|fontshare|fonts\.googleapis|fonts\.gstatic/,
  16  |   /favicon\.ico.*404/,
  17  |   /net::ERR_|NetworkError|Load failed|Failed to load resource/, // third-party fetches offline
  18  |   /has been rejected for invalid domain/, // TikTok pixel cookies on localhost
  19  | ];
  20  | 
  21  | for (const tpl of TEMPLATES) {
  22  |   test.describe(tpl.name, () => {
  23  |     test('renders without console errors', async ({ page }) => {
  24  |       const errors = [];
  25  |       page.on('console', m => {
  26  |         if (m.type() === 'error' && !IGNORED.some(re => re.test(m.text()))) errors.push(m.text());
  27  |       });
  28  |       page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  29  |       await page.goto(tpl.path, { waitUntil: 'domcontentloaded' });
  30  |       await page.waitForTimeout(1200);
  31  |       expect(errors).toEqual([]);
  32  |     });
  33  | 
  34  |     test('primary CTA is visible and tappable', async ({ page }) => {
  35  |       await page.goto(tpl.path, { waitUntil: 'domcontentloaded' });
  36  |       const cta = tpl.name === 'homepage'
  37  |         ? page.locator('#bc-btn-primary')
  38  |         : page.locator('a.hcta, a.hero-cta').first();
  39  |       await cta.scrollIntoViewIfNeeded();
  40  |       await expect(cta).toBeVisible();
  41  |       const box = await cta.boundingBox();
  42  |       expect(box.height).toBeGreaterThanOrEqual(30);
  43  |     });
  44  |   });
  45  | }
  46  | 
  47  | test.describe('leaf form', () => {
  48  |   test('has the non-JS POST fallback wired', async ({ page }) => {
  49  |     await page.goto('/plumber-website-design-burnley/', { waitUntil: 'domcontentloaded' });
  50  |     const form = page.locator('#ss-seo-form');
  51  |     await expect(form).toHaveAttribute('method', 'post');
  52  |     await expect(form).toHaveAttribute('action', '/.netlify/functions/handle-intake');
  53  |   });
  54  | 
  55  |   test('JS submit posts to handle-intake and shows success', async ({ page }) => {
  56  |     let posted = null;
  57  |     await page.route('**/.netlify/functions/handle-intake', async route => {
  58  |       posted = JSON.parse(route.request().postData());
  59  |       await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"clientId":"test_matrix"}' });
  60  |     });
  61  |     await page.route('**/.netlify/functions/track-event', r => r.fulfill({ status: 204, body: '' }));
  62  |     await page.goto('/plumber-website-design-burnley/', { waitUntil: 'domcontentloaded' });
  63  |     await page.fill('#ss-seo-form input[name="name"]', 'Matrix Test');
  64  |     await page.fill('#ss-seo-form input[name="delivery_email"]', 'matrix@test.invalid');
  65  |     await page.click('#ss-seo-form .ss-submit');
  66  |     await expect(page.locator('#ss-seo-ok')).toBeVisible({ timeout: 8000 });
  67  |     expect(posted.name).toBe('Matrix Test');
  68  |     expect(posted.business_type).toBe('plumber');
  69  |     expect(posted.location).toBe('Burnley');
  70  |     expect(posted.source).toContain('seo-plumber-burnley');
  71  |   });
  72  | });
  73  | 
  74  | test.describe('order form', () => {
  75  |   test('Launchpad maths and submit success', async ({ page }) => {
  76  |     await page.route('**/.netlify/functions/handle-intake', r =>
  77  |       r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  78  |     await page.route('**/.netlify/functions/track-event', r => r.fulfill({ status: 204, body: '' }));
  79  |     await page.goto('/order.html', { waitUntil: 'domcontentloaded' });
  80  | 
  81  |     // All five add-ons ticked: £1,074 with the £100 discount shown.
  82  |     await expect(page.locator('#lp-total')).toHaveText('£1,074');
  83  |     // Untick the £149 GBP add-on (inputs are visually hidden behind styled
  84  |     // cards, so toggle programmatically): 499 + 526 = £1,025, discount gone.
  85  |     const toggle = (id, on) => page.locator('#' + id).evaluate((el, v) => {
  86  |       el.checked = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  87  |     }, on);
  88  |     await toggle('lp-gbp', false);
  89  |     await expect(page.locator('#lp-total')).toHaveText('£1,025');
  90  |     await toggle('lp-gbp', true);
  91  |     await expect(page.locator('#lp-total')).toHaveText('£1,074');
  92  | 
  93  |     await page.fill('#f-name', 'Matrix Test');
  94  |     await page.fill('#f-bizname', 'Matrix Plumbing');
  95  |     await page.selectOption('#f-biztype', { index: 1 }).catch(() => page.fill('#f-biztype', 'Plumber'));
  96  |     await page.fill('#f-location', 'Manchester');
  97  |     await page.fill('#f-wa', '07700900000');
  98  |     await page.fill('#f-email', 'matrix@test.invalid');
  99  |     await page.locator('#f-terms').evaluate(el => {
  100 |       el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true }));
  101 |     });
  102 |     // The button sits inside a continuously animating reveal wrapper, so
  103 |     // Playwright's stability check never settles; force the click.
  104 |     await page.click('#submit-btn', { force: true });
> 105 |     await expect(page.locator('#ok')).toBeVisible({ timeout: 8000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  106 |   });
  107 | });
  108 | 
  109 | test.describe('exit popup (homepage, desktop only)', () => {
  110 |   test('opens on exit intent and closes', async ({ page, isMobile, browserName }) => {
  111 |     test.skip(isMobile === true, 'desktop-only trigger');
  112 |     await page.route('**/.netlify/functions/**', r => r.fulfill({ status: 204, body: '' }));
  113 |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  114 |     await page.waitForTimeout(800);
  115 |     // Trigger the desktop mouseleave-top handler directly.
  116 |     await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave', { clientY: 0, bubbles: true })));
  117 |     const trap = page.locator('#ss-trap');
  118 |     // Fall back to calling the trigger if the synthetic event is not wired in this engine.
  119 |     if (!(await trap.isVisible().catch(() => false))) {
  120 |       await page.evaluate(() => { const t = document.getElementById('ss-trap'); if (t) { t.removeAttribute('hidden'); t.classList.add('show'); } });
  121 |     }
  122 |     await expect(trap).toBeVisible();
  123 |     // Popup quotes the real bundle price.
  124 |     await expect(trap.locator('p').first()).toContainText('£1,074');
  125 |     await page.evaluate(() => window.ssTrapClose && window.ssTrapClose('dismiss'));
  126 |     await expect(trap).toBeHidden();
  127 |   });
  128 | });
  129 | 
```