/**
 * purge-analytics-pii.js — one-shot GDPR cleanup of stored analytics.
 *
 * The old GET form fallback leaked names, emails and phone numbers into
 * page paths like /?name=...&delivery_email=... and those paths were stored
 * verbatim in the analytics blobs. This walks every day-bucket in the
 * "analytics" store and rewrites each event: query strings and fragments
 * are stripped from path and ref. Idempotent; safe to run repeatedly.
 *
 * Run (after deploy):
 *   curl -X POST https://staticswift.co.uk/.netlify/functions/purge-analytics-pii \
 *        -H "x-admin-password: $ADMIN_PASSWORD"
 */
const { getNamedStore } = require('./_blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const store = getNamedStore('analytics');
  if (!store) return { statusCode: 500, body: JSON.stringify({ error: 'Blobs unavailable' }) };

  const strip = (s) => typeof s === 'string' ? s.split(/[?#]/)[0] : s;
  let buckets = 0, eventsTouched = 0, eventsTotal = 0;

  try {
    const { blobs } = await store.list();
    for (const { key } of blobs) {
      const arr = await store.get(key, { type: 'json' });
      if (!Array.isArray(arr)) continue;
      let dirty = false;
      for (const evt of arr) {
        if (!evt || typeof evt !== 'object') continue;
        eventsTotal++;
        const p = strip(evt.path), r = strip(evt.ref);
        if (p !== evt.path || r !== evt.ref) {
          evt.path = p; evt.ref = r;
          eventsTouched++; dirty = true;
        }
      }
      if (dirty) { await store.setJSON(key, arr); buckets++; }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, bucketsRewritten: buckets, eventsScrubbed: eventsTouched, eventsScanned: eventsTotal }),
    };
  } catch (err) {
    console.error('[purge-analytics-pii]', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
