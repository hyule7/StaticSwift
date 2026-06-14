# Midday BD shift (runs ~12:00 UK)

Goal: restock and advance the outbound pipeline so it never runs dry, entirely
into the approval queue. Obey .claude/agents/_covenant.md and PECR.

## Roles this shift
1. **Prospect discovery** (agents/roles/bd-discovery.md)
   - Pull new prospects: Companies House new incorporations (discover-companies-house
     seeds these daily) filtered by trade SIC codes, plus OSM discovery
     (discover-prospects). Capture company, locality, incorporation date.
2. **Website checker + contact finder** (agents/roles/bd-website-checker.md, bd-contact-finder.md)
   - Verify no-website status; deprioritise decent sites, flag bad ones for the
     audit pitch, put no-site prospects top of queue. Find PUBLIC contact points
     only, record the source of every detail. Never scrape prohibited sources.
3. **Scorer + writer + sequencer** (the outreach/ toolchain)
   - Run `node outreach/enrich.mjs` then `node outreach/write.mjs` on today's
     batch (target 30-50 qualified). Run `node outreach/sequence.mjs` for due
     day-3/day-8 follow-ups. All drafts land in the queue; suppression checked
     at draft time. Verify SPF/DKIM/DMARC (deliverability) before the first
     batch of any day; hard-stop on bounce/complaint thresholds.
4. **Preview-bait** (agents/roles/bd-preview-builder.md)
   - Flag the week's top 10 for a real one-page preview (preview-bait.mjs).
     Always human-approved before send.

## Done when
- 30-50 fresh prospects enriched and drafted to the queue.
- Due follow-ups queued.
- Preview-bait tasks flagged for the top 10.
- Deliverability checked; throughput logged so Harry can see when volume
  justifies a subscription upgrade.
