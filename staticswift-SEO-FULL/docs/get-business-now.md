# Get business now — the do-it-this-week playbook

The machine is built. This is how you turn it into paying customers, fastest
first. You do not need to write anything; copy and paste. Everything here uses
your real offer: free working preview in 24 hours, £499 once, optional £49/mo,
60-day lead guarantee, no card until you approve.

## 0. Turn the machine on (30 minutes, unblocks everything)
Your outreach drafts are ready but nothing sends, because SMTP is not set.
- Netlify > your site > Environment variables. Add:
  - `SMTP_USER` = `hello@staticswift.co.uk`
  - `SMTP_PASS` = the mailbox password for that address (from Fasthosts)
  - If needed: `SMTP_HOST` = your Fasthosts outgoing server (often
    `mail.staticswift.co.uk`), `SMTP_PORT` = `587`
  - For reading replies: `SUPPORT_SMTP_PASS`, and `IMAP_HOST` (same mail server)
- Redeploy. Then approve one draft and send yourself a test. If it fails, the
  admin now tells you the exact reason.
- Also confirm SPF, DKIM and DMARC on the domain (see deliverability-setup.md),
  or your mail lands in spam.

## 1. Win 3 clients THIS WEEK, by hand (no tech needed)
You do not have to wait for automation. Do this from your phone today.

Where to find targets in 10 minutes:
- Google "[trade] [your town]" (plumber Manchester, roofer Stockport, etc.).
- Open the map results. Look for businesses with NO website, or an obviously
  bad one (slow, not mobile, a Facebook page only).
- Grab their number.

The message that works (WhatsApp or text, not email):

> Hi [name], I build websites for [trade]s around [town]. I noticed you don't
> have one yet (or it could be sharper on a phone). I'll build you a real
> working preview in 24 hours, free, no card. If you like it it's £499 once,
> and if it doesn't bring you a lead in 60 days you get every penny back. Want
> me to make you one? - Harry, StaticSwift

If they reply yes, ask three things: what you do, the area you cover, and a
number people can call. That is enough to build a preview.

Aim for 10 messages a day. Two or three replies is normal. One in three replies
becomes a preview; a good chunk of previews become sales. That is your first
clients.

## 2. The free preview is your closer - use it aggressively
Nobody pays a stranger £499 up front. They will say yes to a free preview.
Build it (or let the blitz build it), send the link with:

> I already built you one. Here it is, live: [link]. Free to look. If you want
> it live it's £499 once, yours within 14 days, 60-day lead guarantee. Reply or
> WhatsApp me and I'll make it live.

A finished thing they can see beats any pitch about a thing they can't.

## 3. Launch Google Ads (instant customers, costs money)
This is the fastest way to real traffic through your funnel. Small budget,
watch the funnel, scale what converts.

Campaign: Search, UK, target your main towns first.
Daily budget: start at £10-15/day. Bid on exact + phrase match.

Keywords (add [town] where relevant):
- website for tradesmen
- tradesman website design
- plumber website design [town]
- electrician website [town]
- builder website design [town]
- website designer for trades
- small business website [town]

Negative keywords (stop wasted spend):
- free, wordpress, jobs, course, template, wix

Ad copy (Responsive Search Ad - paste several headlines and descriptions):
Headlines:
- Websites for UK Trades
- Free Preview in 24 Hours
- £499 One-Off, You Own It
- Get Found on Google
- No Card, No Risk
- 60-Day Lead Guarantee
- Hand-Coded, Not a Template
- See Yours Before You Pay
Descriptions:
- Hand-coded websites for UK tradespeople. Free working preview in 24 hours,
  no card. £499 once if you keep it.
- Get found when locals Google your trade. First lead in 60 days or a full
  refund, and the site stays yours.
Final URL: https://staticswift.co.uk/order.html
Add sitelinks to /guides/, /website-check/, and a couple of city pages.

Turn on conversion tracking (the site already fires a lead event on the order
form) so Google optimises to actual briefs, not clicks.

## 4. TikTok / Reels (free reach, if you'll film)
You have an ad-creative engine, but nothing beats a face. Film 15-second clips
on your phone:
- Script: "Most [trade]s are invisible on Google. Watch me build one a real
  website in 24 hours, free. If they like it, £499. If not, they keep it."
- Show a before (a bad site) and an after (a preview). Post daily.
- Caption + first comment: the offer + link in bio.

## 5. Reviews - your biggest ranking lever (start after client 1)
The day you deliver a site, send this with your Google review link (get it from
your Google Business Profile > Ask for reviews):

> Really glad you're happy with the site. Would you mind leaving a quick Google
> review? It genuinely helps a one-man band like me. Takes 20 seconds: [link].
> Thanks, Harry.

Reply to every review. Five reviews changes how you rank and how strangers
trust you. Never buy fake ones.

## 6. Referrals and partners (compounding, free)
- Put a small "Website by StaticSwift" credit link on every client site you
  build (with their ok). Every sale becomes a backlink that helps you rank.
- Point accountants, suppliers and coaches at staticswift.co.uk/partners - they
  earn a fee for every client they send. The recruiter drafts these for you.

## The order to actually do this
1. Set SMTP + redeploy (today). 2. Send 10 manual WhatsApps a day (today).
3. Submit the sitemaps in Search Console (today). 4. Launch a small Google Ads
campaign (this week). 5. Ask every client for a review (from client 1).

Slow, honest, compounding beats any trick. This is how you get busy.
