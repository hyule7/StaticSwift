/*
 * cron-bd-floor.js — the always-on SDR floor. Runs on a schedule through UK
 * business hours so the pipeline fills and drafts itself even when Harry never
 * touches the button: scavenge poor-website businesses, enrich their contacts,
 * draft outreach into the approval queue. Nothing sends without approval (or an
 * earned auto-send category); the dispatcher handles the wire under the cap.
 *
 * This is what makes it feel like a 40-strong sales floor working all day,
 * not a one-shot button.
 */
const SITE = process.env.URL || 'https://staticswift.co.uk';

async function call(fn) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': process.env.ADMIN_PASSWORD || '' },
    });
    return await r.json().catch(() => ({ status: r.status }));
  } catch (e) { return { error: e.message }; }
}

function ukBusinessHours() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()));
  const day = new Date().toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
  return day !== 'Sat' && day !== 'Sun' && h >= 8 && h < 19;
}

exports.handler = async (event) => {
  const isSchedule = !event.headers || !!event.headers['x-nf-event'];
  const manual = process.env.ADMIN_PASSWORD && event.headers?.['x-admin-password'] === process.env.ADMIN_PASSWORD;
  if (!isSchedule && !manual) return { statusCode: 401, body: 'Unauthorized' };
  if (isSchedule && !ukBusinessHours()) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'outside UK business hours' }) };
  if (!process.env.ADMIN_PASSWORD) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'ADMIN_PASSWORD not set' }) };

  // The floor cycle, in order: find businesses, find their contacts, draft.
  const scav = await call('blitz-scavenge');
  const enr = await call('contact-enrich');
  const push = await call('blitz-push');

  // Log the floor's work so it shows live in the Workforce tab.
  try {
    await fetch(SITE + '/.netlify/functions/agent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
      body: JSON.stringify({ role: 'BD Floor', dept: 'Business Development', action: 'Floor cycle: scavenged ' + (scav.found || 0) + ', found ' + (enr.found || 0) + ' contacts, drafted ' + (push.drafted || 0), shift: 'auto' }),
    });
  } catch (_) {}

  return { statusCode: 200, body: JSON.stringify({ ok: true, scavenged: scav.found || 0, enriched: enr.found || 0, drafted: push.drafted || 0 }) };
};
