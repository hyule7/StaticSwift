# staticswift-pages

StaticSwift programmatic SEO generator.
Generates 32,510 unique landing pages directly into the staticswift-site repo.

---

## How the repos relate

```
your-computer/
├── staticswift-site/        ← GitHub repo, live on Netlify
│   ├── index.html
│   ├── admin/
│   ├── netlify/
│   └── [SEO pages land here after generate.js]
│       ├── website-design-manchester/
│       ├── barber-website-design-manchester/
│       └── ... (32,510 directories)
│
└── staticswift-pages/       ← NOT on GitHub, runs locally only
    ├── generate.js
    ├── publish-batch.js
    ├── cities.json          ← you create this (see step 1)
    ├── niches.json
    └── content-bank.json
```

The generator writes HTML directly into staticswift-site/. 
You then git add pages in batches and push — Netlify deploys them live.

---

## Step 1 — Create cities.json

Open Claude.ai and paste this prompt:

```
Generate a JSON array for cities.json of 1,547 UK cities, towns, and boroughs 
with populations above 5,000 from the ONS 2024 settlement list. 

Each entry must have:
- name: city name (string, e.g. "Manchester")
- slug: lowercase hyphenated (string, e.g. "manchester") 
- region: e.g. "Greater Manchester", "West Yorkshire" (string)
- postcode: primary postcode district e.g. "M1", "LS1" (string)
- nearby: array of 3 nearby settlement names (string[])

Start with these 20 cities then continue alphabetically by name until you 
reach 1,547 total entries:
Manchester, Birmingham, Leeds, Liverpool, Sheffield, Bristol, Edinburgh, 
Glasgow, Newcastle, Nottingham, Leicester, Coventry, Bradford, Cardiff, 
Wolverhampton, Southampton, Derby, Portsmouth, Brighton, Plymouth

Return ONLY valid JSON with no preamble, no markdown backticks.
```

Claude will return the JSON in chunks if it is long — combine them into one 
array and save as cities.json in this directory.

---

## Step 2 — Generate all pages

Make sure staticswift-site and staticswift-pages are sibling folders:
```
your-computer/
├── staticswift-site/
└── staticswift-pages/   ← run commands from here
```

Then run:
```bash
node generate.js
```

This writes ~32,510 directories into ../staticswift-site/.
Takes 3-5 minutes. Watch the progress counter.

To preview locally without writing to staticswift-site:
```bash
SS_OUTPUT=./output node generate.js
```

---

## Step 3 — Follow the batch publishing schedule

IMPORTANT: Do not push all 32,510 pages at once. Google treats a sudden 
mass publish as spam. Follow this schedule:

| When      | Run                            | Pages | Cumulative |
|-----------|--------------------------------|-------|------------|
| Week 1    | node publish-batch.js 500      | 500   | 500        |
| Week 2    | node publish-batch.js 1000     | 1,000 | 1,500      |
| Week 3-4  | node publish-batch.js 2000     | 2,000 | 3,500      |
| Month 2   | node publish-batch.js 5000     | 5,000 | 8,500      |
| Month 3   | node publish-batch.js 10000    | 10,000| 18,500     |
| Month 4   | node publish-batch.js 14010    | 14,010| 32,510     |

publish-batch.js tells you exactly which git commands to run.
It tracks what has been published in published.json.

---

## Step 4 — After each push

1. Go to Google Search Console
2. Sitemaps → submit https://staticswift.co.uk/sitemap-pages.xml
3. Wait 2 weeks, check Coverage report
4. Target: 40-60% of submitted pages indexed within 60 days

---

## Monitoring

If indexation rate drops below 30%:
- Content quality issue — improve content-bank.json
- Crawl budget issue — slow down the publishing schedule
- Check Search Console Coverage for specific errors
