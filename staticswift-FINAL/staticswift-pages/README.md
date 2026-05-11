# staticswift-pages

StaticSwift programmatic SEO generator. Generates 32,510 Google-safe landing pages.

## Setup

### 1. Generate cities.json

You need to create cities.json with 1,547 UK cities. Use this Claude.ai prompt:

```
Generate a JSON array called cities.json of 1,547 UK cities, towns, and boroughs with populations above 5,000 from the ONS 2024 settlement list. Each entry must have:
- name: city name (string)
- slug: lowercase hyphenated (string)  
- region: e.g. "Greater Manchester", "West Yorkshire" (string)
- postcode: primary postcode district e.g. "M1", "LS1" (string)
- nearby: array of 3 nearby settlement names (string[])

Return valid JSON only. Start with the 20 largest UK cities then continue alphabetically.
```

Save the output as cities.json in this directory.

### 2. Run the generator

```bash
node generate.js
```

This generates all pages into output/ — takes 3-5 minutes on a modern laptop.

### 3. Batch publish (follow schedule from spec)

```bash
# Week 1: top 500 pages (25 cities x 20 niches)
node publish-batch.js 500

# Week 2: next 1,000
node publish-batch.js 1000

# Continue per the publishing schedule
```

Then copy deploy/ into staticswift-site, git commit, and push.

## Publishing Schedule (from spec)

| Week | Pages | Cumulative |
|------|-------|------------|
| Week 1 | 500 | 500 |
| Week 2 | 1,000 | 1,500 |
| Week 3-4 | 2,000 | 3,500 |
| Month 2 | 5,000 | 8,500 |
| Month 3 | 10,000 | 18,500 |
| Month 4 | 14,010 | 32,510 |

Do NOT publish all pages at once — Google treats sudden mass publishing as spam.

## Monitoring

After publishing, submit sitemap-index.xml to Google Search Console.
Check Coverage report after 2 weeks — target 40-60% indexed within 60 days.
