/**
 * ping-sitemaps.js
 * Notifies Google and Bing that sitemaps have been updated.
 * Called automatically on deploy via Netlify deploy hook,
 * and can be called manually from the admin.
 *
 * Also submits priority pages to Google Indexing API.
 */
const https = require('https');
const { google } = require('googleapis');

const SITEMAPS = [
  'https://staticswift.co.uk/sitemap.xml',
  'https://staticswift.co.uk/sitemap-index.xml',
  'https://staticswift.co.uk/sitemap-pages.xml',
];

// Priority pages to submit to Indexing API immediately (homepage + key niche+city combos)
const PRIORITY_URLS = [
  'https://staticswift.co.uk/',
  'https://staticswift.co.uk/example.html',
  'https://staticswift.co.uk/barber-website-design-manchester/',
  'https://staticswift.co.uk/plumber-website-design-manchester/',
  'https://staticswift.co.uk/barber-website-design-london/',
  'https://staticswift.co.uk/barber-website-design-birmingham/',
  'https://staticswift.co.uk/photographer-website-design-london/',
  'https://staticswift.co.uk/barber-website-design/',
  'https://staticswift.co.uk/plumber-website-design/',
  'https://staticswift.co.uk/website-design-manchester/',
  'https://staticswift.co.uk/website-design-london/',
  'https://staticswift.co.uk/website-design-birmingham/',
  'https://staticswift.co.uk/staticswift-vs-wix/',
  'https://staticswift.co.uk/staticswift-vs-squarespace/',
];

function pingUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, res => resolve({ url, status: res.statusCode }));
    req.on('error', err => resolve({ url, error: err.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ url, error: 'timeout' }); });
  });
}

async function submitToIndexingAPI(urls) {
  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_KEY) {
    return { skipped: true, reason: 'GOOGLE_SA_EMAIL or GOOGLE_SA_KEY not set' };
  }
  try {
    const key = Buffer.from(process.env.GOOGLE_SA_KEY, 'base64').toString('utf-8');
    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: process.env.GOOGLE_SA_EMAIL, private_key: key },
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const client = await authClient.getClient();
    const results = [];
    for (const url of urls) {
      try {
        const res = await client.request({
          url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
          method: 'POST',
          data: { url, type: 'URL_UPDATED' },
        });
        results.push({ url, status: res.status });
        await new Promise(r => setTimeout(r, 200)); // rate limit
      } catch (err) {
        results.push({ url, error: err.message });
      }
    }
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

exports.handler = async (event) => {
  // Allow Netlify deploy hook (no auth) or admin call (with auth)
  const auth = event.headers['x-admin-password'];
  const isDeployHook = event.headers['x-netlify-event'] === 'deploy_succeeded';
  const validPw2 = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (!isDeployHook && auth !== validPw2) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    // Ping Google + Bing
    const googlePings = SITEMAPS.map(s =>
      pingUrl(`https://www.google.com/ping?sitemap=${encodeURIComponent(s)}`)
    );
    const bingPings = SITEMAPS.map(s =>
      pingUrl(`https://www.bing.com/ping?sitemap=${encodeURIComponent(s)}`)
    );

    const [googleResults, bingResults, indexingResults] = await Promise.all([
      Promise.all(googlePings),
      Promise.all(bingPings),
      submitToIndexingAPI(PRIORITY_URLS),
    ]);

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      google: googleResults,
      bing: bingResults,
      indexingApi: indexingResults,
      sitemapsPinged: SITEMAPS.length,
      priorityUrlsSubmitted: PRIORITY_URLS.length,
    };

    console.log('Sitemap ping complete:', JSON.stringify(result, null, 2));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('ping-sitemaps error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
