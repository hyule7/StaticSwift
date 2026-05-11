# staticswift-outreach

StaticSwift cold outreach system. Runs locally on your laptop.

## What it does

- Finds leads via Google Maps Places API (barbers, plumbers, photographers etc across UK cities)
- Scores each business website (mobile responsive, title tag, content, speed) — 0 to 4
- Surfaces businesses with score 2 or below into a review queue
- For each lead you copy a pre-built prompt into Claude.ai, get a personalised email back, paste it in and queue it
- Sends via Gmail OAuth2 with 60-150 second random delays
- Max 40 emails per day, max 2 contacts per lead
- Tracks all sends, flags follow-ups due after 5 days

## Setup

### 1. Install
npm install

### 2. Environment variables
cp .env.example .env
Fill in your values — especially GOOGLE_MAPS_API_KEY and Gmail OAuth2 credentials.

For Gmail OAuth2, see the SETUP.md in staticswift-site for the token generator script.

### 3. Run
npm start
Open http://localhost:3001

### 4. Usage
- Click "Run Lead Finder" to pull businesses from Google Maps
- Review queue shows businesses with poor/no websites
- Click "Write Email" on any lead — copy the prompt to Claude.ai
- Paste the email back, add a subject, click Queue Email
- System sends automatically with randomised delays
- Check /sent for the full send log

## Notes
- No Anthropic API costs — you use your existing Claude.ai subscription to write the emails
- Google Maps API is free within the monthly $200 credit (40 leads/day easily fits)
- Adjust niches and cities in outreach_config.json
