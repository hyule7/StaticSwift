/**
 * track-event.js — Lightweight self-hosted analytics ingest.
 *
 * Receives pings from the in-page tracker (window.ss.track()) and writes
 * them to Netlify Blobs, bucketed by day. No third-party tracking, no GA tag.
 *
 * Stored shape: blob "analytics/YYYY-MM-DD" is a JSON array of events:
 *   { t, type, path, ref, sid, ua, lang, vp, dur, country, city, evt }
 *
 * The function is intentionally open (no auth) — it's a public endpoint that
 * the website pings on every page view. To stop abuse we cap event size and
 * coerce types.
 */
const { getNamedStore } = require('./_blobs');
const crypto = require('crypto');

const MAX_FIELD = 500;     // chars per field
const MAX_BODY = 4096;     // chars per request
const trim = (v) => (typeof v === 'string' ? v.slice(0, MAX_FIELD) : v);

exports.handler = async (event) => {
  // Respond fast to OPTIONS preflights even though we serve same-origin only
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const raw = (event.body || '').slice(0, MAX_BODY);
    let data;
    try { data = JSON.parse(raw); } catch { return ok(); }
    if (!data || typeof data !== 'object') return ok();

    const ip = (event.headers['x-nf-client-connection-ip']
      || event.headers['x-forwarded-for']
      || '').split(',')[0].trim();
    const ua = trim(event.headers['user-agent'] || '');
    const country = event.headers['x-country'] || event.headers['x-nf-geo']
      ? (parseGeo(event.headers['x-nf-geo']) || trim(event.headers['x-country'] || ''))
      : '';

    // Salted daily hash so the same visitor across pages dedupes within a day
    // but cannot be tracked across days (privacy-preserving).
    const today = new Date().toISOString().slice(0, 10);
    const salt = process.env.ANALYTICS_SALT || 'staticswift-default-salt';
    const visitorHash = crypto
      .createHash('sha256')
      .update(today + '|' + salt + '|' + ip + '|' + ua)
      .digest('hex')
      .slice(0, 16);

    const evt = {
      t: Date.now(),
      type: trim(String(data.type || 'pageview')),
      path: trim(String(data.path || '/')),
      ref: trim(String(data.ref || '')),
      sid: trim(String(data.sid || visitorHash)),
      vid: visitorHash,
      lang: trim(String(data.lang || '')),
      vp: trim(String(data.vp || '')),
      dur: typeof data.dur === 'number' ? Math.min(Math.max(0, Math.round(data.dur)), 3600_000) : 0,
      country,
      ua: trim(ua),
      evt: trim(String(data.evt || '')),
    };

    const store = getNamedStore('analytics');
    if (!store) return ok(); // degrade silently if Blobs unavailable
    const key = today;
    const existing = await store.get(key, { type: 'json' });
    const arr = Array.isArray(existing) ? existing : [];
    arr.push(evt);
    // Soft cap per-day to keep blob size reasonable
    if (arr.length > 50_000) arr.splice(0, arr.length - 50_000);
    await store.setJSON(key, arr);

    return ok();
  } catch (err) {
    console.error('[track-event] error:', err.message);
    return ok(); // never break the page
  }
};

function ok() {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}
function parseGeo(raw) {
  if (!raw) return '';
  try {
    const j = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return j?.country?.name || j?.country?.code || '';
  } catch { return ''; }
}
