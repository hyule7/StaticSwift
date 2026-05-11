/**
 * analytics-data.js
 * Fetches live GA4 data via Google Analytics Data API
 * Called by admin dashboard every 60 seconds
 * 
 * Required env vars:
 *   GA4_PROPERTY_ID     e.g. 123456789 (from GA4 Admin > Property Settings)
 *   GOOGLE_SA_EMAIL     service account email
 *   GOOGLE_SA_KEY       service account private key (base64 encoded)
 */
const { google } = require('googleapis');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  if (auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return { statusCode: 200, body: JSON.stringify({ unavailable: true, reason: 'GA4_PROPERTY_ID not set' }) };
  }

  try {
    let authClient;
    if (process.env.GOOGLE_SA_KEY) {
      const key = Buffer.from(process.env.GOOGLE_SA_KEY, 'base64').toString('utf-8');
      authClient = new google.auth.GoogleAuth({
        credentials: { client_email: process.env.GOOGLE_SA_EMAIL, private_key: key },
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    } else {
      authClient = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    }

    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });

    const [overview, topPages, sources] = await Promise.all([
      // 30-day overview
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        },
      }),
      // Top pages
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        },
      }),
      // Traffic sources
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
      }),
    ]);

    const row = overview.data.rows?.[0]?.metricValues || [];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overview: {
          sessions: parseInt(row[0]?.value || 0),
          users: parseInt(row[1]?.value || 0),
          pageviews: parseInt(row[2]?.value || 0),
          avgDuration: Math.round(parseFloat(row[3]?.value || 0)),
          bounceRate: parseFloat(row[4]?.value || 0).toFixed(1),
        },
        topPages: (topPages.data.rows || []).map(r => ({
          path: r.dimensionValues[0].value,
          views: parseInt(r.metricValues[0].value),
          users: parseInt(r.metricValues[1].value),
        })),
        sources: (sources.data.rows || []).map(r => ({
          channel: r.dimensionValues[0].value,
          sessions: parseInt(r.metricValues[0].value),
          users: parseInt(r.metricValues[1].value),
        })),
      }),
    };
  } catch (err) {
    console.error('analytics-data error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ unavailable: true, reason: err.message }) };
  }
};
