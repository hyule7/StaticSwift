# GA4 + self-hosted event schema (Head of Analytics sign-off)

Every event below fires to BOTH GA4 (gtag, G-4BZHQMG0RF) and the self-hosted
tracker (track-event.js → Netlify Blobs). The self-hosted tracker is the
source of truth for the admin dashboard; GA4 is for cross-referencing and
ad-platform conversion import. Nothing ships without its event defined here.

## Page-level

| Event | When | Dimensions |
|-------|------|------------|
| `page_view` (GA4 auto) / `pageview` (self) | every page load | path (query stripped), ref, sid, vp, lang, src{utm/ttclid/...} |
| `duration` (self) | pagehide / tab hidden | path, sid, dur (ms) |

## Funnel (strictly ordered, per-session, deduplicated)

1. `pageview` — Visited site
2. `whatsapp_click` OR `tel_click` OR `form_submit` — Took a contact action
3. `form_submit` — Submitted a form

The dashboard funnel (analytics-self.js) enforces monotonicity: a session
only counts at stage N if it counted at every earlier stage, so no step can
exceed 100% of the one before it.

## Conversion events

| Event | Fired by | Value | Dimensions |
|-------|----------|-------|------------|
| `form_submit` | any form (auto, capture-phase listener) | — | form (id) |
| `generate_lead` | leaf/hub/order/website-check on success | 499 GBP | source, business_type |
| `whatsapp_click` | any wa.me / whatsapp link | — | — |
| `tel_click` | any tel: link | — | — |
| `check_tool_start` | website-check run | — | has_url |
| `check_tool_complete` | website-check score shown | — | score, host |
| `email_capture` | website-check report capture | — | source |
| `lead_thank_you` | thank-you.html success | — | source |
| `lead_submit_error` | thank-you.html ?status=error | — | source |
| `lock_save` (GA4) | exit popup price-lock | 100 GBP | source=exit_intent |

## Ad-platform pixels (consent-gated)

Meta Pixel and TikTok Pixel load ONLY after the visitor accepts the consent
banner (ss_consent=granted cookie). Before consent, neither script is
injected. On accept:
- TikTok: `ttq.page()`, and `ttq.track('SubmitForm'|'Lead')` mirrored from
  form_submit / generate_lead.
- Meta: `fbq('track','PageView')`, `fbq('track','Lead')` on generate_lead.

Consent state: cookie `ss_consent` = `granted` | `denied`, 180-day expiry.
The banner respects an existing choice and never re-prompts within that window.
Reduced-motion and keyboard users supported (focusable buttons, no animation
dependency).

## Notes

- All paths are query-string-stripped before storage (GDPR); tracking params
  go into the `src` dimension, never the path. See track-event.js.
- Bot user-agents are dropped at ingest.
- Non-UK traffic is segmented in the dashboard (geoSplit) so it cannot
  pollute conversion rates.
