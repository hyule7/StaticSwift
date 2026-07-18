/*
 * blitz-backlinks.js — the Link Building agent.
 *
 * IMPORTANT (why this does not auto-post links): automated link placement is a
 * Google "link scheme" and gets a site penalised or deindexed. Real backlink
 * sources also require human verification / CAPTCHA. So this agent does the
 * legwork legitimately: it maintains a checklist of genuine, high-value UK
 * backlink targets, generates PASTE-READY listing content from data/facts.json,
 * and tracks status - so each real submission Harry makes takes seconds. It
 * never submits anything itself.
 *
 * State persists in Blobs (ops/backlink-tasks) so statuses survive. Runs on the
 * blitz tick (logs progress) and is readable by the admin (the Backlinks panel).
 * Admin password or agent token.
 */
const { getNamedStore } = require('./_blobs');

const NAP = {
  name: 'StaticSwift',
  category: 'Website Designer',
  location: 'Manchester, United Kingdom',
  phone: '07502 731 799',
  phoneIntl: '+44 7502 731 799',
  email: 'hello@staticswift.co.uk',
  website: 'https://staticswift.co.uk',
  short: 'Hand-coded websites for UK tradespeople and local businesses. £499 one-off, free working preview in 24 hours, 60-day lead guarantee.',
  long: 'StaticSwift hand-codes fast, premium websites for UK tradespeople and local businesses. One craftsman in Manchester, no templates or page builders. £499 one-time build with an optional £49/month managed plan, a free working preview within 24 hours of a short brief, and a 60-day guarantee: if the site does not produce a lead you get a full refund and keep the site. Rated 5 out of 5 on Google.',
};

// Real, legitimate UK backlink targets. type: citation (NAP directory),
// agency (web-design niche, higher authority), trust (review platform),
// social (profile + bio link). effort: mins. All require a genuine human submit.
const TARGETS = [
  { id: 'bing-places', name: 'Bing Places', url: 'https://www.bingplaces.com', type: 'citation', priority: 1, note: 'Second search engine. Import from Google Business Profile in one step.' },
  { id: 'apple-business', name: 'Apple Business Connect', url: 'https://businessconnect.apple.com', type: 'citation', priority: 1, note: 'Feeds Apple Maps + Siri. Free.' },
  { id: 'trustpilot', name: 'Trustpilot', url: 'https://business.trustpilot.com', type: 'trust', priority: 1, note: 'Verification file already on the site. Add the profile + gather a couple of reviews.' },
  { id: 'clutch', name: 'Clutch', url: 'https://clutch.co', type: 'agency', priority: 1, note: 'Niche-relevant, high authority. Create an agency profile.' },
  { id: 'designrush', name: 'DesignRush', url: 'https://www.designrush.com', type: 'agency', priority: 2, note: 'Web design agency directory.' },
  { id: 'themanifest', name: 'The Manifest', url: 'https://themanifest.com', type: 'agency', priority: 2, note: 'B2B agency listing (Clutch sister site).' },
  { id: 'goodfirms', name: 'GoodFirms', url: 'https://www.goodfirms.co', type: 'agency', priority: 2, note: 'Agency directory.' },
  { id: 'sortlist', name: 'Sortlist UK', url: 'https://www.sortlist.co.uk', type: 'agency', priority: 2, note: 'Agency marketplace, also sends leads.' },
  { id: 'bark', name: 'Bark', url: 'https://www.bark.com', type: 'agency', priority: 2, note: 'Directory + lead source.' },
  { id: 'yell', name: 'Yell', url: 'https://www.yell.com', type: 'citation', priority: 2, note: 'Free UK business listing.' },
  { id: 'freeindex', name: 'FreeIndex', url: 'https://www.freeindex.co.uk', type: 'citation', priority: 2, note: 'Free UK directory with a do-follow link.' },
  { id: 'cylex', name: 'Cylex UK', url: 'https://www.cylex-uk.co.uk', type: 'citation', priority: 3, note: 'Free UK listing.' },
  { id: 'hotfrog', name: 'Hotfrog UK', url: 'https://www.hotfrog.co.uk', type: 'citation', priority: 3, note: 'Free UK listing.' },
  { id: 'scoot', name: 'Scoot', url: 'https://www.scoot.co.uk', type: 'citation', priority: 3, note: 'Free UK listing.' },
  { id: 'thomson', name: 'Thomson Local', url: 'https://www.thomsonlocal.com', type: 'citation', priority: 3, note: 'Free UK listing.' },
  { id: 'brownbook', name: 'Brownbook', url: 'https://www.brownbook.net', type: 'citation', priority: 3, note: 'Free global listing.' },
  { id: 'uksbd', name: 'UK Small Business Directory', url: 'https://www.uksmallbusinessdirectory.co.uk', type: 'citation', priority: 3, note: 'Free UK listing.' },
  { id: '192', name: '192.com', url: 'https://www.192.com', type: 'citation', priority: 3, note: 'Free business listing.' },
  { id: 'linkedin', name: 'LinkedIn Company Page', url: 'https://www.linkedin.com/company/setup/new/', type: 'social', priority: 2, note: 'Create the page, put the website in the bio, post your work.' },
  { id: 'facebook', name: 'Facebook Page', url: 'https://www.facebook.com/pages/create', type: 'social', priority: 3, note: 'Business page + website in About.' },
  { id: 'instagram', name: 'Instagram Business', url: 'https://www.instagram.com', type: 'social', priority: 3, note: 'Bio link to the site, post builds.' },
  { id: 'client-footer', name: 'Client site footer credits', url: 'https://staticswift.co.uk', type: 'compounding', priority: 1, note: 'Add a small "Site by StaticSwift" footer link (with permission) on every client site you ship. Your strongest, most natural, free link source - it compounds with every sale.' },
];

const KEY = 'backlink-tasks';

function pasteReady(t) {
  const L = [
    'Business name: ' + NAP.name,
    'Category: ' + NAP.category,
    'Location: ' + NAP.location,
    'Phone: ' + NAP.phone + '  (' + NAP.phoneIntl + ')',
    'Email: ' + NAP.email,
    'Website: ' + NAP.website,
    '',
    'Short description:',
    NAP.short,
    '',
    'Full description:',
    NAP.long,
  ];
  if (t.type === 'social') L.push('', 'Bio link: ' + NAP.website);
  return L.join('\n');
}

async function load(store) {
  const saved = (store && (await store.get(KEY, { type: 'json' }))) || { tasks: {}, updatedAt: null };
  // Merge current TARGETS in, preserving any saved status.
  const tasks = TARGETS.map(t => {
    const s = saved.tasks[t.id] || {};
    return { ...t, status: s.status || 'pending', doneAt: s.doneAt || null, listing: pasteReady(t) };
  });
  return { tasks, updatedAt: saved.updatedAt };
}

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const token = event.headers['x-agent-token'];
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && token === process.env.AGENT_TOKEN;
  if (!okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const store = getNamedStore('ops');
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}

  // Admin can mark a target done/pending: POST { action:'set', id, status }.
  if (event.httpMethod === 'POST' && okAdmin && body.action === 'set' && body.id) {
    const saved = (store && (await store.get(KEY, { type: 'json' }))) || { tasks: {} };
    saved.tasks = saved.tasks || {};
    saved.tasks[body.id] = { status: body.status === 'done' ? 'done' : 'pending', doneAt: body.status === 'done' ? new Date().toISOString() : null };
    saved.updatedAt = new Date().toISOString();
    if (store) await store.setJSON(KEY, saved);
  }

  const { tasks, updatedAt } = await load(store);
  const pending = tasks.filter(t => t.status !== 'done');
  const done = tasks.length - pending.length;

  // On a blitz tick (POST without a 'set' action), log the next best action so
  // the board shows real progress. Admin panel reads via GET and does not log.
  if (event.httpMethod === 'POST' && body.action !== 'set') {
    const next = pending.sort((a, b) => a.priority - b.priority)[0];
    try {
      await fetch((process.env.URL || 'https://staticswift.co.uk') + '/.netlify/functions/agent-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
        body: JSON.stringify({
          role: 'Link Building Agent', dept: 'Partnerships & Referrals', shift: 'blitz',
          action: next ? ('Prepared a paste-ready listing for ' + next.name + ' (' + done + '/' + tasks.length + ' backlinks done)') : ('All ' + tasks.length + ' backlink targets marked done - nice'),
          detail: next ? next.type : '',
        }),
      });
    } catch (_) {}
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, done, total: tasks.length, pending: pending.length, updatedAt, tasks }),
  };
};
