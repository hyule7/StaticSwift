/*
 * _tracking.js — email open-tracking helpers.
 *
 * Adds a 1x1 pixel to outbound mail so the funnel can show opens. Note: open
 * tracking is inherently noisy (Gmail proxies images, Apple Mail Privacy
 * Protection pre-fetches them, plain-text-only readers never load them), so
 * treat opens as a soft signal, not gospel. A tracking pixel is also a mild
 * deliverability cost, which is why client mail is the safer place for it.
 */
const SITE = () => (process.env.URL || 'https://staticswift.co.uk').replace(/\/$/, '');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Pixel URL in the format track-open.js already understands (?p=id&t=template),
// which logs the open into db.prospectOpens keyed by p.
function pixelUrl(pid, template) {
  return `${SITE()}/.netlify/functions/track-open?p=${encodeURIComponent(pid || '')}&t=${encodeURIComponent(template || 'outreach')}`;
}

// Minimal HTML mirror of a plain-text body plus the invisible pixel. Kept
// deliberately plain (no images, no heavy markup) to limit the spam signal.
function htmlFromText(text, pid, template) {
  const body = esc(text).replace(/\r?\n/g, '<br>');
  const px = pid ? `<img src="${pixelUrl(pid, template)}" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden">` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>${px}`;
}

module.exports = { pixelUrl, htmlFromText };
