# Google Search Console checklist (do after deploying)

Everything below only takes effect once you deploy and Google re-crawls. This
list makes that happen faster and confirms the new markup is picked up.

## 1. Submit the sitemaps (Sitemaps tab)
Add each of these (Google reads sitemap-index automatically, but submitting the
sub-sitemaps too makes coverage easy to watch):
- `sitemap-index.xml`  (the master, points to all the others)
- `sitemap-guides.xml`  (25 topic guides)
- `sitemap-city-guides.xml`  (415 city guides)
- `sitemap-seo.xml`  (the 31k programmatic estate, if not already submitted)

## 2. Request indexing on your key pages (URL Inspection tab)
Paste each URL, click "Request indexing". Do the most important first (Google
limits how many per day, so spread it over a few days):
- https://staticswift.co.uk/  (homepage - has the new title, review stars, offer)
- https://staticswift.co.uk/guides/
- https://staticswift.co.uk/guides/how-much-does-a-tradesperson-website-cost-uk/
- https://staticswift.co.uk/guides/who-builds-websites-for-tradespeople-uk/
- 3 or 4 city guides for your target towns, e.g.
  https://staticswift.co.uk/guides/website-design-manchester/
- Your top few trade+town pages, e.g.
  https://staticswift.co.uk/plumber-website-design-manchester/

## 3. Confirm the new markup is seen (URL Inspection > Test live URL)
On the homepage and a leaf page, run "Test live URL" and check the rich results
it detects. You should see:
- Breadcrumbs (BreadcrumbList) - now on 27k pages
- FAQ (FAQPage) - on estate + guides
- Review snippet (AggregateRating) - homepage, from Beth's real review
- Merchant/Offer (£499) - estate + homepage
Also confirm the title shown is the new keyword-first one, not the old brand-
first one.

## 4. Rich Results Test (separate tool)
Belt and braces: https://search.google.com/test/rich-results
Paste https://staticswift.co.uk/ and a leaf URL. It should report valid
FAQ, Breadcrumb, Review, and Offer/Product results with no errors.

## 5. Watch these reports over the next 2-4 weeks
- Performance > check CTR before/after (keyword-first titles should lift it).
- Indexing > Pages: if lots of guides show "Discovered - currently not
  indexed", that is Google saying they are too similar/thin. Tell me and I will
  differentiate or prune them. This feedback matters more than raw page count.
- Enhancements: Breadcrumbs, FAQ, Merchant listings, Review snippets should
  populate as pages are re-crawled.

## 6. While you are in Google
- Google Business Profile: keep gathering reviews (biggest lever), add photos,
  post weekly, and grab the direct write-review link (g.page/r/...) so review
  requests open in one tap.
- Every new review: add it to data/reviews.json and run
  `node scripts/build-reviews.mjs`, then redeploy - the stars update.

Deploy first. None of this works until the new files are live.
