/*
 * analytics-debug.js — Diagnose self-hosted analytics in one click.
 * Tests:
 *   1. Can we instantiate the Netlify Blobs store?
 *   2. Can we write a test event?
 *   3. Can we read it back?
 *   4. How many real events exist in the last 7 days?
 *
 * Returns a verbose human-readable report so the admin can see what's
 * wrong without trial-and-error.
 */
const { getNamedStore, blobsDiagnosis } = require('./_blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const diag = blobsDiagnosis();
  const report = {
    timestamp: new Date().toISOString(),
    blobsAvailable: false,
    blobsContextPresent: diag.blobsContextPresent,
    siteIDPresent: diag.siteIdPresent,
    blobsTokenPresent: diag.blobsTokenPresent,
    credsResolved: diag.credsResolved,
    canWrite: false,
    canRead: false,
    eventCounts: {},
    samples: [],
    errors: [],
  };

  try {
    const store = getNamedStore('analytics');
    if (!store) throw new Error('Netlify Blobs credentials not available — set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN env vars in your Netlify site settings.');
    report.blobsAvailable = true;

    // Test write
    try {
      const testKey = '__debug_' + Date.now();
      await store.setJSON(testKey, [{ test: true, t: Date.now() }]);
      report.canWrite = true;
      // Read it back
      const back = await store.get(testKey, { type: 'json' });
      report.canRead = Array.isArray(back) && back[0]?.test === true;
      // Clean up
      try { await store.delete(testKey); } catch {}
    } catch (err) {
      report.errors.push('Write test failed: ' + err.message);
    }

    // Count real events in last 7 days
    const today = new Date();
    const dayKeys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    for (const k of dayKeys) {
      try {
        const events = await store.get(k, { type: 'json' });
        if (Array.isArray(events)) {
          report.eventCounts[k] = events.length;
          if (events.length && report.samples.length < 5) {
            report.samples.push(...events.slice(-3));
          }
        } else {
          report.eventCounts[k] = 0;
        }
      } catch (err) {
        report.eventCounts[k] = 'ERR: ' + err.message;
      }
    }
  } catch (err) {
    report.errors.push('Blobs init failed: ' + err.message);
  }

  const totalEvents = Object.values(report.eventCounts).filter(n => typeof n === 'number').reduce((a, b) => a + b, 0);
  report.totalEventsLast7Days = totalEvents;
  report.verdict = !report.blobsAvailable ? '✗ Netlify Blobs not available — function may not be running in Netlify context'
    : !report.canWrite ? '✗ Cannot write to blob storage — check Netlify Blobs is enabled'
    : !report.canRead ? '⚠ Can write but not read — data may be lost'
    : totalEvents === 0 ? '⚠ No analytics events yet — tracker may not be installed or no visits yet. Open homepage to test.'
    : '✓ Analytics working · ' + totalEvents + ' events in last 7 days';

  return { statusCode: 200, body: JSON.stringify(report, null, 2) };
};
