#!/usr/bin/env node
/*
 * sequence.mjs — day-3 (short bump) and day-8 (case study) follow-ups.
 *
 * Reads the CRM outreach pipeline (via get-outreach-status when creds exist,
 * else a local prospects file passed as arg) and, for prospects that were
 * contacted but have not replied, drafts the next follow-up into the approval
 * queue dated for the dispatcher. Never follows up a replied/won/lost/opted-out
 * prospect. Two follow-ups maximum, then the prospect rests.
 *
 * Field Guide voice, no em dashes, unsubscribe in every message.
 */
import { readFileSync, existsSync } from 'node:fs';
import { enqueue, isSuppressed } from './queue.mjs';

const SITE = 'https://staticswift.co.uk';

function bump(p) {
  const town = p.town || 'your area';
  const trade = (p.trade || 'business').replace(/-/g, ' ');
  return {
    category: 'outreach-followup',
    to: p.email,
    subject: 'Re: ' + (p.lastSubject || `${trade} website, ${town}`),
    body:
`Hi${p.contactName ? ' ' + p.contactName.split(/\s+/)[0] : ''},

Just floating this back up in case it slipped past. The free 24-hour preview offer still stands, no card, and you only pay the £499 if you keep it.

Reply with your business name and I'll start tonight.

Harry
StaticSwift, Manchester
Not interested? Reply STOP and I won't email again.`,
    prospect: { business: p.business, trade: p.trade, town: p.town },
    meta: { step: 1, day: 3 },
  };
}

function caseStudy(p) {
  const trade = (p.trade || 'business').replace(/-/g, ' ');
  return {
    category: 'outreach-followup',
    to: p.email,
    subject: 'One I built for an electrician in Bristol',
    body:
`Hi${p.contactName ? ' ' + p.contactName.split(/\s+/)[0] : ''},

Last one from me. Rather than describe it, here is a site I built: Harrison Electrical, Bristol. ${SITE}/work/harrison-electrical/

Same approach for a ${trade}: hand-coded, your reviews and number where customers see them first, live within 14 days. Free preview in 24 hours if you want to see yours.

Harry
StaticSwift, Manchester
Not interested? Reply STOP and I won't email again.`,
    prospect: { business: p.business, trade: p.trade, town: p.town },
    meta: { step: 2, day: 8 },
  };
}

async function loadPipeline() {
  const arg = process.argv[2];
  if (arg && existsSync(arg)) return JSON.parse(readFileSync(arg, 'utf8'));
  if (process.env.ADMIN_PASSWORD) {
    try {
      const r = await fetch(SITE + '/.netlify/functions/get-outreach-status', { headers: { 'x-admin-password': process.env.ADMIN_PASSWORD } });
      if (r.ok) { const j = await r.json(); return j.prospects || j.outreach || []; }
    } catch {}
  }
  return [];
}

function daysSince(iso) { const t = Date.parse(iso); return t ? Math.floor((Date.now() - t) / 86400000) : null; }

async function main() {
  const pipeline = await loadPipeline();
  let queued = 0, rested = 0;
  for (const p of pipeline) {
    const stage = (p.stage || '').toLowerCase();
    if (['replied', 'won', 'lost', 'brief_received', 'preview_sent'].includes(stage)) { rested++; continue; }
    if (stage !== 'contacted') { rested++; continue; }
    if (!p.email || isSuppressed(p.email)) { rested++; continue; }
    const since = daysSince(p.contactedAt || p.lastContactedAt);
    if (since === null) { rested++; continue; }
    const done = p.followupsSent || 0;
    let item = null;
    if (since >= 8 && done < 2) item = caseStudy(p);
    else if (since >= 3 && done < 1) item = bump(p);
    if (!item) { rested++; continue; }
    const res = await enqueue(item);
    if (res.queued) queued++;
  }
  console.error(`follow-ups queued ${queued}; rested ${rested}`);
}
main();
