# Decisions Log

Every significant decision: date, decision, reasoning, proposing exec.

## 2026-06-10

**D-001. The deployed site root is `staticswift-SEO-FULL/`.** The repo wraps
it plus a Search Console export. All work happens in this folder. (CEO)

**D-002. The historical GET form leak came from the previous site version,
not current code.** No current page has a `package` select; the leaked URLs
(`/?name=...&package=advanced`) match the retired £149/£299 era whose
fossils were found in handle-intake.js labels and generator/template.py.
Current live endpoint verified working: curl POST returned ok with
clientId client_1781117348509_hmzxt6nop and the admin email fired.
Standing risk fixed anyway: every form now carries method=post plus
action=handle-intake so a JS failure becomes a working POST, never a
PII-leaking GET. (QA Director)

**D-003. The CRM is JSONBin, not Netlify Blobs.** _db.js reads/writes
JSONBin with a 60s cache and rate-limit fallbacks. The mega prompt assumed
Blobs; migration to Blobs is Phase 6 (consolidate state). Flagged because
JSONBin 429s are a plausible intermittent lead-loss mechanism. (CEO)

**D-004. False claims corrected in place across 31,846 pages** rather than
waiting for the Phase 1 template rebuild: 24h delivery -> 24h preview,
no monthly fees -> optional £49/mo stated, single-page -> five pages,
£29 hosting FAQ removed, Advanced -> Pro, schema offers aligned. Exit popup
£871 -> £1,074 to match order page arithmetic. validate-facts.mjs now gates
deploys. (Brand Director proposed, CFO verified arithmetic, CEO approved)

**D-005. Established year standardised on MMXXVI** (4 instances of MMXXVI vs
1 of MMXXV on the homepage colophon). (Brand Director)

**D-006. Duplicate "after my dad's tea" resolved** by keeping the founder
note instance and reworking the pitch-quote verse line to "by one pair of
hands." (Brand Director)

**D-007. Salford hub page created** at /website-design-salford/ linking the
14 trades that have real Salford leaf pages; /locations now points there
instead of Manchester. Needs adding to sitemap on next regeneration. (SEO
Director)

**D-008. generator/ is frozen as deprecated.** Its templates still produce
the retired pricing and the unguarded form. DEPRECATED.md added; rebuild on
facts.json before any regeneration (Phase 1). (SEO Director)

**D-009. Comparison pages reframed "No Monthly Fees: YES"** to "No forced
monthly subscription", which is true (the £49/mo is optional) and keeps the
contrast against Wix/Squarespace subscriptions. (Brand Director)

**D-010. generate_lead value corrected 149 -> 499** estate-wide and in
patch-seo-pages.js so ad optimisation learns against the real price. (Head
of Analytics)

## 2026-06-11 (overnight run)

**D-011. Harry pushed Phase 0 to production himself** (commit "PUSH", 22:02).
Live verification followed: tracker, POST fallback, corrected claims, llms.txt,
favicon and Salford hub all confirmed live. ADMIN_PASSWORD env var is set in
Netlify but still equals the burned password; rotation flagged as Harry's
first job. (CEO)

**D-012. PII purge executed on live analytics**: 622 of 1,803 stored events
scrubbed of query-string PII across 6 day-buckets. IndexNow ping accepted
(200); Google's legacy sitemap ping endpoint is retired (404s, expected).
(Head of Analytics)

**D-013. Phase 1 split into 1a (shipped) and 1b (review-gated).** Because
Harry deploys main straight to production, the estate-wide template redesign
is NOT applied blind. 1a shipped surgical, low-risk conversion fixes to all
31,365 leaf pages: required WhatsApp field and sticky mobile CTA. 1b built
the full Field Guide leaf template as three noindexed samples under
/_template-preview/ for Harry's approval before rollout. (CEO, with SEO
Director's no-bulk-rewrite rule)

**D-014. New leaf template renders everything from facts.json at build
time**; pricing, guarantee, delivery claims are interpolated, not typed.
Conversion-critical elements (form, submit, success state) carry no reveal
animations, fixing the failure class found on the order page. (CRO)

**D-015. Trade pain copy is per-trade, not per-town** (plumber, electrician,
barber written; remaining trades to follow the same register), with town
uniqueness from data interpolation. No em dashes; separators are middots.
(Brand Director)

## 2026-06-12

**D-016. Harry waived review pauses: "do the phases in order, dont ask for
any approval just keep going."** Phase boundaries no longer wait for sign-off.
The covenant, identity rules and facts.json gates remain absolute; the
QA gates (validate-facts, crawl, matrix) still run before every commit. (CEO)

## 2026-06-12 (Phases 1-3 build)

**D-017. Phase 1 estate rollout shipped on the Field Guide template** via
build-leaf-v2.mjs (26,778 live UK leafs) and build-hub-v2.mjs (416 hubs).
Titles kept byte-identical to the pre-Phase-1 snapshot, URLs unchanged,
curated internal links preserved, all figures from facts.json. 51 trade copy
blocks in data/trade-copy/. (CEO + SEO Director + Brand Director)

**D-018. Phase 2 proof layer uses real data only.** Harrison Electrical is
the one real case study; quote and result numbers stay null until Harry
supplies verified figures. trust.json shows only "60-day refunds issued: 0"
plus the live ticker; years/sites/Lighthouse hidden until real. Order
dropdown trimmed 77 -> 27 trades. (CEO, Brand Director)

**D-019. Phase 3 lead capture.** /website-check/ 12-point tool wraps the
existing analyze-site-public engine. Pixels (Meta/TikTok) are consent-gated:
nothing loads before Allow, satisfying PECR/GDPR. 5-email nurture runs daily
via cron-nurture, stops on reply/convert, suppression honoured. (Head of
Analytics, Head of Outreach, Brand Director)

## 2026-06-12 (Phases 4-6 build)

**D-020. Phase 4 outbound is draft-only.** outreach/ enriches, writes and
sequences into the approval queue; nothing sends itself. Suppression checked
at draft time. (Head of Outreach)

**D-021. Phase 6 approval queue is the spine.** _queue.js (Blobs) with earned
autonomy (50 clean approvals per category flips auto-send; any edit/reject
resets and revokes). dispatch-approved is the only approved->wire path, runs
24/7 in UK hours under a 30/day cap with kill switches. admin/queue.html is
the mobile one-tap UI. Money/pricing/refunds never dispatchable. (CEO)

**D-022. Workforce shipped as 20 role files + 3 shifts + headless harness.**
Generated from agents/_build-roles.mjs so the Covenant/identity/gate are
uniform. run-shift.sh runs claude --print in role order, healthcheck-pinged.
send-brief is the 7am Chief of Staff brief. Approving a design build from the
phone completes delivery end to end (_deliver.js). (CEO)

**D-023. JSONBin remains the live CRM; new agent state is in Blobs**
(approval-queue, ops, portals, build-archive). Full consolidation to Blobs is
still outstanding and is the largest remaining Phase 6 item. (CEO)

## Estate title reorder for CTR (keyword-first)
Reordered ~31,375 programmatic page titles from brand-first
("StaticSwift — {Trade} Website Design in {City} ...") to keyword-first
("{Trade} Website Design in {City} (£499, free 24h preview) | StaticSwift"),
and cleaned 52 trade-root titles (— UK Coverage -> · UK Coverage). TITLE ONLY:
no URL, canonical, heading, body, description or schema changes, so no 301s
needed. Rationale: Google shows the front of the title; leading with the
searched keyword lifts CTR, and it removes the banned em dash. Idempotent patch
in scripts/patch-titles-ctr.mjs. Verified: leaf page renders, canonical + lead
form + H1 unchanged, 0 console errors, facts clean. SEO Director sign-off: the
change is conservative (keyword pattern preserved), a known CTR win.
