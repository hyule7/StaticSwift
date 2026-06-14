/*
 * dispatch-approved.js — the only path from "approved" to "on the wire".
 *
 * Scheduled (hourly in UK business hours) and manually triggerable by admin.
 * Sends approved/edited items in the SENDABLE categories via FastHosts SMTP,
 * throttled to a daily cap, honouring the kill switches and the suppression
 * list. Marks each item sent|failed. No AI here: this function runs 24/7
 * independent of the Mac (the plumbing never sleeps).
 *
 * Hard limits: DAILY_CAP sends/day across all categories; never sends a
 * category whose kill switch is on; never sends to a suppressed address;
 * only SENDABLE categories (money/pricing/refunds are never dispatchable).
 */
const { load, saveItems } = require('./_queue');
const { createTransporter } = require('./_mailer');
const { isSuppressed, unsubUrl } = require('./_suppression');

const SENDABLE = new Set(['outreach', 'outreach-followup', 'cs-reply']);
const DAILY_CAP = Number(process.env.OUTREACH_DAILY_CAP || 30);

function ukBusinessHours() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()));
  const day = new Date().toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
  const weekend = day === 'Sat' || day === 'Sun';
  return !weekend && h >= 9 && h < 17;
}

exports.handler = async (event) => {
  const isSchedule = !event.headers || !!event.headers['x-nf-event'];
  const auth = event.headers?.['x-admin-password'];
  const manual = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  if (!isSchedule && !manual) return { statusCode: 401, body: 'Unauthorized' };
  if (!process.env.SMTP_PASS) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no SMTP_PASS' }) };
  if (isSchedule && !manual && !ukBusinessHours()) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'outside UK business hours' }) };
  }

  const { store, items, control } = await load();
  if (!store) return { statusCode: 500, body: JSON.stringify({ error: 'Blobs unavailable' }) };
  if (control.kill.global) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'global kill on' }) };

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = items.filter(i => i.status === 'sent' && (i.sentAt || '').slice(0, 10) === today).length;
  let budget = Math.max(0, DAILY_CAP - sentToday);
  if (budget === 0) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'daily cap reached', sentToday }) };

  const transporter = createTransporter();
  const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
  const due = items.filter(i =>
    (i.status === 'approved' || i.status === 'edited') &&
    SENDABLE.has(i.category) && i.to &&
    !control.kill[i.category] &&
    (!i.sendAfter || Date.parse(i.sendAfter) <= Date.now())
  );

  let sent = 0, failed = 0, suppressed = 0;
  for (const item of due) {
    if (budget <= 0) break;
    if (await isSuppressed(item.to)) { item.status = 'rejected'; item.meta = { ...item.meta, suppressedAtSend: true }; suppressed++; continue; }
    const body = item.editedBody || item.body;
    const unsub = unsubUrl(item.to, item.category);
    try {
      await transporter.sendMail({
        from: '"Harry at StaticSwift" <' + fromAddr + '>',
        to: item.to,
        replyTo: fromAddr,
        subject: item.subject,
        text: body + '\n\n— Unsubscribe: ' + unsub,
        headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      item.status = 'sent'; item.sentAt = new Date().toISOString();
      sent++; budget--;
    } catch (err) {
      item.status = 'failed'; item.error = err.message; failed++;
    }
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200)); // jittered throttle
  }

  await saveItems(store, items);
  console.log('[dispatch-approved]', JSON.stringify({ sent, failed, suppressed, sentToday }));
  return { statusCode: 200, body: JSON.stringify({ ok: true, sent, failed, suppressed, remainingBudget: budget }) };
};
