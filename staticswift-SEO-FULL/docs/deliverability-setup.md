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

**SPF** (one TXT record on the root domain). With Fasthosts sending:
```
Type: TXT   Host: @   Value: v=spf1 include:_spf.fasthosts.co.uk ~all
```
(Confirm the exact include with Fasthosts; do NOT have two SPF records, merge
into one.)

**DKIM** — enable in the Fasthosts mail control panel; it gives you a
`selector._domainkey` TXT record to add. Add exactly what they provide.

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
