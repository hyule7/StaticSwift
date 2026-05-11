/**
 * search-console-data.js
 * Fetches Google Search Console data via API
 * 
 * Required env vars:
 *   GSC_SITE_URL        e.g. https://staticswift.co.uk/
 *   GOOGLE_SA_EMAIL     service account email
 *   GOOGLE_SA_KEY       service account private key (base64 encoded)
 */
const { google } = require('googleapis');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const siteUrl = process.env.GSC_SITE_URL || 'https://staticswift.co.uk/';
  if (!process.env.GOOGLE_SA_EMAIL) {
    return { statusCode: 200, body: JSON.stringify({ unavailable: true, reason: 'GOOGLE_SA_EMAIL not set' }) };
  }

  try {
    const key = Buffer.from(process.env.GOOGLE_SA_KEY, 'base64').toString('utf-8');
    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: process.env.GOOGLE_SA_EMAIL, private_key: key },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];

    const [overview, topQueries, topPages, indexStatus] = await Promise.all([
      // 28-day overview
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: [] },
      }),
      // Top queries
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate, endDate,
          dimensions: ['query'],
          rowLimit: 10,
          dimensionFilterGroups: [],
        },
      }),
      // Top pages
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate, endDate,
          dimensions: ['page'],
          rowLimit: 10,
        },
      }),
      // Sitemap status
      searchconsole.sitemaps.list({ siteUrl }).catch(() => ({ data: { sitemap: [] } })),
    ]);

    const ov = overview.data.rows?.[0] || {};
    const sitemaps = (indexStatus.data.sitemap || []).map(s => ({
      path: s.path,
      submitted: s.contents?.[0]?.submitted || 0,
      indexed: s.contents?.[0]?.indexed || 0,
      lastSubmitted: s.lastSubmitted,
      isPending: s.isPending,
      isProcessing: s.isProcessing,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overview: {
          clicks: Math.round(ov.clicks || 0),
          impressions: Math.round(ov.impressions || 0),
          ctr: parseFloat((ov.ctr || 0) * 100).toFixed(1),
          position: parseFloat(ov.position || 0).toFixed(1),
        },
        topQueries: (topQueries.data.rows || []).map(r => ({
          query: r.keys[0],
          clicks: Math.round(r.clicks),
          impressions: Math.round(r.impressions),
          ctr: parseFloat(r.ctr * 100).toFixed(1),
          position: parseFloat(r.position).toFixed(1),
        })),
        topPages: (topPages.data.rows || []).map(r => ({
          page: r.keys[0].replace('https://staticswift.co.uk', ''),
          clicks: Math.round(r.clicks),
          impressions: Math.round(r.impressions),
        })),
        sitemaps,
      }),
    };
  } catch (err) {
    console.error('search-console-data error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ unavailable: true, reason: err.message }) };
  }
};
