/*
 * portal-poll.js
 * ---------------------------------------------------------------
 * Lightweight read-only endpoint hit every ~25 seconds by an open
 * portal page. Returns any new messages since `since`, the current
 * stage, and any meaningful flags (like whether a preview just landed).
 *
 * Public — no auth — but rate-limited per UUID by JSONBin's read cache.
 * Returns 404 for unknown UUIDs so brute-force discovery is loud.
 *
 * Response shape:
 *   { ok: true, stage, totalCount, newMessages: [...] }
 */

const { getClients } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const qs = event.queryStringParameters || {};
  const uuid = qs.uuid || (event.body && safeParse(event.body).portalUUID);
  const since = parseInt(qs.since || (event.body && safeParse(event.body).since) || '0', 10) || 0;

  if (!uuid) {
    return json(400, { ok: false, error: 'uuid required' });
  }

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === uuid);
    if (!client) return json(404, { ok: false, error: 'not found' });

    const all = Array.isArray(client.portalMessages) ? client.portalMessages : [];
    const newOnes = all.slice(since).map(m => ({
      from: m.from,
      type: m.type || null,
      notes: m.notes || m.text || '',
      sentAt: m.sentAt,
    }));

    return json(200, {
      ok: true,
      stage: client.stage || 'new-lead',
      totalCount: all.length,
      newMessages: newOnes,
      // Surface a couple of useful flags so the client can react.
      previewUrl: client.previewUrl || null,
      hasFinal: !!client.finalUrl,
      // Don't leak the full record — these few fields are enough for the UI.
    });
  } catch (err) {
    console.error('[portal-poll] error:', err.message);
    return json(500, { ok: false, error: err.message });
  }
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      // Allow same-origin polling; portals run on the same domain.
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(obj),
  };
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
