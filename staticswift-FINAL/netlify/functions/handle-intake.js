const { saveClient } = require('./_db');
const { createTransporter } = require('./_mailer');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body || '{}');
    if (data['bot-field']) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const client = {
      ...data,
      clientId,
      stage: 'new-lead',
      createdAt: new Date().toISOString(),
      source: 'intake-form',
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
      const pkg = data.package === 'advanced' ? 'Advanced — £299' : 'Starter — £149';
      const hosting = data.hosting_addon === 'yes' ? ' + Hosting £29' : '';

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
    } catch (notifyErr) {
      console.warn('[handle-intake] admin notify failed (non-fatal):', notifyErr.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, clientId })
    };
  } catch (err) {
    console.error('[handle-intake] error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
