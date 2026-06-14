#!/usr/bin/env node
/*
 * write.mjs — draft the 3-line first email per prospect, queue for approval.
 *
 * Field Guide voice: short, specific, impossible to mistake for a blast.
 * Opens with the ONE true observation from enrichment. PECR-compliant: a
 * business-relevant reason for contact and a one-click unsubscribe in every
 * message. Pre-filled brief link carries trade + town. No em dashes. Never
 * signed as an invented human; this is drafted FOR Harry to approve and send.
 *
 * Input: enriched.json (from enrich.mjs). Output: drafts -> approval queue.
 * Only prospects with score >= MIN and a real email are drafted.
 */
import { readFileSync } from 'node:fs';
import { enqueue, isSuppressed } from './queue.mjs';

const MIN = Number(process.env.OUTREACH_MIN_SCORE || 60);
const SITE = 'https://staticswift.co.uk';
const cap = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

function briefLink(p) {
  const params = new URLSearchParams({ source: 'outreach' });
  if (p.trade) params.set('trade', p.trade);
  if (p.town) params.set('town', p.town);
  return `${SITE}/order.html?${params.toString()}`;
}

function draft(p) {
  const town = p.town || 'your area';
  const tradeWord = (p.trade || 'business').replace(/-/g, ' ');
  // Line 1: the true observation (or a neutral, honest opener if none).
  const opener = p.observation
    ? cap(p.observation) + '.'
    : `I build websites for ${tradeWord}s around ${town}.`;
  // Line 2: the offer, specific and no-risk.
  const offer = `I'm Harry, I hand-code sites for trades in ${town}. I'll build you a real working preview in 24 hours, free, no card. If you keep it it's £499 once, and if it doesn't bring a lead in 60 days you get your money back.`;
  // Line 3: the one-tap action.
  const action = `Want me to make you one? Reply here, or start the 60-second brief: ${briefLink(p)}`;

  const body =
`Hi${p.contactName ? ' ' + p.contactName.split(/\s+/)[0] : ''},

${opener} ${offer}

${action}

Harry
StaticSwift, Manchester
Reason for this email: you run a ${tradeWord} in ${town} and I build sites for that trade. Not interested? Reply STOP and I won't email again.`;

  return {
    category: 'outreach',
    to: p.email,
    subject: p.observation && /load/.test(p.observation)
      ? `Your ${tradeWord} site is slow on phones`
      : p.observation && /no website|don't seem/.test(p.observation)
        ? `A website for ${p.business || 'your ' + tradeWord}?`
        : `${cap(tradeWord)} website, ${town}`,
    body,
    prospect: { business: p.business, trade: p.trade, town: p.town, score: p.score, signals: p.signals },
    meta: { step: 0, observation: p.observation },
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node outreach/write.mjs enriched.json'); process.exit(1); }
  const prospects = JSON.parse(readFileSync(file, 'utf8'));
  let queued = 0, skippedLow = 0, skippedNoEmail = 0, skippedSuppressed = 0;
  for (const p of prospects) {
    if (p.score < MIN) { skippedLow++; continue; }
    if (!p.email) { skippedNoEmail++; continue; }
    if (isSuppressed(p.email)) { skippedSuppressed++; continue; }
    const res = await enqueue(draft(p));
    if (res.queued) queued++; else skippedSuppressed++;
  }
  console.error(`drafted ${queued} to approval queue; skipped ${skippedLow} low-score, ${skippedNoEmail} no-email, ${skippedSuppressed} suppressed`);
}
main();
