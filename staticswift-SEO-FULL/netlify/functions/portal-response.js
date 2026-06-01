/*
 * portal-response.js
 * ---------------------------------------------------------------
 * The single endpoint the client portal posts to. Handles every
 * interaction:
 *
 *   • approve  — signed approval. Updates stage → approved, fires the
 *                pipeline auto-invoice, drops a Harry alert. Stores
 *                the typed signature so we can prove sign-off later.
 *   • changes  — revision request. Stage → building. Notifies Harry.
 *   • message  — free-text message to Harry. Lands in the inbox AND
 *                the portal thread (the admin reads both).
 *   • reaction — emoji-style first take on the preview. Aggregated
 *                in c.previewReactions[key]++ and surfaced in admin.
 *   • addon    — interest in an upsell (hosting, copy, photos, SEO,
 *                referral). Logged + Harry pinged.
 *   • asset    — metadata-only registration of an uploaded file
 *                (the actual bytes go via portal-upload.js).
 *
 * Every action writes an entry to c.portalActivity[] so the admin
 * dashboard can render an audit trail without us having to reconstruct
 * one from timestamps.
 */

const { getClients, saveClient } = require('./_db');
const { createTransporter, LOGO_HTML } = require('./_mailer');

const VALID_TYPES = new Set(['approve', 'changes', 'message', 'reaction', 'addon', 'asset']);
const VALID_REACTIONS = new Set(['love', 'hmm', 'nice', 'issues']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad JSON' }) }; }

  const { portalUUID, type, notes, signature, key, addon, asset } = body;
  if (!portalUUID || !type) return { statusCode: 400, body: JSON.stringify({ error: 'missing fields' }) };
  if (!VALID_TYPES.has(type)) return { statusCode: 400, body: JSON.stringify({ error: 'unknown type' }) };

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === portalUUID);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'portal not found' }) };

    if (!Array.isArray(client.portalMessages)) client.portalMessages = [];
    if (!Array.isArray(client.portalActivity)) client.portalActivity = [];

    const fromAddr = process.env.SMTP_USER || 'hello@staticswift.co.uk';
    const safeNotes = String(notes || '').slice(0, 4000);
    const safeSig = String(signature || '').slice(0, 100).trim();

    // Audit-trail entry — admin reads this to see EVERY action the client took.
    function logActivity(payload) {
      client.portalActivity.push({
        at: new Date().toISOString(),
        type,
        ...payload,
      });
      // Keep last 200 events to keep the bin manageable
      if (client.portalActivity.length > 200) client.portalActivity = client.portalActivity.slice(-200);
    }

    let transporter = null;
    try { transporter = createTransporter(); } catch (e) { console.warn('[portal-response] SMTP unavailable:', e.message); }

    // ── APPROVE ──────────────────────────────────────────────────
    if (type === 'approve') {
      if (!safeSig) return { statusCode: 400, body: JSON.stringify({ error: 'signature required' }) };

      client.portalMessages.push({ from: 'client', type, notes: safeNotes, signature: safeSig, sentAt: new Date().toISOString() });
      client.stage = 'approved';
      client.approvedAt = new Date().toISOString();
      client.approvalNotes = safeNotes;
      client.approvalSignature = safeSig;
      logActivity({ summary: 'Signed approval', signature: safeSig, notes: safeNotes });
      await saveClient(client);

      // Auto-fire the invoice (existing flow — kept here to preserve behaviour)
      const isAdvanced = client.package === 'advanced';
      const hasHosting = client.hosting_addon === 'yes';
      const amount = (isAdvanced ? 299 : 149) + (hasHosting ? 29 : 0);

      if (transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: client.delivery_email,
            replyTo: fromAddr,
            subject: 'Invoice ready — ' + (client.business_name || ''),
            html: `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1ea"><tr><td align="center" style="padding:32px 14px">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.06)">
<tr><td style="padding:30px 36px 8px">
<div style="font-size:20px;font-weight:800">StaticSwift</div>
<div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#b08a3e;margin-top:18px">Invoice ready</div>
<h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.2;margin:8px 0 14px;font-weight:500">Signed off, ${escapeHtml((client.name || '').split(/\s+/)[0] || 'thanks')}.</h1>
<p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 18px">Your invoice is below. Pay by bank transfer (or ask about card) and your files arrive within an hour.</p>
</td></tr>
<tr><td style="padding:0 36px 12px">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px">
<tr style="background:#faf8f2"><td style="padding:12px 14px;border:1px solid #ece6d6">${isAdvanced ? 'Advanced' : 'Starter'} Website Design</td><td style="padding:12px 14px;border:1px solid #ece6d6;text-align:right">£${isAdvanced ? 299 : 149}</td></tr>
${hasHosting ? `<tr><td style="padding:12px 14px;border:1px solid #ece6d6">Hosting upload service</td><td style="padding:12px 14px;border:1px solid #ece6d6;text-align:right">£29</td></tr>` : ''}
<tr style="background:#0a0a0a;color:#fff;font-weight:700"><td style="padding:14px;border:1px solid #0a0a0a">Total due</td><td style="padding:14px;border:1px solid #0a0a0a;text-align:right;font-size:18px">£${amount}</td></tr>
</table></td></tr>
<tr><td style="padding:18px 36px 26px">
<div style="background:#faf8f2;border:1px solid #ece6d6;border-radius:10px;padding:18px 20px;font-size:13.5px;line-height:1.7">
<strong>Bank transfer (preferred)</strong><br>
Beneficiary: Harry Yule<br>Sort code: 04-00-75<br>Account: 98518224<br>Reference: ${escapeHtml(client.business_name || 'STATICSWIFT').slice(0, 18).toUpperCase()}<br>Bank: Revolut Ltd
<div style="font-size:11px;color:#888;margin-top:10px">International: IBAN GB64 REVO 0099 7062 6486 05 · BIC REVOGB21</div>
</div></td></tr>
<tr><td style="padding:0 36px 30px;font-size:13px;color:#555">Files delivered within 1 hour of payment confirmation. Reply to this email if you'd prefer to pay by card and we'll send a link.</td></tr>
<tr><td style="padding:20px 36px 30px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999">Harry &middot; StaticSwift &middot; <a href="https://staticswift.co.uk" style="color:#b08a3e;text-decoration:none">staticswift.co.uk</a></td></tr>
</table></td></tr></table></body></html>`,
          });
          client.stage = 'invoice-sent';
          client.invoiceSentAt = new Date().toISOString();
          client.amount = amount;
          await saveClient(client);
        } catch (e) {
          console.error('[portal-response] auto-invoice failed:', e.message);
        }

        // Notify Harry
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '✓ ' + (client.business_name || 'Client') + ' approved + signed',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2 style="color:#22c55e">Approved &amp; signed</h2>
              <p><strong>${escapeHtml(client.name || '')}</strong> (${escapeHtml(client.delivery_email || '')}) approved <strong>${escapeHtml(client.business_name || '')}</strong>.</p>
              <p>Signature: <em>"${escapeHtml(safeSig)}"</em></p>
              ${safeNotes ? `<p>Notes: <blockquote style="border-left:3px solid #00C8E0;padding-left:14px;color:#555;margin:8px 0">${escapeHtml(safeNotes)}</blockquote></p>` : ''}
              <p>Invoice fired automatically — £${amount}.</p>
            </div>`,
          });
        } catch (e) { console.warn('Harry notify failed:', e.message); }
      }
      return ok({ stage: client.stage });
    }

    // ── CHANGES ──────────────────────────────────────────────────
    if (type === 'changes') {
      if (!safeNotes.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'notes required' }) };
      client.portalMessages.push({ from: 'client', type, notes: safeNotes, sentAt: new Date().toISOString() });
      client.stage = 'building';
      client.changeRequest = safeNotes;
      client.changeRequestAt = new Date().toISOString();
      logActivity({ summary: 'Change request', notes: safeNotes });
      await saveClient(client);

      if (transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '⚠ ' + (client.business_name || 'Client') + ' — change request',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2>Changes requested</h2>
              <p><strong>${escapeHtml(client.name || '')}</strong> (${escapeHtml(client.delivery_email || '')}) wants changes:</p>
              <blockquote style="border-left:3px solid #00C8E0;padding-left:16px;color:#555;margin:16px 0;font-style:italic">${escapeHtml(safeNotes)}</blockquote>
              <p><a href="${process.env.URL || 'https://staticswift.co.uk'}/admin">Open admin →</a></p>
            </div>`,
          });
        } catch (e) { console.warn('Harry notify failed:', e.message); }
        try {
          await transporter.sendMail({
            from: '"StaticSwift" <' + fromAddr + '>',
            to: client.delivery_email,
            replyTo: fromAddr,
            subject: 'Change request received — we are on it',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2>Got it, ${escapeHtml(client.name || 'there')}.</h2>
              <p>Your change request landed. Updated preview ready within 24 hours — we'll email you the moment it's live.</p>
              <p style="color:#888;font-size:13px;margin-top:28px">StaticSwift — staticswift.co.uk</p>
            </div>`,
          });
        } catch (e) { console.warn('Customer ack failed:', e.message); }
      }
      return ok({ stage: client.stage });
    }

    // ── MESSAGE ──────────────────────────────────────────────────
    if (type === 'message') {
      if (!safeNotes.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'message required' }) };
      client.portalMessages.push({ from: 'client', type, notes: safeNotes, sentAt: new Date().toISOString() });
      // Surface in pipeline: if the client messages from a dead-quiet stage,
      // bump them to "needs reply" so the admin sees them in the unread queue.
      client.portalUnread = (client.portalUnread || 0) + 1;
      client.portalLastClientAt = new Date().toISOString();
      logActivity({ summary: 'Sent message', notes: safeNotes });
      await saveClient(client);

      if (transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            replyTo: client.delivery_email || fromAddr,
            subject: '💬 ' + (client.business_name || 'Client') + ' — portal message',
            html: LOGO_HTML + `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0 24px 32px">
              <h2>${escapeHtml(client.name || 'Client')} just messaged you</h2>
              <blockquote style="border-left:3px solid #00C8E0;padding-left:16px;color:#555;margin:16px 0">${escapeHtml(safeNotes).replace(/\n/g, '<br>')}</blockquote>
              <p style="font-size:13px;color:#888">Reply from admin (it lands in their portal thread) or just reply to this email.</p>
              <p><a href="${process.env.URL || 'https://staticswift.co.uk'}/admin">Open admin →</a></p>
            </div>`,
          });
        } catch (e) { console.warn('Message notify failed:', e.message); }
      }
      return ok({});
    }

    // ── REACTION ─────────────────────────────────────────────────
    if (type === 'reaction') {
      if (!VALID_REACTIONS.has(key)) return { statusCode: 400, body: JSON.stringify({ error: 'unknown reaction key' }) };
      if (!client.previewReactions || typeof client.previewReactions !== 'object') client.previewReactions = {};
      client.previewReactions[key] = (client.previewReactions[key] || 0) + 1;
      logActivity({ summary: 'Reacted: ' + key });
      await saveClient(client);

      // Light Harry-ping for "issues" only — the meaningful one.
      if (key === 'issues' && transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '⚠ ' + (client.business_name || 'Client') + ' flagged issues on preview',
            html: LOGO_HTML + '<div style="font-family:sans-serif;padding:20px"><p><strong>' + escapeHtml(client.name || 'Client') + '</strong> tapped <em>❌ Issues</em> on their preview — they may follow up with a change request.</p></div>',
          });
        } catch (e) { /* ignore */ }
      }
      return ok({ count: client.previewReactions[key] });
    }

    // ── ADDON INTEREST ────────────────────────────────────────────
    if (type === 'addon') {
      const addonKey = String(addon || '').slice(0, 40);
      if (!client.addonInterest) client.addonInterest = [];
      client.addonInterest.push({ key: addonKey, at: new Date().toISOString() });
      logActivity({ summary: 'Interested in add-on: ' + addonKey });
      await saveClient(client);
      if (transporter) {
        try {
          await transporter.sendMail({
            from: '"StaticSwift Portal" <' + fromAddr + '>',
            to: fromAddr,
            subject: '💰 ' + (client.business_name || 'Client') + ' interested in: ' + addonKey,
            html: LOGO_HTML + '<div style="font-family:sans-serif;padding:20px"><p><strong>' + escapeHtml(client.name || 'Client') + '</strong> (' + escapeHtml(client.delivery_email || '') + ') tapped <strong>' + escapeHtml(addonKey) + '</strong> in the portal. Send them a quote.</p></div>',
          });
        } catch (e) { /* ignore */ }
      }
      return ok({});
    }

    // ── ASSET (metadata only — actual file via portal-upload) ────
    if (type === 'asset') {
      const meta = asset || {};
      if (!Array.isArray(client.clientAssets)) client.clientAssets = [];
      client.clientAssets.push({
        name: String(meta.name || 'asset').slice(0, 120),
        bytes: Number(meta.bytes) || 0,
        kind: String(meta.kind || '').slice(0, 60),
        fileId: String(meta.fileId || '').slice(0, 100),
        at: new Date().toISOString(),
      });
      if (client.clientAssets.length > 60) client.clientAssets = client.clientAssets.slice(-60);
      logActivity({ summary: 'Uploaded asset: ' + meta.name });
      await saveClient(client);
      return ok({});
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'unhandled type' }) };
  } catch (err) {
    console.error('[portal-response] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function ok(extra) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, ...(extra || {}) }) };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
