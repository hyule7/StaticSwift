/*
 * get-outreach-status.js
 * ---------------------------------------------------------------
 * Single endpoint that surfaces the state of the autonomous outreach
 * pipeline for /admin/outreach.html. Aggregates:
 *
 *   db.scanQueue       — URLs queued for cron-scan
 *   db.cronProspects   — analyzed prospects (added by cron-scan)
 *   db.outreachDrafts  — emails queued by daily-followup for human review
 *   db.lastCronScan    — timestamp set by cron-scan after each run
 *   db.lastDailyFollowup — timestamp set by daily-followup
 *
 * Returns a single JSON payload the admin page can render without
 * making 4 round-trips. Read-only; never mutates.
 */

const { readDB } = require('./_db');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const db = await readDB();
    const prospects = Array.isArray(db.cronProspects) ? db.cronProspects : [];
    const drafts    = Array.isArray(db.outreachDrafts) ? db.outreachDrafts : [];
    const scanQueue = Array.isArray(db.scanQueue) ? db.scanQueue : [];

    // Aggregate prospect counts by status
    const statusCounts = prospects.reduce((acc, p) => {
      const s = p.status || 'new';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    // Score distribution buckets — quick visual on lead quality
    const scoreBuckets = { '0-39': 0, '40-69': 0, '70-100': 0 };
    prospects.forEach(p => {
      const s = Number(p.score || 0);
      if (s < 40)      scoreBuckets['0-39']++;
      else if (s < 70) scoreBuckets['40-69']++;
      else             scoreBuckets['70-100']++;
    });

    // Prospects discovered in the last 24h
    const since = Date.now() - 86400000;
    const prospectsLast24h = prospects.filter(p => {
      const t = new Date(p.discoveredAt || p.scannedAt || p.createdAt || 0).getTime();
      return t > since;
    }).length;

    // Recent prospects — last 25, newest first (cron-scan unshifts so already sorted)
    const recentProspects = prospects.slice(0, 25).map(p => ({
      host: p.host,
      url: p.url,
      score: p.score,
      status: p.status || 'new',
      discoveredAt: p.discoveredAt || p.scannedAt || p.createdAt,
      email: p.email || null,
      phone: p.phone || null,
      sicCode: p.sicCode || null,            // Companies House SIC, when present
      companyNumber: p.companyNumber || null,
      source: p.source || 'scan',            // 'scan' | 'companies-house' | 'manual'
    }));

    // Drafts queued for review — newest first
    const draftsSorted = drafts.slice().sort((a,b) => new Date(b.queuedAt||0) - new Date(a.queuedAt||0));
    const draftsCounts = drafts.reduce((acc,d) => {
      const s = d.status || 'queued';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const recentDrafts = draftsSorted.slice(0, 15).map(d => ({
      id: d.id,
      to: d.to,
      subject: d.subject,
      tag: d.tag,               // 'cold-1' | 'followup-1' | 'followup-2'
      status: d.status || 'queued',
      queuedAt: d.queuedAt,
      prospectHost: d.prospectHost || null,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        ok: true,
        // Health
        scanQueueDepth:   scanQueue.length,
        lastCronScan:     db.lastCronScan || null,
        lastDailyFollowup:db.lastDailyFollowup || null,
        // Prospect KPIs
        totalProspects:   prospects.length,
        prospectsLast24h,
        statusCounts,
        scoreBuckets,
        // Outreach KPIs
        totalDrafts:      drafts.length,
        draftsCounts,
        // Recent rows
        recentProspects,
        recentDrafts,
      }),
    };
  } catch (err) {
    console.error('[get-outreach-status] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
