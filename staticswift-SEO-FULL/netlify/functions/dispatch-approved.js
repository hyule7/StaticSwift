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
// Daily send cap. Harry asked for the cap removed, so the default is now
// effectively unlimited; set OUTREACH_DAILY_CAP in Netlify to re-impose a limit.
// Note: sending hundreds/day from one domain risks the spam folder and a
// blacklist. The suppression list and the per-lead cadence still always apply.
const DAILY_CAP = Number(process.env.OUTREACH_DAILY_CAP || 100000);

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
  ).sort((a, b) => ((b.meta && b.meta.heat) || 0) - ((a.meta && a.meta.heat) || 0)); // hottest leads first

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
        text: body + '\n\nMessage me anytime: https://staticswift.co.uk/#message\nUnsubscribe: ' + unsub,
        headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      item.status = 'sent'; item.sentAt = new Date().toISOString();
      sent++; budget--;
      // Auto-queue the next follow-up so nobody gets one email and silence.
      // Step 1 (day 3): short bump. Step 2 (day 8): the case study. Pending,
      // so Harry still approves; only fires if they have not replied (the
      // classifier flips replied=true and we skip).
      const step = (item.meta && item.meta.followStep) || 0;
      if (step < 2 && (item.category === 'outreach' || item.category === 'outreach-followup')) {
        const nextStep = step + 1;
        const days = nextStep === 1 ? 3 : 8;
        const fn2 = (item.to.split('@')[0] || '').replace(/[._-]+/g, ' ').split(' ')[0];
        const fbody = nextStep === 1
          ? `Hi${fn2 ? ' ' + fn2 : ''},\n\nJust floating this back up. The free 24-hour preview still stands, no card, and you only pay the 499 pounds if you keep it.\n\nReply with your business name and I will start tonight.\n\nHarry\nStaticSwift, Manchester\nNot interested? Reply STOP.`
          : `Hi${fn2 ? ' ' + fn2 : ''},\n\nLast one from me. Rather than describe it, here is one I built: Harrison Electrical, Bristol. https://staticswift.co.uk/work/harrison-electrical/\n\nSame for you: hand-coded, live within 14 days, free preview in 24 hours if you want to see it.\n\nHarry\nStaticSwift, Manchester\nNot interested? Reply STOP.`;
        items.push({
          id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          createdAt: new Date().toISOString(), status: 'pending', category: 'outreach-followup',
          to: item.to, subject: 'Re: ' + item.subject.replace(/^Re:\s*/i, ''),
          body: fbody, prospect: item.prospect,
          sendAfter: new Date(Date.now() + days * 86400000).toISOString(),
          meta: { ...(item.meta || {}), followStep: nextStep, blitz: item.meta && item.meta.blitz },
        });
      }
    } catch (err) {
      item.status = 'failed'; item.error = err.message; failed++;
    }
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200)); // jittered throttle
  }

  await saveItems(store, items);
  console.log('[dispatch-approved]', JSON.stringify({ sent, failed, suppressed, sentToday }));
  return { statusCode: 200, body: JSON.stringify({ ok: true, sent, failed, suppressed, remainingBudget: budget }) };
};
