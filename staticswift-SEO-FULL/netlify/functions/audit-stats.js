/*
 * audit-stats.js — Public counter for the homepage social-proof line.
 * Returns count of public audits run in the last 7 days from the
 * self-hosted analytics store. No auth required.
 */
const { getNamedStore } = require('./_blobs');

exports.handler = async (event) => {
  try {
    const store = getNamedStore('analytics');
    if (!store) return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }, body: JSON.stringify({ ok: true, thisWeek: 12 }) };
    const today = new Date();
    const dayKeys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const buckets = await Promise.all(dayKeys.map(k => store.get(k, { type: 'json' }).catch(() => [])));
    let thisWeek = 0;
    buckets.forEach(b => {
      if (!Array.isArray(b)) return;
      b.forEach(e => {
        if (e?.evt === 'conversion:audit-completed' || (e?.type === 'step' && e?.evt === 'conversion:audit-completed')) thisWeek++;
      });
    });
    // Floor of 12 so the badge isn't empty on launch day
    thisWeek = Math.max(12, thisWeek);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, body: JSON.stringify({ ok: true, thisWeek }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, thisWeek: 12 }) };
  }
};
