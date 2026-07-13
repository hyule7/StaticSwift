# Deliverability setup — the single biggest lever on conversion

If cold emails land in spam, none of the volume converts. This is the playbook
to get StaticSwift into inboxes. It is mostly DNS and discipline, not code.
Do these in order. None of it requires touching the codebase.

## 0. The one rule
Cold outreach volume only works AFTER authentication is in place AND the
sending domain is warmed. Sending hundreds/day from a cold domain gets you
filtered and then blacklisted, which poisons every future email including
client mail. Slow is fast here.

## 1. Authenticate the domain (SPF, DKIM, DMARC)
These three DNS records tell Gmail/Outlook the mail is really from you. Without
all three, modern providers junk or reject cold mail outright.

Check current state first (paste the domain into):
- https://www.mail-tester.com  (send it a test email, aim for 10/10)
- https://mxtoolbox.com/SuperTool.aspx  (check SPF, DKIM, DMARC records)

IMPORTANT: staticswift.co.uk is on FastHosts **LiveMail** (MX
`mailserver.livemail.co.uk`), NOT generic fasthosts.co.uk mail. Use the livemail
values. In the FastHosts DNS panel the root-domain host is LEFT BLANK (not `@`),
and a subdomain host is just the label (e.g. `_dmarc`).

**SPF** (exactly ONE TXT record on the root domain, host left blank):
```
v=spf1 mx a include:_spf.livemail.co.uk ~all
```
CRITICAL: only ONE SPF record allowed. A second one (e.g. the generic
`include:_spf.fasthosts.co.uk`) makes SPF fail validation (permerror) and mail
lands in junk. If two exist, delete the wrong one, keep the livemail one above.

**DKIM** — already enabled here via CNAMEs
`livemail1..4._domainkey -> livemailN._domainkey.<id>.dkim.livemail.co.uk`
(mailbox shows DKIM: Enabled). Nothing to add.

Server settings for Netlify env vars: SMTP `smtp.livemail.co.uk` (port 587),
IMAP `mail.livemail.co.uk` (port 993, TLS). The IMAP host DIFFERS from SMTP, so
set IMAP_HOST explicitly or tickets/Sent-copies connect to the wrong server.

**DMARC** (one TXT record). Start in monitor mode, then tighten:
```
Type: TXT   Host: _dmarc   Value: v=DMARC1; p=none; rua=mailto:hello@staticswift.co.uk; fo=1
```
After two weeks of clean reports, move `p=none` to `p=quarantine`.

## 2. Use a SEPARATE sending domain for cold outreach
Never send cold volume from `staticswift.co.uk` — one spam-trap hit can blacklist
it and break your client mail, the portal, and the message widget.

- Buy e.g. `getstaticswift.co.uk` or `trystaticswift.co.uk`.
- Set it to 301-redirect to `staticswift.co.uk` for web traffic.
- Authenticate it (step 1) and send cold outreach from `harry@getstaticswift.co.uk`.
- In Netlify env: point `SMTP_USER` / `SMTP_HOST` / `IMAP_HOST` at the new
  mailbox when you switch. Keep `hello@staticswift.co.uk` for warm/client mail.

## 3. Warm the domain (2 to 4 weeks)
A brand-new domain sending 200 emails on day one looks exactly like spam.
- Week 1: ~20 a day. Week 2: ~40. Week 3: ~80. Then climb gradually.
- Set the limit with the env var (it is currently uncapped):
  `OUTREACH_DAILY_CAP=30` to start, raise weekly.
- A warm-up tool (e.g. Mailwarm, Warmup Inbox, Instantly) accelerates this by
  generating positive engagement. Worth it before any real push.

## 4. Protect the reputation you build
- **One-click unsubscribe** is already on every send (List-Unsubscribe header)
  and the suppression list is honoured. Never bypass it.
- **Per-lead cadence** is already enforced (day 0, +4, +11, +25, then stop) so
  nobody gets hammered.
- Keep bounce rate low: the enrichment only emails MX-verified addresses.
- Watch the DMARC `rua` reports and Google Postmaster Tools
  (https://postmaster.google.com) for spam-rate spikes.

## 5. When volume is safe
Once authenticated + warmed on a dedicated domain, raise `OUTREACH_DAILY_CAP`
in steps and watch Postmaster Tools. For genuine hundreds/day, use a dedicated
sending service (Instantly, Smartlead, or Amazon SES with multiple warmed
domains) rather than a single Fasthosts mailbox.

## Quick checklist
- [ ] SPF, DKIM, DMARC all green on mail-tester (10/10)
- [ ] Separate sending domain bought + authenticated
- [ ] Warm-up running, `OUTREACH_DAILY_CAP` set low to start
- [ ] Google Postmaster Tools connected
- [ ] mail-tester score re-checked after the domain switch
