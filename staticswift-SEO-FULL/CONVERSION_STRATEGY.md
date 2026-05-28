# StaticSwift Conversion Strategy

## Top 10 fixes (ranked by impact × effort)

**1. Add an inline lead form to every programmatic-SEO page.**
WHAT: Replace the "Get Your Corby Website" CTA with an embedded 3-field form (name, email, business type pre-filled to "Barber", town pre-filled to "Corby"). POST to `/.netlify/functions/handle-intake` with `source: 'seo-{niche}-{city}'`.
WHERE: `barber-website-design-corby/index.html` lines 108-114, plus whatever template generates every `-corby` / `-ipswich` / etc. folder.
WHY: Google traffic currently lands on a page with zero capture. Users must click `staticswift.co.uk/#contact`, load homepage, dismiss video hero, scroll past marquee + showcase + stats, then hit the form. Every interstitial bleeds intent.
EXPECTED LIFT: **Large.**

**2. Move the form above the showcase on the homepage.**
WHAT: Swap section order — contact (line 908) becomes section 02; showcase (line 861) becomes section 03. Even better: embed a 3-field "Start" form into the hero right column where the floating mockups sit (lines 786-821).
WHERE: `index.html` lines 861-895 and 908-977.
WHY: `#contact` is ~1300px below fold desktop, more on mobile. Hero CTA "Get My Free Preview →" promises a form, not a tab carousel.
EXPECTED LIFT: **Large.**

**3. Fire a GA4 conversion event on form submit (currently zero conversions are tracked).**
WHAT: Inside `sq()` after `if (r.ok)`, add `gtag('event', 'generate_lead', {...})` and `dataLayer.push(...)`. Same for `order.html` final-step success.
WHERE: `index.html` line 1592 (inside the `if (r.ok)` block of `window.sq`); `order.html` submit success handler.
WHY: gtag loads at line 56 but no custom events ever fire. Owner is flying blind — cannot see which niches/cities/pages convert.
EXPECTED LIFT: **Medium (enables every future test).**

**4. Cut the homepage form from 7 to 4 fields.**
WHAT: Keep name, email, business type, town. Drop business_name (ask in reply), WhatsApp (move to post-submit upsell), package_interest (defer to order.html).
WHERE: `index.html` lines 917-948.
EXPECTED LIFT: **Medium-Large.**

**5. SEO-page CTAs point to wrong destination.**
WHAT: Change every `staticswift.co.uk/#contact` on programmatic pages to `staticswift.co.uk/order.html?niche=barber&city=Corby` (pre-fills order.html step 1).
WHERE: `barber-website-design-corby/index.html` lines 105, 112, 144, 145, 146, 153 (and same lines across all SEO folders).
EXPECTED LIFT: **Medium.**

**6. Pre-fill the form from URL params.**
WHAT: Read `?niche=barber&city=Corby` on `order.html` load; auto-fill business type + location. Same on homepage form after fix #2.
WHERE: `order.html` init script; `index.html` near line 1579.
EXPECTED LIFT: **Small-Medium.**

**7. Move the Marco/Bristol testimonial directly above the form.**
WHAT: Lift the named, specific testimonial at line 1221 ("zero online presence to fifteen new bookings in the first week") and place it immediately before the form headline.
WHERE: `index.html` insert above line 914.
EXPECTED LIFT: **Small-Medium.**

**8. Kill the disabled-by-default `<option>` placeholders.**
WHAT: Default `f-type` (line 930) and `f-pkg` (line 943) to a valid option; on order.html step 1 default `business_type` to "Other".
WHERE: `index.html` lines 929-936 and 942-947; `order.html` line 106.
EXPECTED LIFT: **Small.**

**9. Sticky mobile bottom CTA.**
WHAT: <600px, fixed bar: "Free preview in 24h →" linking to `#contact` (or `/order.html` post fix #5). Hide once form is in viewport.
WHERE: `index.html` mobile breakpoint block.
EXPECTED LIFT: **Small-Medium.**

**10. Rewrite hero subhead as a risk-reversal with price clarity.**
WHAT: Current line 778 reads "Handcrafted static sites that load in under a second. From £149, live in 24 hours. No payment until you see your free preview." Replace with the tighter version below.
WHERE: `index.html` line 778.
EXPECTED LIFT: **Small.**

## Tracking gaps

`gtag.js` loads at `index.html:56-57` but **no custom event ever fires** anywhere in the codebase. The self-hosted `ss.track()` in `analytics-self.js` only logs pageviews/timing — no lead events. `handle-intake.js` returns `{ok:true, clientId}` but the success block in `sq()` (line 1592) does nothing with it.

Add these:

```js
// index.html, inside sq() success block at line 1592:
gtag('event', 'generate_lead', {
  value: 149, currency: 'GBP',
  source: data.source || 'index-qf',
  business_type: data.business_type,
  location: data.location,
  package: data.package || 'unsure'
});
window.dataLayer && dataLayer.push({ event: 'lead_submit', form_id: 'qf', client_id: (await r.json()).clientId });
window.ss && ss.track && ss.track({ type: 'event', evt: 'lead_submit' });

// On every hero/pricing/CTA-band button click:
gtag('event', 'cta_click', { cta_label: 'hero_primary', section: 'hero' });

// Showcase tab clicks (line 870-875):
gtag('event', 'niche_explore', { niche: tab.dataset.niche });

// openWorkModal() (called from lines 879, 1052, 1062…):
gtag('event', 'work_view', { project: niche });

// order.html final submit success:
gtag('event', 'generate_lead', { value: 149, currency: 'GBP', source: 'order-form-full', business_type, location });
```

## Above-the-fold rewrite (verbatim)

Headline: **A website that wins you customers. Live in 24 hours.**

Subhead: Custom-coded for your trade. £149 one-time. Pay only when you love it — files yours forever.

Primary CTA: **Start my free preview →**

Trust line: *247 UK businesses shipped · 24h delivery · No card upfront · 5 stars on Google*

## Form rewrite

**Keep, in this order:**
1. Your name
2. Email
3. Town / city
4. Business type (default "Other", not a disabled placeholder)

**Drop from homepage form:**
- Business name → ask in Harry's reply email
- WhatsApp → move to single optional field shown *after* submit on the thank-you state
- Package interest → move to `/order.html` step 2

**Placement:** Form should be **in-hero on desktop** (right column at lines 787-821). On mobile, form sits immediately below the hero copy, before the marquee. Keep the existing `/order.html` 4-step funnel as the deeper-intent path linked from SEO pages and pricing buttons.

---

**Single highest-impact fix:** Embed a 3-field inline form on every programmatic-SEO landing page so Google traffic converts on the page they land on, not after a homepage redirect they may never make.
