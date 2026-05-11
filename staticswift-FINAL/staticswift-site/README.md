# staticswift-site

The StaticSwift website — staticswift.co.uk

## Stack

- Pure static HTML/CSS/JS — no framework, no build step
- Netlify Functions (Node 18) for backend operations
- Netlify Blobs for data storage
- Nodemailer + Gmail OAuth2 for email
- Stripe for payments
- Puppeteer for invoice PDF generation

## Project Structure

```
/
├── index.html              # Main website
├── thank-you.html          # Post-form submission
├── payment-confirmed.html  # Post-payment
├── 404.html                # Custom 404
├── terms.html              # Terms of service
├── privacy.html            # Privacy policy
├── how-to-upload.html      # Upload FAQ
├── example.html            # Fade and Blade Barbers showcase
├── sitemap.xml
├── robots.txt
├── netlify.toml
├── package.json
├── .env.example
└── netlify/
    └── functions/
        ├── handle-intake.js      # Receives intake form, saves to Blobs, sends emails
        ├── nurture-signup.js     # Nurture lead capture, sends Day 1 email
        ├── send-preview.js       # Called from CRM to send preview email
        ├── send-invoice.js       # Called from CRM to generate PDF and send invoice
        ├── stripe-webhook.js     # Handles payment confirmation, sends files
        └── daily-followup.js    # Scheduled 9am Mon-Fri, runs all automation rules
```

## Setup

### 1. Prerequisites

- Node.js 18+
- A Netlify account (free)
- A GitHub account (free)
- A Stripe account (free)
- A Gmail account with OAuth2 configured (see SETUP.md)
- Cloudflare Email Routing set up for staticswift.co.uk

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/staticswift-site.git
cd staticswift-site
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env` and fill in all values. See `.env.example` for descriptions of each variable.

For Gmail OAuth2, run the token generator script described in SETUP.md.

### 4. Local development

```bash
npm run dev
# Starts netlify dev server at localhost:8888
```

### 5. Deploy

Connect this GitHub repo to Netlify:
1. Log in to app.netlify.com
2. New Site from Git > GitHub > select this repo
3. Build command: leave empty (or `echo 'no build'`)
4. Publish directory: `.`
5. Add all environment variables from `.env.example` in Site Settings > Environment Variables
6. Deploy

### 6. Custom domain

In Netlify: Site Settings > Domain Management > Add Custom Domain > `staticswift.co.uk`

Follow the DNS instructions to point your domain at Netlify.

## Configuration

All front-end config is at the top of `index.html` in the `<script>` block:

```js
const ANNOUNCEMENT_ACTIVE = true;        // Toggle announcement bar
const ANNOUNCEMENT_TEXT = '...';         // Announcement bar text
const SITE_COUNT = 12;                   // Live sites counter
const WHATSAPP_NUMBER = '447000000000';  // WhatsApp number (no + or spaces)
```

## Logo

Drop `logo.png` into the project root before deploying. The Netlify functions reference `LOGO_BASE64_PLACEHOLDER` — replace this with the actual base64 string of your logo using:

```js
const fs = require('fs');
const base64 = Buffer.from(fs.readFileSync('logo.png')).toString('base64');
console.log(base64);
```

Then do a find-and-replace of `LOGO_BASE64_PLACEHOLDER` with the output across all function files.

## Stripe Webhooks

After deploying, set up your Stripe webhook:
1. Stripe Dashboard > Developers > Webhooks > Add Endpoint
2. Endpoint URL: `https://staticswift.co.uk/.netlify/functions/stripe-webhook`
3. Event: `payment_intent.succeeded`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in Netlify env vars

## Support

hello@staticswift.co.uk
