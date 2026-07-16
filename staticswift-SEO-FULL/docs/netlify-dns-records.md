# Netlify DNS records to fix email (staticswift.co.uk)

Your DNS is hosted at **Netlify** (Netlify → Domains → staticswift.co.uk → DNS
records / "Set up Netlify DNS"). The mail records live only in the FastHosts
panel, which is NOT authoritative, so nothing was published. mail-tester scored
5/10: no MX, SPF fail, no DKIM, no DMARC. Add the records below in Netlify.

Mail is FastHosts **LiveMail** (id 1404249). Copy the DKIM targets EXACTLY from
your FastHosts DNS panel in case the id differs.

In Netlify: the "Name" field is only the subdomain label. For the apex (root)
leave Name BLANK. Do not type the full domain, do not use `@`.

## 1. MX (was missing - this also broke inbound mail / tickets)
- Type: MX
- Name: (blank = apex)
- Value / server: `mailserver.livemail.co.uk`
- Priority: `10`
- TTL: 3600

## 2. SPF - exactly ONE TXT on the apex
- Type: TXT
- Name: (blank = apex)
- Value: `v=spf1 mx a include:_spf.livemail.co.uk ~all`
- TTL: 3600

Delete any OTHER `v=spf1...` TXT record (e.g. an `_spf.fasthosts.co.uk` one).
Two SPF records is a permerror = fail. Only this one.

## 3. DKIM - four CNAME records (copy targets exactly from FastHosts)
| Name | Value (points to) |
|------|-------------------|
| `livemail1._domainkey` | `livemail1._domainkey.1404249.dkim.livemail.co.uk` |
| `livemail2._domainkey` | `livemail2._domainkey.1404249.dkim.livemail.co.uk` |
| `livemail3._domainkey` | `livemail3._domainkey.1404249.dkim.livemail.co.uk` |
| `livemail4._domainkey` | `livemail4._domainkey.1404249.dkim.livemail.co.uk` |

Type: CNAME for each. TTL 3600.

## 4. DMARC - one TXT
- Type: TXT
- Name: `_dmarc`
- Value: `v=DMARC1; p=none; rua=mailto:hello@staticswift.co.uk`
- TTL: 3600

Keep `p=none` for ~2 weeks (monitor), then change to `p=quarantine`.

## 5. (optional) Autodiscover, for mail-client autoconfig
- Type: CNAME, Name: `autodiscover`, Value: `autodiscover.exchange2019.livemail.co.uk`

## After adding
1. Wait for propagation (Netlify is usually minutes, allow up to a few hours).
2. Re-send to a fresh https://www.mail-tester.com address -> aim for 9-10/10.
3. All four (MX, SPF, DKIM, DMARC) should now pass.
4. Send a test to your Gmail: should land in inbox, not junk.

## Do NOT
- Do not switch nameservers to FastHosts (ns*.livedns.co.uk). Your website A/CNAME
  records live in Netlify; switching would take the site offline. Keep DNS in
  Netlify and just add the mail records above.

## Netlify env vars (separate from DNS, for the app to send/read mail)
- `SMTP_HOST` = `smtp.livemail.co.uk` (port 587)
- `IMAP_HOST` = `mail.livemail.co.uk` (port 993, TLS)  <- fixes tickets pulling in
- `SMTP_USER` = `hello@staticswift.co.uk`, `SMTP_PASS` = mailbox password
- optional: `SUPPORT_SMTP_USER` / `SUPPORT_SMTP_PASS` for support@
