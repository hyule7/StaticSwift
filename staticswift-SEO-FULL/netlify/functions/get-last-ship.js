/*
 * get-last-ship.js
 * ---------------------------------------------------------------
 * Powers the homepage "Last delivered" live ticker beneath the running head.
 * Reads the most recent client.liveAt (or paidAt as a fallback) from the DB,
 * returns { ago, business, town } in a friendly format.
 *
 * Cached aggressively at the CDN edge (60s) since the value rarely changes
 * — every visitor doesn't need a fresh DB hit. Public endpoint, no auth.
 */

const { readDB } = require('./_db');

function fmtAgo(iso){
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0)              return 'just now';
  const m = Math.round(diff / 60000);
  if (m < 1)                 return 'just now';
  if (m < 60)                return m + ' minutes ago';
  const h = Math.round(m / 60);
  if (h < 24)                return h === 1 ? '1 hour ago' : h + ' hours ago';
  const d = Math.round(h / 24);
  if (d < 7)                 return d === 1 ? '1 day ago' : d + ' days ago';
  const w = Math.round(d / 7);
  if (w < 5)                 return w === 1 ? '1 week ago' : w + ' weeks ago';
  return new Date(iso).toLocaleDateString('en-GB',{ month:'short', day:'numeric' });
}

exports.handler = async () => {
  try {
    const db = await readDB();
    const clients = Array.isArray(db.clients) ? db.clients : [];

    // Most recent "real" event — preferring liveAt, falling back to paidAt
    let latest = null;
    for (const c of clients){
      const candidate = c.liveAt || c.paidAt;
      if (!candidate) continue;
      if (!latest || new Date(candidate) > new Date(latest.when)){
        latest = {
          when: candidate,
          business: c.business_name || c.name || '',
          town: c.location || '',
        };
      }
    }

    if (!latest){
      // Graceful empty state — let the homepage hide the band or keep the fallback.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
        body: JSON.stringify({ ago: null, business: null, town: null }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
      body: JSON.stringify({
        ago:      fmtAgo(latest.when),
        business: latest.business || null,
        town:     latest.town     || null,
      }),
    };
  } catch (err) {
    console.error('[get-last-ship] error:', err.message);
    // Don't fail the homepage — return null fields, JS will hide the band gracefully.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ago: null, business: null, town: null }),
    };
  }
};
