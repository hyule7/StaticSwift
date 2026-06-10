/*
 * daily-followup.js
 * ---------------------------------------------------------------
 * Sequence engine for cold outreach. Runs on a daily cron (see
 * netlify.toml schedule) AND can be triggered manually from the
 * admin panel for ad-hoc rebuilds.
 *
 * For every prospect in db.cronProspects:
 *   • If they replied → never queue another follow-up.
 *   • If they're on the suppression list → never queue.
 *   • Day 0:  initial outbound (handled by admin manual / autopilot).
 *   • Day 5:  "bumping this" follow-up.
 *   • Day 12: "last note" follow-up.
 *   • Day 25: archive.
 *
 * We don't auto-SEND — we queue drafts into db.outreachDrafts so a
 * human can review (or autopilot can send if its "autosend" switch
 * is on). This is intentional: sending blind from a cron is how you
 * torch your sending reputation overnight.
 *
 * Returns a JSON summary so the admin "Run follow-ups now" button
 * can show what happened.
 */

const { readDB, writeDB } = require('./_db');
const { isSuppressed, normalizeEmail } = require('./_suppression');

const SEQUENCE = [
  {
    day: 5,
    tag: 'followup-1',
    subject: (p) => 'Re: ' + (p.bizname || 'your website'),
    body: (p) => [
      'Hi ' + firstName(p) + ',',
      '',
      'Bumping this back to the top in case it got buried.',
      '',
      "I built a quick rough preview of what " + (p.bizname || 'your business') + " could look like — happy to send it over with no obligation. Takes me a couple of hours, costs you nothing, and you only pay if you actually want to use it.",
      '',
      "Worth a 5-minute look?",
      '',
      'Cheers,',
      'Harry',
    ].join('\n'),
  },
  {
    day: 12,
    tag: 'followup-2',
    subject: (p) => 'last note — ' + (p.bizname || 'your site'),
    body: (p) => [
      'Hi ' + firstName(p) + ',',
      '',
      "Last note from me — I won't keep poking after this.",
      '',
      "If a faster, mobile-first " + (p.type || 'business') + " website (£149, ready in 24h, no monthly fees) is something you'd ever want to look at, just hit reply with one word — \"preview\" — and I'll send a free mockup over.",
      '',
      "If not, no problem at all. Wishing you a great year.",
      '',
      'Cheers,',
      'Harry',
    ].join('\n'),
  },
];

const ARCHIVE_AFTER_DAYS = 25;

function firstName(p) {
  const raw = p.contactName || p.name || '';
  if (raw) return String(raw).trim().split(/\s+/)[0];
  return 'there';
}

function daysSince(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
}

async function runSequence({ dryRun = false } = {}) {
  const db = await readDB();
  const prospects = Array.isArray(db.cronProspects) ? db.cronProspects : [];
  if (!Array.isArray(db.outreachDrafts)) db.outreachDrafts = [];

  const result = {
    scanned: prospects.length,
    queuedDay5: 0,
    queuedDay12: 0,
    archived: 0,
    skippedReplied: 0,
    skippedSuppressed: 0,
    skippedNoEmail: 0,
    skippedNotInitial: 0,
    skippedExistingDraft: 0,
  };

  const draftKey = (pid, tag) => pid + '|' + tag;
  const existingDrafts = new Set(
    db.outreachDrafts.map(d => draftKey(d.prospectId, d.tag))
  );

  for (let i = prospects.length - 1; i >= 0; i--) {
    const p = prospects[i];
    const initialSentAt = p.outreachSentAt || p.lastSentAt;
    if (!initialSentAt) { result.skippedNotInitial++; continue; }

    const age = daysSince(initialSentAt);

    if (age >= ARCHIVE_AFTER_DAYS && p.status !== 'replied' && p.status !== 'archived') {
      if (!dryRun) {
        prospects[i] = { ...p, status: 'archived', archivedAt: new Date().toISOString(), archiveReason: 'no-reply-' + age + 'd' };
      }
      result.archived++;
      continue;
    }

    if (p.status === 'replied' || p.repliedAt) { result.skippedReplied++; continue; }
    if (!isValidEmail(p.email)) { result.skippedNoEmail++; continue; }

    if (await isSuppressed(p.email)) {
      result.skippedSuppressed++;
      if (!dryRun) {
        prospects[i] = { ...p, status: 'suppressed', suppressedAt: new Date().toISOString() };
      }
      continue;
    }

    for (const step of SEQUENCE) {
      if (age < step.day) continue;
      const key = draftKey(p.id, step.tag);
      if (existingDrafts.has(key)) { result.skippedExistingDraft++; continue; }
      const log = Array.isArray(p.sequenceLog) ? p.sequenceLog : [];
      if (log.some(l => l.tag === step.tag)) continue;

      if (!dryRun) {
        db.outreachDrafts.unshift({
          id: 'fu-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          prospectId: p.id,
          to: normalizeEmail(p.email),
          bizname: p.bizname || '',
          subject: step.subject(p),
          body: step.body(p),
          tag: step.tag,
          createdAt: new Date().toISOString(),
          source: 'daily-followup',
          status: 'queued',
        });
        existingDrafts.add(key);
      }
      if (step.tag === 'followup-1') result.queuedDay5++;
      else if (step.tag === 'followup-2') result.queuedDay12++;
    }
  }

  if (db.outreachDrafts.length > 5000) db.outreachDrafts = db.outreachDrafts.slice(0, 5000);

  if (!dryRun) {
    db.cronProspects = prospects;
    if (!db.cronLog) db.cronLog = [];
    db.cronLog.unshift({ ran: 'daily-followup', at: new Date().toISOString(), ...result });
    if (db.cronLog.length > 200) db.cronLog = db.cronLog.slice(0, 200);
    // ss:outreach-dashboard — surfaced by get-outreach-status.js + admin/outreach.html
    db.lastDailyFollowup = new Date().toISOString();
    await writeDB(db);
  }
  return result;
}

exports.handler = async (event) => {
  // Allow scheduled (no auth) AND manual admin trigger (auth required).
  const isScheduled = !event.httpMethod || event.headers['x-netlify-scheduled'] === 'true';
  const dryRun = (event.queryStringParameters || {}).dryRun === '1';

  if (!isScheduled) {
    const auth = event.headers && event.headers['x-admin-password'];
    if (auth !== (process.env.ADMIN_PASSWORD)) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  try {
    const summary = await runSequence({ dryRun });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, dryRun, ...summary }),
    };
  } catch (err) {
    console.error('[daily-followup] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
