const { getStore } = require('@netlify/blobs');

/**
 * Get a Netlify Blobs store, passing credentials explicitly.
 * NETLIFY_SITE_ID and NETLIFY_BLOBS_CONTEXT are auto-injected by Netlify at runtime.
 */
function getClientStore() {
  return getStore({
    name: 'clients',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN,
  });
}

function getMetaStore() {
  return getStore({
    name: 'meta',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN,
  });
}

module.exports = { getClientStore, getMetaStore };

function getNurtureStore() {
  return getStore({
    name: 'nurture-list',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN,
  });
}

function getSupportStore() {
  return getStore({
    name: 'support-inbox',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_CONTEXT
      ? JSON.parse(Buffer.from(process.env.NETLIFY_BLOBS_CONTEXT, 'base64').toString()).token
      : process.env.NETLIFY_AUTH_TOKEN,
  });
}

module.exports = { getClientStore, getMetaStore, getNurtureStore, getSupportStore };
