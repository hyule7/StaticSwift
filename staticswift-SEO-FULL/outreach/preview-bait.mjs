#!/usr/bin/env node
/*
 * preview-bait.mjs — flag the week's top-10 prospects for a real one-page
 * preview ("I already built you this" is the highest-converting cold email
 * in this niche).
 *
 * This script does NOT auto-build or auto-send. It selects the 10 highest
 * scoring prospects with an email, and queues a HUMAN-REVIEW task per
 * prospect (category 'preview-bait') describing the build to generate. The
 * actual one-page build runs through the Design Studio (Phase 6) and the
 * send goes out only after Harry approves in the queue. Every preview-bait
 * email is human-approved before send, always.
 *
 * Input: enriched.json. Output: review tasks -> approval queue.
 */
import { readFileSync } from 'node:fs';
import { enqueue, isSuppressed } from './queue.mjs';

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node outreach/preview-bait.mjs enriched.json'); process.exit(1); }
  const top = JSON.parse(readFileSync(file, 'utf8'))
    .filter(p => p.email && !isSuppressed(p.email) && p.score >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  let queued = 0;
  for (const p of top) {
    const trade = (p.trade || 'business').replace(/-/g, ' ');
    await enqueue({
      category: 'preview-bait',
      to: p.email,
      subject: `I built ${p.business || 'you'} a website`,
      body:
`Hi${p.contactName ? ' ' + p.contactName.split(/\s+/)[0] : ''},

I had a slow evening so I built you a one-page website to show what's possible. No charge, no catch, it is yours to look at. [PREVIEW LINK TO BE ATTACHED BY DESIGN STUDIO]

If you like it I'll finish it into the full five pages, live within 14 days, £499 once. If not, bin it with my compliments.

Harry
StaticSwift, Manchester
Reason for this email: you run a ${trade} in ${p.town || 'your area'}. Not interested? Reply STOP and I won't email again.`,
      prospect: { business: p.business, trade: p.trade, town: p.town, score: p.score },
      meta: { needsBuild: true, note: 'Design Studio to generate one-page preview from public info, then attach link. HUMAN APPROVAL REQUIRED before send.' },
    });
    queued++;
  }
  console.error(`flagged ${queued} preview-bait tasks for human review (top scorers, >=70)`);
}
main();
