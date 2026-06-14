/*
 * creatives-list.js — lists ad creatives the Creative Production team has
 * produced into the Blobs 'creatives' store (on top of the committed ones in
 * admin/creatives/manifest.json). Each entry: {id, kind, hook, url, by}.
 * Agents add entries via creatives-add (queued + approved). Admin-only GET.
 */
const { getNamedStore } = require('./_blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const store = getNamedStore('creatives');
  let creatives = [];
  if (store) {
    try { creatives = (await store.get('index', { type: 'json' })) || []; } catch (_) {}
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, creatives: creatives.slice(0, 60) }),
  };
};
