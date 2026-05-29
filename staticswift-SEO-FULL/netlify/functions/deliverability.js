/*
 * deliverability.js
 * ---------------------------------------------------------------
 * Checks YOUR sending domain's email deliverability setup:
 *   - SPF record (TXT) — authorises sending servers
 *   - DKIM record (TXT at selector._domainkey) — signs messages
 *   - DMARC record (TXT at _dmarc) — alignment + reporting policy
 *   - MX records — mailbox routing
 *
 * Without these, cold outreach lands in spam.
 * Returns a clear pass/fail per signal plus how to fix.
 */
const dns = require('dns').promises;

async function txt(host) {
  try { return await dns.resolveTxt(host); } catch { return null; }
}
async function mx(host) {
  try { return await dns.resolveMx(host); } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let domain;
  try { ({ domain } = JSON.parse(event.body || '{}')); } catch {}
  domain = (domain || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase().trim();
  if (!domain) return { statusCode: 400, body: JSON.stringify({ error: 'domain required' }) };

  const [spfRecs, dmarcRecs, mxRecs] = await Promise.all([
    txt(domain),
    txt('_dmarc.' + domain),
    mx(domain),
  ]);

  const spfTxt = spfRecs?.flat().find(t => /^v=spf1/i.test(t)) || null;
  const dmarcTxt = dmarcRecs?.flat().find(t => /^v=DMARC1/i.test(t)) || null;

  // Common DKIM selectors to try (we can't enumerate all, just probe)
  const dkimSelectors = ['default', 'google', 's1', 's2', 'mail', 'k1', 'selector1', 'selector2'];
  const dkimResults = await Promise.all(
    dkimSelectors.map(async sel => {
      const recs = await txt(sel + '._domainkey.' + domain);
      const found = recs?.flat().find(t => /^v=DKIM1/i.test(t));
      return found ? { selector: sel, record: found.slice(0, 200) } : null;
    })
  );
  const dkim = dkimResults.find(x => x);

  // Score
  const checks = {
    spf: {
      pass: !!spfTxt,
      detail: spfTxt || 'Missing — add a TXT record at @: v=spf1 include:_spf.yourprovider.co.uk ~all',
      fix: 'Add a TXT record at the apex domain. For FastHosts: v=spf1 include:_spf.fasthosts.co.uk ~all. For Google Workspace: v=spf1 include:_spf.google.com ~all.',
    },
    dkim: {
      pass: !!dkim,
      detail: dkim ? ('Found at ' + dkim.selector + '._domainkey.' + domain) : 'Not found at common selectors (default, google, s1, s2, mail, k1, selector1, selector2)',
      fix: 'Generate DKIM keys in your mail provider control panel. Add the public key as a TXT record at SELECTOR._domainkey.yourdomain.co.uk',
    },
    dmarc: {
      pass: !!dmarcTxt,
      detail: dmarcTxt || 'Missing — add a TXT at _dmarc.yourdomain.co.uk: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.co.uk',
      fix: 'Add TXT record at _dmarc.yourdomain.co.uk: v=DMARC1; p=none; rua=mailto:dmarc@' + domain + '. Start with p=none, monitor for 2 weeks, then move to p=quarantine.',
    },
    mx: {
      pass: !!(mxRecs && mxRecs.length),
      detail: mxRecs?.length ? (mxRecs.length + ' MX record' + (mxRecs.length > 1 ? 's' : '') + ': ' + mxRecs.map(m => m.exchange).join(', ')) : 'No MX records — domain cannot receive email',
      fix: 'Add MX records pointing to your mail provider (e.g. mail.fasthosts.co.uk, smtp.gmail.com)',
    },
  };

  const passing = Object.values(checks).filter(c => c.pass).length;
  const verdict =
    passing === 4 ? '✓ Fully configured — cold email should land in inbox.' :
    passing === 3 ? '⚠ Mostly configured (' + passing + '/4) — one signal missing, fix below.' :
    passing >= 2 ? '⚠ Partial — ' + passing + '/4 passing. Deliverability will be poor.' :
                   '✗ Critical — ' + passing + '/4 passing. Cold email will hit spam folder. Fix immediately.';

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      domain,
      passing,
      total: 4,
      verdict,
      checks,
    }),
  };
};
