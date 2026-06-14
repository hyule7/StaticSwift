/*
 * cron-nurture.js — daily sender for the 5-email nurture sequence.
 *
 * Runs once a day (see netlify.toml schedule). For each db.nurture record:
 *   - skip if suppressed (opted out) or if the record has replied/converted
 *   - compute days since addedAt
 *   - send the highest due step (day <= daysSince) not yet in sentSteps
 *   - record the step in sentSteps so it never repeats
 *
 * One email per record per run (no catch-up spam if a run is missed; the
 * next run picks up where it left off). Plain text, from Harry, with a
 * working one-click unsubscribe. Honours the suppression list at send time.
 */
const { readDB, writeDB } = require('./_db');
const { isSuppressed, normalizeEmail, unsubUrl } = require('./_suppression');
const { createTransporter } = require('./_mailer');
const { STEPS } = require('./_nurture-sequence');

const DAY = 86400000;

exports.handler = async (event) => {
  // Allow the Netlify scheduler, a deploy hook, or an authed manual run.
  const isSchedule = !!event.headers?.['x-nf-event'] || event.source === 'schedule' || !event.headers;
  const auth = event.headers?.['x-admin-password'];
  if (!isSchedule && (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  if (!process.env.SMTP_PASS) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no SMTP_PASS' }) };

  const db = await readDB(true);
  const list = Array.isArray(db.nurture) ? db.nurture : [];
  const now = Date.now();
  const transporter = createTransporter();
  const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  let sent = 0, skipped = 0;
  const log = [];

  for (const rec of list) {
    if (!rec || !rec.email) { skipped++; continue; }
    if (rec.replied || rec.converted || rec.stop) { skipped++; continue; }
    if (await isSuppressed(rec.email)) { skipped++; continue; }

    const added = Date.parse(rec.addedAt || rec.lastSeenAt || 0) || now;
    const daysSince = Math.floor((now - added) / DAY);
    rec.sentSteps = Array.isArray(rec.sentSteps) ? rec.sentSteps : [];

    // Highest step whose day has arrived and which has not been sent.
    const due = STEPS
      .map((s, i) => ({ i, day: s.day }))
      .filter(s => s.day <= daysSince && !rec.sentSteps.includes(s.i));
    if (!due.length) { skipped++; continue; }
    const step = due[due.length - 1];
    const def = STEPS[step.i];
    const unsub = unsubUrl(rec.email, 'nurture');
    const text = def.body({ name: rec.name, unsub });

    try {
      await transporter.sendMail({
        from: '"Harry at StaticSwift" <' + fromAddr + '>',
        to: rec.email,
        replyTo: fromAddr,
        subject: def.subject,
        text,
        headers: {
          'List-Unsubscribe': '<' + unsub + '>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      rec.sentSteps.push(step.i);
      rec.lastNurtureAt = new Date(now).toISOString();
      sent++;
      log.push({ email: normalizeEmail(rec.email), step: step.i, day: def.day });
    } catch (err) {
      log.push({ email: normalizeEmail(rec.email), error: err.message });
    }
    // Gentle throttle so a big batch does not trip the SMTP rate limit.
    await new Promise(r => setTimeout(r, 400));
  }

  try { await writeDB(db); } catch (err) { console.error('[cron-nurture] writeDB failed:', err.message); }
  console.log('[cron-nurture]', JSON.stringify({ sent, skipped }));
  return { statusCode: 200, body: JSON.stringify({ ok: true, sent, skipped, log: log.slice(0, 50) }) };
};
