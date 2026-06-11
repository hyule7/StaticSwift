# StaticSwift Repo Audit

2026-06-10. Findings beyond the issues listed in the brief, from reading the
full codebase and running it. Status of the listed issues lives in
docs/audit/phase0-findings.md.

## Architecture as found

- The deployed site is this folder, published as-is on Netlify (publish ".",
  functions in netlify/functions). There is no build step: pages on disk are
  the pages served.
- ~31,400 live programmatic pages in three families: trade+town leafs
  (`{trade}-website-design-{town}/`), town hubs (`website-design-{town}/`),
  trade roots (`{trade}-website-design/`). 4,587 international pages were
  retired on 2026-05-31 via `_redirects` 410 rules; their files remain on disk.
- The CRM is **JSONBin** (netlify/functions/_db.js), not Netlify Blobs as the
  brief assumed. Blobs is used only for analytics (_blobs.js). JSONBin free
  tier rate limits (429) are a real intermittent-failure risk on the lead
  path; _db.js caches to soften it. Migration to Blobs is the Phase 6 plan.
- Mail is FastHosts SMTP via nodemailer (_mailer.js). Extensive function
  estate already exists: outreach (discover-prospects, companies-house,
  daily-followup, send-preview, categorize-reply), portal, invoicing, crons.

## Major findings (new)

1. **Public repo leaked the admin password.** `Harry2001!` was hardcoded in
   33 files, including admin/admin.js which is served to any visitor, and the
   GitHub repo is public. Anyone could read the full client CRM (names,
   phones, emails), delete clients, or send email through the functions.
   Fixed in code (env-var only, deny-when-unset, 21 functions hardened) but
   the password must be rotated and the repo made private.
2. **Organic traffic is effectively zero.** Search Console (last 3 months):
   ~14 clicks total, 64,500 impressions, average position ~55. The estate is
   indexed and surfacing but ranks nowhere near clicks. Conversion fixes
   alone cannot produce briefs from organic at this level; near-term lead
   flow has to come from TikTok and outbound while page quality (Phase 1)
   compounds.
3. **International pages had malformed URLs.** Raw city strings ("abbotsford,
   bc", "café-", "tattoo artist-") were inserted into canonicals, og:urls and
   internal links on ~4,500 intl pages: every canonical pointed at a
   non-existent URL. Repaired (21,000+ URLs rewritten to real slugs); note
   these pages are 410-retired on live anyway.
4. **Analytics measured one page.** The self-hosted tracker existed only on
   the homepage; town hubs had no analytics of any kind (no GA4 either).
   The "top pages = only homepage" mystery was coverage, not traffic.
5. **The old GET form leak is historical.** No current page has the
   `package` select that produced `/?name=...&package=advanced` URLs; the
   fossils (Starter £149/Advanced £299/Hosting £29) lived on in
   handle-intake.js email labels and generator templates. The live intake
   chain works: verified by curl and by a real WebKit browser submission
   end-to-end into the CRM. The structural hole (no non-JS fallback) is now
   closed everywhere.
6. **Conversion-critical UI depends on animation.** The order page submit
   button and success message sit inside clip-path reveal wrappers driven by
   IntersectionObserver. If the observer never fires (old browser, reduced
   JS), the submit button is invisible. Phase 1 should exempt
   conversion-critical elements from reveal animations.
7. **generator/ would resurrect the old world.** template.py still generates
   £149/£299/£29 pricing, "24h delivery" claims and the unguarded form.
   Frozen with DEPRECATED.md until rebuilt on facts.json.
8. **llms.txt was telling AI assistants the retired pricing.** Rewritten from
   facts.json.
9. **Stale schema everywhere.** Leaf-page JSON-LD carried "Advanced" offers,
   £29 Hosting offers, single-page and 24h-delivery claims, all visible to
   Google. Corrected estate-wide.
10. **Lead value misreported to ads.** generate_lead fired value:149 on
    31,375 pages, training TikTok/GA optimisation against a retired price.
    Now 499.

## Smaller notes

- order.html ignores `?package=` from the homepage menu links (the order page
  is single-package). Harmless; either drop the param or use it to preselect
  in Phase 1.
- thank-you.html had an XSS hole (`innerHTML` from `?name=`); fixed.
- handle-intake.js clobbered `data.source` to a constant, destroying lead
  attribution; fixed.
- The lock-price customer email still quoted £871/£971; fixed to
  £1,074/£1,174.
- 404 page was in a previous brand's design system (cyan/Syne); rebuilt in
  Field Guide.
- favicon.ico and apple-touch-icon.png were 404ing on every page; generated.
- robots.txt is sane; sitemaps are chunked with an index; _redirects holds
  the 410 retirement block (no chains found).
- Netlify Canopy-style content filter on the local network injects scripts
  into fetched pages locally; it is not present on the real site (verified
  against live HTML).
