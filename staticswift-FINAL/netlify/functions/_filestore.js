const { getStore } = require('@netlify/blobs');

function getFileStore() {
  // NETLIFY_SITE_ID is auto-injected by Netlify AND can be set manually
  // NETLIFY_AUTH_TOKEN must be set manually in env vars
  const siteID = process.env.NETLIFY_SITE_ID || 'ae44007a-7fca-418f-a768-d88c6c7a95b8';
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!token) {
    throw new Error('NETLIFY_AUTH_TOKEN not set. Add it to Netlify → Project configuration → Environment variables.');
  }

  return getStore({ name: 'client-files', siteID, token });
}

module.exports = { getFileStore };
