# outreach/ — the StaticSwift outbound toolchain

A Node toolchain the Business Development shift runs. It never sends mail
itself: every drafted email lands in the **approval queue** (Netlify Blobs,
category `outreach`), and the approved-email dispatcher (a no-AI Netlify
function) is the only thing that puts mail on the wire, throttled, via
FastHosts SMTP. Autonomy is earned: a category auto-sends only after 50
consecutive approvals with no edits (enforced in the queue, Phase 6.2).

## Pipeline (run in order)

1. `enrich.mjs`  — for each prospect: website? mobile-friendly? page speed?
   GBP link? domain age? Scores 0-100 on "needs StaticSwift". Reuses the
   live functions (analyze-site, domain-age, companies-house) when a base
   URL is given, else runs the same checks locally.
2. `write.mjs`   — drafts a 3-line plain-text first email per prospect in the
   Field Guide voice, referencing ONE specific true observation from
   enrichment. PECR framing + unsubscribe in every message. Includes a
   one-click pre-filled brief link (trade + town as URL params).
3. `sequence.mjs`— day-3 (short bump) and day-8 (case study) follow-ups, only
   if no reply. Writes them to the queue dated for the dispatcher.
4. `queue.mjs`   — shared: pushes artefacts to the approval queue, checks the
   suppression list at draft time (not just send time).

## Hard rules (Excellence Covenant + PECR)

- Max 30 sends/day to start, ramping to 50. Randomised times in UK business
  hours. Real from-address. Working one-click unsubscribe honoured in the CRM.
- Never email anyone on the suppression list (checked at discovery AND send).
- Every claim verifiably true; no fake flattery; nothing the data does not
  support. No em dashes. From "StaticSwift" / drafted for Harry, never signed
  as an invented human.
- Deliverability is sacred: SPF/DKIM/DMARC verified (deliverability.js) before
  the first batch; hard-stop on bounce/complaint thresholds.

## Usage

    node outreach/enrich.mjs prospects.json > enriched.json
    node outreach/write.mjs enriched.json            # drafts -> approval queue
    node outreach/sequence.mjs                        # due follow-ups -> queue

Without Blobs credentials (local dev) the tools write to
`outreach/.queue.local.json` so the pipeline is testable offline.
