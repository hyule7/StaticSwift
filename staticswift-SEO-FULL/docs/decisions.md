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
