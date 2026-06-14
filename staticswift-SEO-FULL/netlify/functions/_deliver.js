/*
 * _deliver.js — the approve-once-and-it-ships pipeline.
 *
 * Called by queue-action when Harry approves a category 'design' item that
 * carries meta.deploy. One tap on his phone must complete the whole delivery
 * with zero further action:
 *   1. publish the approved build to the client portal (Blobs 'portals')
 *   2. archive the approved build (Blobs 'build-archive')
 *   3. email the client their live link
 *   4. advance the CRM stage to 'won' / 'live'
 *   5. trigger the production deploy via the Netlify build hook
 *
 * Every step is best-effort and logged; a failure in one does not abort the
 * others, and the item records what completed so a retry is safe. No money
 * moves here; this is publish + notify only.
 */
const { getNamedStore } = require('./_blobs');
const { createTransporter } = require('./_mailer');

async function deliverApprovedDesign(item) {
  const result = { portal: false, archive: false, email: false, crm: false, deploy: false };
  const meta = item.meta || {};
  const clientId = meta.clientId;
  const liveUrl = meta.liveUrl || (meta.slug ? `https://staticswift.co.uk/${meta.slug}/` : null);

  // 1 + 2: portal publish + archive
  try {
    const portals = getNamedStore('portals');
    if (portals && clientId) {
      const cur = (await portals.get(clientId, { type: 'json' })) || {};
      cur.latestBuild = { approvedAt: new Date().toISOString(), liveUrl, subject: item.subject, html: meta.html || null };
      cur.planStatus = cur.planStatus || 'active';
      await portals.setJSON(clientId, cur);
      result.portal = true;
    }
    const archive = getNamedStore('build-archive');
    if (archive && clientId) {
      await archive.setJSON(`${clientId}-${Date.now()}`, { clientId, liveUrl, subject: item.subject, html: meta.html || null, at: new Date().toISOString() });
      result.archive = true;
    }
  } catch (e) { result.portalError = e.message; }

  // 3: email the client their link
  try {
    if (process.env.SMTP_PASS && meta.clientEmail) {
      const t = createTransporter();
      await t.sendMail({
        from: '"Harry at StaticSwift" <' + (process.env.SMTP_USER || 'hello@staticswift.co.uk') + '>',
        to: meta.clientEmail,
        replyTo: process.env.SMTP_USER || 'hello@staticswift.co.uk',
        subject: 'Your StaticSwift website is live',
        text: `Hi${meta.clientName ? ' ' + String(meta.clientName).split(/\s+/)[0] : ''},\n\nYour site is live: ${liveUrl || 'link to follow'}\n\nIt's in your portal too. Reply with any tweaks, your one free revision is included.\n\nHarry\nStaticSwift, Manchester`,
      });
      result.email = true;
    }
  } catch (e) { result.emailError = e.message; }

  // 4: advance CRM stage
  try {
    const { getClient, updateClient } = require('./_db');
    if (clientId && typeof updateClient === 'function') {
      await updateClient(clientId, { stage: 'won', liveUrl, wentLiveAt: new Date().toISOString() });
      result.crm = true;
    }
  } catch (e) { result.crmError = e.message; }

  // 5: trigger production deploy via Netlify build hook
  try {
    if (process.env.NETLIFY_BUILD_HOOK) {
      await fetch(process.env.NETLIFY_BUILD_HOOK, { method: 'POST' });
      result.deploy = true;
    }
  } catch (e) { result.deployError = e.message; }

  return result;
}

module.exports = { deliverApprovedDesign };
