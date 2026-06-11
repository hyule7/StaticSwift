# Phase 0 Findings — Mechanical Truth

2026-06-10/11. All work committed on main (local), not yet pushed.

## The CEO's read: what actually caused the conversion flatline

Three forces, in order of weight:

1. **There is almost no traffic to convert.** Search Console shows ~14
   organic clicks in three months (64,500 impressions, average position 55).
   The 3,600-page-claim estate is really ~31,400 pages, indexed, but ranking
   around page 5+. The measured 6-10 visits/day are mostly TikTok hitting the
   homepage. Zero briefs from near-zero qualified traffic is arithmetic, not
   mystery.
2. **The funnel was measured so badly the flatline was partly invisible
   data.** The tracker ran only on the homepage; hubs had no analytics at
   all; durations all-zero; the funnel counted events from a retired page
   design. Some leads may well have arrived historically and been mislabelled
   or simply not counted (form submits showed 21 in one stat and 1 in the
   funnel).
3. **The forms work today, but had a single point of silent failure.** The
   live intake chain is proven working end to end (WebKit browser submission
   on the live Burnley page wrote CRM record client_1781123330724_0i1y7dppc
   and fired the notification email). The historical PII-leaking GET
   fallback came from the previous site version. Every form now carries
   method=post + action so a JS failure becomes a working POST, never a lost
   lead. Residual risk: JSONBin rate limits on the lead path (migrate to
   Blobs in Phase 6).

Strategic consequence: Phase 1's template rebuild matters for the long game,
but briefs-this-month must come from TikTok traffic to a now-honest funnel
and from outbound (Phase 4). The estate is inventory, not yet a channel.

## Acceptance criteria status

- GET form leak root-caused and fixed, proof of CRM lead from WebKit: DONE
  (clientId client_1781123330724_0i1y7dppc, tests/live-intake-webkit.spec.js)
- PII purged from analytics storage: CODE SHIPPED, RUN PENDING DEPLOY
  (purge-analytics-pii.js; needs ADMIN_PASSWORD env var set, then one curl)
- Crawl report zero broken internal links: DONE (31,853 pages,
  docs/audit/crawl-report.md)
- Analytics coverage on programmatic pages: DONE (tracker on 31,848 pages,
  GA4 added to 473 hubs). True organic level established vs GSC: ~0.15
  clicks/day. Coverage proof on live requires deploy.
- Funnel internally consistent: DONE (monotone, per-session, real events)
- Test suite committed and wired: DONE (86 passing matrix + live E2E;
  run `npx playwright test` before deploys)
- Free upgrades: DONE for HSTS, IndexNow (key f641e329497d9f0b62f4dfd36b94b46c),
  404 rebuild, llms.txt, icons, robots/sitemap sanity, honeypots (existing).
  Itemised as deferred: per-trade OG images (Phase 2 build tooling), font
  preloading + minification (Phase 1 template rebuild), WebP conversion (few
  raster images in use), Bing Webmaster verification (needs your login).
- Findings written: this file + docs/audit.md + docs/decisions.md

## CRITICAL: do these alongside the next deploy (Harry, ~10 minutes)

1. **Netlify env vars**: set `ADMIN_PASSWORD` to a NEW strong password
   (the old one is burned: it was public on GitHub and served in admin.js).
   Without it set, admin functions deny everything and the dashboard will
   not log in.
2. **Rotate that password anywhere else you use it.** It is in git history
   forever.
3. **Make the GitHub repo private** (Settings -> Danger Zone -> Change
   visibility), or at minimum accept that all history is public.
4. After deploy, run the PII purge:
   `curl -X POST https://staticswift.co.uk/.netlify/functions/purge-analytics-pii -H "x-admin-password: <new password>"`
5. Optional checks flagged for you (no code): TikTok ad sets should be
   UK-only (US/China visitor clusters suggest spam clicks); verify the site
   in Bing Webmaster Tools.

## What changed (by the numbers)

- 31,846 pages now validate clean against data/facts.json (validator gates
  deploys; was 31,418 pages contradicting it)
- 31,365 leaf forms + order page + exit popup: non-JS POST fallback
- 21,000+ malformed international URLs repaired; 9,536 dead links removed;
  0 broken internal links remain
- 31,848 pages now carry the sessionised tracker with duration beacon and
  funnel events; 473 pages gained GA4
- 21 admin functions hardened; hardcoded password eliminated from 33 files
- Salford hub created and linked; sitemap corrected (phantom /example.html
  out, Salford in)
- Exit popup £871 -> £1,074; lock-price email £871/£971 -> £1,074/£1,174;
  generate_lead value 149 -> 499; Established MMXXV -> MMXXVI; dad's tea
  deduplicated; £29 hosting FAQ gone; "Advanced" package gone from schema

## Batched questions for Harry

1. The new ADMIN_PASSWORD: set it yourself in Netlify (do not send it to me
   or commit it anywhere).
2. International pages are 410-retired but their files and now-fixed links
   remain on disk. Keep them retired (recommended: UK focus) or revive any
   markets?
3. The order page ignores ?package=pro from the homepage menu; Pro is
   currently not orderable as Pro. Intentional?
4. JSONBin vs Netlify Blobs for the CRM: migration is planned Phase 6, but
   if leads matter this month I can bring it forward a phase.
5. Bing Webmaster Tools + TikTok Ads Manager logins are needed for two
   deferred items.

## What the metrics should show within 14 days of deploy

- Self-hosted dashboard: top pages spread across leaf/hub paths instead of
  homepage-only; non-zero session durations; a funnel that narrows monotonically.
- GA4: generate_lead value 499; form_submit events from leaf pages.
- GSC: no drop from the estate-wide copy corrections (titles kept their
  keyword pattern); possible slow CTR gain from honest "free 24h preview"
  titles.
- Zero new /?name=... URLs in analytics (the purge plus ingest stripping).

## CEO's call on what Phase 1 starts with

1. Leaf template rebuild with the phone/WhatsApp field FIRST (it is the
   single biggest missing conversion lever; current leaf forms have no phone
   field), Field Guide design system, pricing/guarantee/founder blocks from
   the homepage, facts.json-rendered.
2. Conversion-critical elements (form, submit button, success state) exempt
   from reveal animations.
3. Hub pages get the real intro + demo + form so they can convert on their
   own.
4. No URL changes anywhere; title keyword pattern preserved; before/after
   title snapshot to docs/seo-snapshot/.
