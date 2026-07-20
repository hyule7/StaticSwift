/*
 * _email-template.js — one consistent, on-brand look for every email.
 *
 * Two jobs:
 *  1. signatureHtml/signatureText — a clean, trustworthy signature used on ALL
 *     mail (cold + client). Text-based (no images) so it never trips spam
 *     filters, but it carries the real proof: 5.0 on Google, £499 once, and the
 *     60-day lead guarantee. That is what makes a stranger trust a cold email,
 *     not hype.
 *  2. shell() — a premium Field Guide HTML wrapper for CLIENT / transactional
 *     mail (preview ready, invoice, portal, confirmations). Cold outreach stays
 *     light + personal (heavy templates look like spam and hurt deliverability).
 *
 * Field Guide palette: cream #F2EFE7, ink #0E0B07, red #9C2615.
 */
let F = { build: 499, monthly: 49, previewHours: 24, buildDays: 14, guaranteeDays: 60, wa: '07502 731 799', waLink: '447502731799', email: 'hello@staticswift.co.uk', rating: '5.0' };
try {
  const facts = require('../../data/facts.json');
  F.build = facts.pricing?.starter?.build ?? F.build;
  F.previewHours = facts.delivery?.preview_hours ?? F.previewHours;
  F.buildDays = facts.delivery?.build_days ?? F.buildDays;
  F.guaranteeDays = facts.guarantee?.days ?? F.guaranteeDays;
  F.wa = facts.contact?.whatsapp_display ?? F.wa;
  F.waLink = (facts.contact?.whatsapp || '').replace(/[^\d]/g, '') || F.waLink;
  F.email = facts.contact?.email ?? F.email;
} catch (_) {}

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain-text signature (for the text/plain part of every email).
function signatureText() {
  return [
    'Harry Yule',
    'StaticSwift, hand-coded websites for UK trades, Manchester',
    'WhatsApp ' + F.wa + '  |  ' + F.email,
    '5.0 on Google  |  ' + F.build + ' pounds once  |  ' + F.guaranteeDays + '-day lead guarantee or your money back',
  ].join('\n');
}

// HTML signature: clean, small, trustworthy. Red star rating, ink text, a hair
// rule on top. No images, so it renders everywhere and stays deliverable.
function signatureHtml() {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:22px;border-top:1px solid #e0dccf;padding-top:14px;width:100%">' +
    '<tr><td style="font-family:Georgia,\'Times New Roman\',serif;font-size:16px;font-weight:700;color:#0E0B07;padding-bottom:2px">Harry Yule</td></tr>' +
    '<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b6459;line-height:1.5">StaticSwift, hand-coded websites for UK trades, Manchester</td></tr>' +
    '<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b6459;padding-top:2px">' +
    '<a href="https://wa.me/' + F.waLink + '" style="color:#9C2615;text-decoration:none">WhatsApp ' + esc(F.wa) + '</a>' +
    ' &nbsp;·&nbsp; <a href="mailto:' + esc(F.email) + '" style="color:#9C2615;text-decoration:none">' + esc(F.email) + '</a></td></tr>' +
    '<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#0E0B07;padding-top:8px">' +
    '<span style="color:#D4A24A;letter-spacing:1px">&#9733;&#9733;&#9733;&#9733;&#9733;</span> ' +
    '<b>5.0 on Google</b> &nbsp;·&nbsp; &pound;' + F.build + ' once &nbsp;·&nbsp; ' + F.guaranteeDays + '-day lead guarantee or your money back</td></tr>' +
    '</table>'
  );
}

// Premium branded wrapper for CLIENT / transactional emails only.
function shell(innerHtml, opts) {
  const o = opts || {};
  const pre = o.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(o.preheader) + '</div>' : '';
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#EBE7DD">' + pre +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EBE7DD;padding:28px 12px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F2EFE7;border:1px solid #e0dccf;border-radius:14px;overflow:hidden">' +
    '<tr><td style="padding:22px 30px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#0E0B07;letter-spacing:-.3px">StaticSwift</td></tr>' +
    '<tr><td style="padding:16px 30px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#29221C">' +
    innerHtml + signatureHtml() +
    '</td></tr>' +
    '</table>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8A7B62;margin-top:16px">StaticSwift &middot; Manchester, England &middot; Hand-coded websites for UK trades</div>' +
    '</td></tr></table></body></html>'
  );
}

module.exports = { signatureText, signatureHtml, shell, F };
