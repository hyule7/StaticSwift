/*
 * _blobs.js — shared helper that returns a Netlify Blobs store with
 * credentials passed explicitly. Works in:
 *   - Netlify runtime (auto-injected NETLIFY_BLOBS_CONTEXT)
 *   - Manual deploys where NETLIFY_SITE_ID + NETLIFY_BLOBS_TOKEN are set
 *   - Local netlify dev (auto-injected)
 *
 * If neither is available, returns null and the caller must degrade gracefully.
 */
const { getStore } = require('@netlify/blobs');

function getCreds() {
  // Path 1 — Netlify auto-injects a base64 context string
  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    try {
      const ctx = JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString('utf-8'));
      if (ctx.siteID && ctx.token) return { siteID: ctx.siteID, token: ctx.token };
    } catch (e) { /* fall through */ }
  }
  // Path 2 — explicit env vars (recommended in Netlify dashboard)
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN;
  if (siteID && token) return { siteID, token };
  return null;
}

function getNamedStore(name) {
  const creds = getCreds();
  if (!creds) {
    // Try the implicit form anyway — works in some runtime contexts
    try { return getStore({ name }); } catch (e) { return null; }
  }
  return getStore({ name, ...creds });
}

function blobsAvailable() {
  return !!getCreds();
}

function blobsDiagnosis() {
  return {
    blobsContextPresent: !!process.env.NETLIFY_BLOBS_CONTEXT,
    siteIdPresent: !!(process.env.NETLIFY_SITE_ID || process.env.SITE_ID),
    blobsTokenPresent: !!(process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN),
    credsResolved: !!getCreds(),
  };
}

module.exports = { getNamedStore, blobsAvailable, blobsDiagnosis };
