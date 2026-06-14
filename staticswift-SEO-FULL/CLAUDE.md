# StaticSwift — Constitution

Productised web design for UK tradespeople. £499 one-time build, optional
£49/mo managed plan, free preview in 24 hours, 60-day lead guarantee.
Founder: Harry Yule, Manchester. One craftsman with a powerful back office.

## Source of truth
- `data/facts.json` — every price, timeframe, guarantee. Hardcoded figures
  are build failures. Validate: `node scripts/validate-facts.mjs`.
- `docs/decisions.md` — decision log. Record every significant call there.

## Voice (Field Guide)
Editorial, specific, confident, slightly literary. Never corporate, never
hype. NEVER use em dashes anywhere in any output. Every claim traces to
facts.json. Never fabricate reviews, results or statistics. Mobile first:
the customer is a builder on a phone at 7am.

## The boardroom (.claude/agents/)
cro, seo-director, qa-director, brand-director, head-of-outreach,
head-of-analytics, cfo. All inherit `.claude/agents/_covenant.md`
(Excellence Covenant). CEO = main thread: synthesise, decide, record.

## Layout
- Site root = this folder (deployed on Netlify, publish ".").
- ~31,400 programmatic pages: `{trade}-website-design-{town}/`,
  hubs `website-design-{town}/`, trade roots `{trade}-website-design/`.
- `netlify/functions/` — intake (handle-intake.js), CRM (_db.js = JSONBin),
  mail (_mailer.js = FastHosts SMTP), analytics (track-event, analytics-*).
- `scripts/` — validate-facts.mjs (CI gate), patch-facts-phase0.mjs,
  crawl-audit.mjs, patch-seo-pages.js (estate patcher).
- `generator/` — DEPRECATED, see generator/DEPRECATED.md. Do not regenerate.
- `tests/` — Playwright matrix (Chromium/Firefox/WebKit at 375/412/1440).

## Standing rules
1. No URL deleted or changed without a 301 + SEO Director sign-off in
   decisions.md.
2. Ship small verified increments: build, validate-facts, crawl, browser
   matrix on affected templates, then commit. Passing Chrome but failing
   WebKit means not shipped.
3. Forms always keep method=post action=/.netlify/functions/handle-intake
   (non-JS fallback). Never remove.
4. Fixes are proven by running them, not by reading code.
5. Batch questions for Harry at phase boundaries; give a deploy preview link.

## Current phase
Phases 0-3 COMPLETE (committed on main). 0: mechanical truth + analytics +
security. 1: full estate on Field Guide template (26,778 leafs + 416 hubs,
titles/URLs preserved). 2: proof + trust. 3: website-check tool, consent-gated
pixels, 5-email nurture. Phase 4 (outbound engine) in progress, then 5
(reporting), 6 (agent workforce). Builders: scripts/build-leaf-v2.mjs,
build-hub-v2.mjs (read data/trade-copy/, data/facts.json, _consent-snippet).
