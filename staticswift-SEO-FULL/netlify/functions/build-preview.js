/*
 * build-preview.js — turns a prospect into a real, live, personalised one-page
 * website and returns the public link. This is the engine behind the
 * "I already built you this" cold email.
 *
 *   POST { prospect }            -> { ok, id, url }
 *   POST { prospect, return:'html' } -> { ok, html }   (preview without storing)
 *
 * Stores the rendered HTML in the client-files blob store under a stable id so
 * serve-preview can return it. Admin password or agent token. Prices/promises
 * come from data/facts.json so nothing drifts from the constitution.
 */
const fs = require('fs');
const path = require('path');
const { renderPreview, fieldsOf } = require('./_preview-builder');

let FACTS = null;
function facts() {
  if (FACTS) return FACTS;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/facts.json'), 'utf8'));
    FACTS = {
      build: raw.pricing?.starter?.build ?? 499,
      previewHours: raw.delivery?.preview_hours ?? 24,
      buildDays: raw.delivery?.build_days ?? 14,
      guaranteeDays: raw.guarantee?.days ?? 60,
      waDisplay: raw.contact?.whatsapp_display ?? '07502 731 799',
      waLink: raw.contact?.whatsapp ?? '+447502731799',
      email: raw.contact?.email ?? 'hello@staticswift.co.uk',
    };
  } catch {
    FACTS = { build: 499, previewHours: 24, buildDays: 14, guaranteeDays: 60, waDisplay: '07502 731 799', waLink: '+447502731799', email: 'hello@staticswift.co.uk' };
  }
  return FACTS;
}

const slug = s => String(s || 'prospect').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'prospect';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const agent = event.headers['x-agent-token'];
  const okAdmin = process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
  const okAgent = process.env.AGENT_TOKEN && agent === process.env.AGENT_TOKEN;
  if (!okAdmin && !okAgent) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body; try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }
  const prospect = body.prospect || body;
  if (!prospect || typeof prospect !== 'object') return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'prospect required' }) };

  let html;
  try { html = renderPreview(prospect, facts()); }
  catch (e) { return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'render failed: ' + e.message }) }; }

  if (body.return === 'html') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, html }) };
  }

  // Store so serve-preview can return it on a public link.
  let store;
  try { store = require('./_filestore').getFileStore(); }
  catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Storage unavailable: ' + e.message + '. Set NETLIFY_AUTH_TOKEN to publish live preview links.', html }) };
  }

  const f = fieldsOf(prospect);
  const id = 'auto_' + slug(f.business) + '_' + Date.now().toString(36);
  const filename = slug(f.business) + '-preview.html';
  try {
    await store.set(id, html, { metadata: { mimeType: 'text/html', filename, business: f.business, trade: f.trade, town: f.town, kind: 'auto-preview', builtAt: new Date().toISOString() } });
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Store write failed: ' + e.message }) };
  }

  const site = process.env.SS_SITE || 'https://staticswift.co.uk';
  const url = `${site}/.netlify/functions/serve-preview?id=${encodeURIComponent(id)}`;
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, id, url, business: f.business }) };
};
