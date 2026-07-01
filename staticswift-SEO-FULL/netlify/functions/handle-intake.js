const { saveClient } = require('./_db');
const { createTransporter } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // Accept both JSON (fetch path) and form-encoded (non-JS fallback path).
    // The fallback exists so a JS failure can never silently eat a lead again.
    const ctype = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    const isFormPost = ctype.includes('application/x-www-form-urlencoded');
    let data;
    if (isFormPost) {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
      data.source = data.source || 'nojs-fallback';
      data.stage = data.stage || 'new-lead';
    } else {
      data = JSON.parse(event.body || '{}');
    }
    const respond = (code, body) => isFormPost
      ? { statusCode: 303, headers: { Location: code === 200 ? '/thank-you.html' : '/thank-you.html?status=error' }, body: '' }
      : { statusCode: code, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
    if (data['bot-field']) return respond(200, { ok: true });

    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    // Partner referral attribution: prefer the posted ref field, fall back to
    // the ss_ref cookie set when they clicked a partner link. Sanitised.
    const cookieRef = (((event.headers && (event.headers.cookie || event.headers.Cookie)) || '').match(/ss_ref=([^;]+)/) || [])[1] || '';
    const ref = String(data.ref || cookieRef || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const client = {
      ...data,
      clientId,
      stage: 'new-lead',
      createdAt: new Date().toISOString(),
      source: data.source || 'intake-form',
      ref: ref || undefined,
      emailLog: [],
    };

    await saveClient(client);
    console.log('[handle-intake] saved:', clientId);

    // ── Admin notification email ────────────────────────────────────────────
    // Sends Harry a full summary with WhatsApp quick-link so he can reach out fast
    try {
      const transporter = createTransporter();
      const waRaw = (data.whatsapp || data.phone || '').replace(/\D/g, '');
      const waNum = waRaw.startsWith('0') ? '44' + waRaw.slice(1) : waRaw;
      const waLink = waNum ? `https://wa.me/${waNum}` : null;
      const callLink = (data.whatsapp || data.phone) ? `tel:${(data.whatsapp || data.phone).replace(/\s/g, '')}` : null;
      // Package labels trace to data/facts.json. Unknown/legacy values fall
      // back to the raw value so nothing is mislabelled in the notification.
      const pkgLabels = {
        'subscription-499-49': 'Starter — £499 once, optional £49/mo',
        'starter': 'Starter — £499',
        'pro': 'Pro — £999',
      };
      const pkg = pkgLabels[data.package] || (data.package ? String(data.package) : 'Starter — £499');
      const hosting = '';

      const rows = [
        ['Name', data.name],
        ['Business', data.business_name],
        ['Type', data.business_type],
        ['Location', data.location],
        ['Package', pkg + hosting],
        ['Delivery email', data.delivery_email],
        ['WhatsApp/Phone', data.whatsapp || data.phone || '—'],
        ['Description', data.business_description],
        ['Services', data.services],
        ['USP', data.usp],
        ['Hours', data.hours],
        ['Enquiry email', data.enquiry_email],
        ['Social', data.social_links],
        ['Brand colours', data.brand_colours],
        ['Theme', data.theme],
        ['Personality', data.brand_personality],
        ['References', [data.reference_1, data.reference_2, data.reference_3].filter(Boolean).join(', ')],
        ['Requests', data.special_requests],
        ['Avoid', data.avoid],
        ['Heard about us', data.heard_about],
        ['Extra notes', data.extra_info],
      ].filter(([, v]) => v);

      const rowsHtml = rows.map(([k, v]) =>
        `<tr><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#555;white-space:nowrap;border-bottom:1px solid #f0f0f0;width:160px;">${k}</td><td style="padding:8px 12px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${String(v).replace(/\n/g, '<br>')}</td></tr>`
      ).join('');

      const adminHtml = `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <div style="background:#00C8E0;padding:20px 28px;">
    <h1 style="margin:0;font-size:20px;color:#07090f;font-weight:800;">🎉 New Order — StaticSwift</h1>
    <p style="margin:4px 0 0;font-size:14px;color:#07090f;opacity:.75;">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
  </div>
  <div style="padding:24px 28px;">
    ${waLink ? `<div style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap;">
      <a href="${waLink}" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">💬 WhatsApp ${data.name}</a>
      ${callLink ? `<a href="${callLink}" style="background:#3b82f6;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">📞 Call ${data.name}</a>` : ''}
    </div>` : ''}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${rowsHtml}
    </table>
    <p style="font-size:12px;color:#888;margin:0;">Client ID: ${clientId}</p>
  </div>
</div>`;

      await transporter.sendMail({
        from: '"StaticSwift" <hello@staticswift.co.uk>',
        to: 'hello@staticswift.co.uk',
        subject: `🎉 New order: ${data.business_name || data.name} — ${pkg}`,
        html: adminHtml,
      });
      console.log('[handle-intake] admin notification sent');

      // ── Instant confirmation to the LEAD ────────────────────────────────
      // Fires within seconds, 24/7, no AI. Converts: a fast, human reply that
      // keeps the reply-within-the-hour promise stops the lead shopping around.
      // Plain text, from Harry, Field Guide voice, no em dashes.
      if (data.delivery_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.delivery_email)) {
        const fname = (data.name || '').trim().split(/\s+/)[0] || 'there';
        const h = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false });
        const working = (() => { const hr = Number(h); const day = new Date().toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }); const we = day === 'Sat' || day === 'Sun'; return !we && hr >= 9 && hr < 18; })();
        const whenLine = working
          ? "I'll WhatsApp you within the hour to confirm a couple of details."
          : "I'll WhatsApp you first thing during working hours to confirm a couple of details.";
        await transporter.sendMail({
          from: '"Harry at StaticSwift" <hello@staticswift.co.uk>',
          to: data.delivery_email,
          replyTo: 'hello@staticswift.co.uk',
          subject: 'Got your brief, ' + fname + ' (preview within 24 hours)',
          text:
`Hi ${fname},

Got it, your brief just landed with me. ${whenLine}

Your free working preview lands in your inbox within 24 hours. No card, no charge. If you keep it it's £499 once, and if it does not bring you a lead in 60 days you get your money back and keep the site.

If it's quicker for you, just reply here or message me on WhatsApp: 07502 731 799.

Harry
StaticSwift, Manchester`,
        });
        console.log('[handle-intake] lead confirmation sent to', data.delivery_email);
      }
    } catch (notifyErr) {
      console.warn('[handle-intake] notify/confirm failed (non-fatal):', notifyErr.message);
    }

    return respond(200, { ok: true, clientId });
  } catch (err) {
    console.error('[handle-intake] error:', err.message);
    const ctype2 = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    if (ctype2.includes('application/x-www-form-urlencoded')) {
      return { statusCode: 303, headers: { Location: '/thank-you.html?status=error' }, body: '' };
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
