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
