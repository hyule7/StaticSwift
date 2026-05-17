# staticswift-site

The StaticSwift website — staticswift.co.uk
Hosted on Netlify. All pages are static HTML.

---

## What is in this repo right now

27 files. That is correct and intentional.

The 32,510 SEO landing pages are NOT in the repo yet.
They get added gradually over 4 months using the staticswift-pages 
generator following a batch publishing schedule. See staticswift-pages/README.md.

---

## Repository structure

```
staticswift-site/
├── index.html                    Main website
├── example.html                  Fade and Blade Barbers showcase
├── admin/index.html              CRM admin dashboard
├── thank-you.html                Post-form submission
├── payment-confirmed.html        Post-payment
├── 404.html                      Custom 404
├── terms.html                    Terms of service
├── privacy.html                  Privacy policy
├── how-to-upload.html            Upload guide for clients
├── sitemap.xml                   Core pages sitemap
├── sitemap-index.xml             Index pointing to both sitemaps
├── robots.txt                    Search engine rules
├── netlify.toml                  Netlify config (build, redirects, headers)
├── package.json                  Root package.json (for reference)
├── netlify/functions/            Backend (all Netlify Functions)
│   ├── package.json              ← Functions install their own deps from here
│   ├── _mailer.js                Shared email module (FastHosts SMTP or Gmail)
│   ├── handle-intake.js          Receives intake form, emails client + you
│   ├── nurture-signup.js         Lead capture, Day 1 nurture email
│   ├── send-preview.js           Send preview email (called from admin)
│   ├── send-invoice.js           Generate PDF invoice, send to client
│   ├── stripe-webhook.js         Payment confirmed, send files
│   ├── daily-followup.js         Scheduled 9am Mon-Fri, all automation
│   ├── poll-support.js           Scheduled every 5min, polls support inbox
│   ├── client-portal.js          Serves /client/[uuid] portal pages
│   └── excel-export.js           Exports CRM data to Excel
└── [SEO pages added here in batches]
    ├── website-design-manchester/
    ├── barber-website-design-manchester/
    └── ...
```

---

## Netlify setup

### Site settings
- Build command: `cd netlify/functions && npm install --production`
- Publish directory: `.`
- Functions directory: `netlify/functions`
- Node version: 18

### Branch deploys
- Production branch: `main` — deploys to staticswift.co.uk
- Deploy previews: ON — every pull request gets a preview URL
- Branch deploys: ON — useful for testing SEO batches before merging to main

Recommended branch workflow for SEO batches:
```
main (live) → seo-batch-1 (test batch) → merge to main → deploy
```

### Environment variables (set all before first deploy)

```
MAIL_PROVIDER          fasthosts
SMTP_HOST              mail.staticswift.co.uk
SMTP_PORT              587
SMTP_SECURE            false
SMTP_USER              hello@staticswift.co.uk
SMTP_PASS              [FastHosts mailbox password]
SUPPORT_EMAIL          support@staticswift.co.uk
OWNER_EMAIL            [your personal email]
ADMIN_PASSWORD         [choose strong password]
STRIPE_SECRET_KEY      sk_live_...
STRIPE_WEBHOOK_SECRET  whsec_...
STRIPE_PAYMENT_LINK_STARTER    https://buy.stripe.com/...
STRIPE_PAYMENT_LINK_ADVANCED   https://buy.stripe.com/...
NETLIFY_ACCESS_TOKEN   [personal access token]
NETLIFY_PREVIEW_SITE_ID        [blank site ID for previews]
WHATSAPP_NUMBER        447...
GOOGLE_REVIEW_LINK     https://g.page/r/...
GA4_MEASUREMENT_ID     G-...
GOOGLE_MAPS_API_KEY    [for outreach system]
```

---

## Before first deploy — 3 things to do in the code

1. **Logo** — drop `logo.png` in this folder. Run:
   `node -e "console.log(require('fs').readFileSync('logo.png').toString('base64'))"`
   Copy the output. Find-replace `LOGO_BASE64_PLACEHOLDER` in all 7 function files.

2. **WhatsApp number** — open `index.html`, find `const WHATSAPP_NUMBER = '447000000000'`
   and replace with your actual number (no + sign, no spaces).

3. **Admin password** — open `admin/index.html`, find `const ADMIN_PW = 'staticswift2026'`
   and set it to the same value as your ADMIN_PASSWORD env var.

---

## FastHosts email setup

1. FastHosts control panel → Email → Add Mailbox
2. Create `hello@staticswift.co.uk` and `support@staticswift.co.uk`
3. Note the password you set — goes in SMTP_PASS env var
4. SMTP settings: host `mail.staticswift.co.uk`, port 587, TLS

---

## Stripe webhook setup

After deploying to Netlify:
1. Stripe Dashboard → Developers → Webhooks → Add Endpoint
2. URL: `https://staticswift.co.uk/.netlify/functions/stripe-webhook`
3. Event: `payment_intent.succeeded`
4. Copy signing secret → STRIPE_WEBHOOK_SECRET env var

---

## SEO pages

See `staticswift-pages/README.md` for full instructions.
Short version:
1. Generate `cities.json` using Claude.ai
2. Run `node generate.js` from staticswift-pages/
3. Adds 32,510 HTML files to this repo
4. Push in batches over 4 months using publish-batch.js

Total pages at full deployment: ~32,537
(27 core + 32,510 SEO)
