#!/usr/bin/env node
/**
 * publish-batch.js
 * 
 * Tells you which pages to git add for each week's batch deployment.
 * Run from inside the staticswift-pages/ directory.
 * 
 * Usage: node publish-batch.js [batch-size]
 * Example: node publish-batch.js 500
 */
const fs = require('fs');
const path = require('path');

const batchSize = parseInt(process.argv[2]) || 500;
const SITE_DIR = '../staticswift-site';
const TRACKER = './published.json';

if (!fs.existsSync(SITE_DIR)) {
  console.error('ERROR: ../staticswift-site not found. Run this from staticswift-pages/ with staticswift-site as a sibling folder.');
  process.exit(1);
}

// Get all directories that were generated (URL slug format)
const allGenerated = fs.readdirSync(SITE_DIR).filter(d => {
  const full = path.join(SITE_DIR, d);
  return fs.statSync(full).isDirectory() && (
    d.startsWith('website-design-') ||
    d.includes('-website-design') ||
    d === 'staticswift-vs-wix' ||
    d === 'staticswift-vs-squarespace' ||
    d === 'staticswift-vs-freelancer'
  );
}).sort();

let published = [];
try { published = JSON.parse(fs.readFileSync(TRACKER, 'utf8')); } catch { published = []; }
const publishedSet = new Set(published);

const unpublished = allGenerated.filter(d => !publishedSet.has(d));
const thisBatch = unpublished.slice(0, batchSize);

if (!thisBatch.length) {
  console.log(`\nAll ${allGenerated.length} generated directories already tracked as published.`);
  console.log('If you have not pushed yet, run: git add . && git commit -m "SEO pages" && git push');
  process.exit(0);
}

// Update tracker
published.push(...thisBatch);
fs.writeFileSync(TRACKER, JSON.stringify(published, null, 2));

const batchNum = Math.ceil(published.length / batchSize);
const totalPages = allGenerated.length;

console.log('\n' + '='.repeat(60));
console.log(`BATCH ${batchNum} — ${thisBatch.length} directories`);
console.log(`Published so far: ${published.length} / ${totalPages}`);
console.log(`Remaining after this batch: ${totalPages - published.length}`);
console.log('='.repeat(60));

console.log('\nRun these commands from your staticswift-site directory:\n');
console.log('  cd ../staticswift-site');

// Generate the git add commands for just this batch
// Group into chunks to avoid command line length limits
const CHUNK = 50;
for (let i = 0; i < thisBatch.length; i += CHUNK) {
  const chunk = thisBatch.slice(i, i + CHUNK);
  console.log(`  git add ${chunk.join(' ')}`);
}

console.log(`  git add sitemap-pages.xml sitemap-index.xml`);
console.log(`  git commit -m "Add ${thisBatch.length} SEO pages (batch ${batchNum} — total ${published.length})"`);
console.log('  git push\n');

console.log('Netlify will auto-deploy within ~30 seconds of the push.');
console.log('Submit sitemap-pages.xml to Search Console after each batch.\n');

// Show publishing schedule reminder
const scheduleMap = [
  [500,   'Week 1:   Top 25 cities × 20 niches'],
  [1500,  'Week 2:   Next 50 cities × 20 niches'],
  [3500,  'Week 3-4: All city-only pages'],
  [8500,  'Month 2:  Cities 76-500 × 20 niches'],
  [18500, 'Month 3:  Remaining combinations pt.1'],
  [32510, 'Month 4:  All remaining pages'],
];
console.log('Publishing schedule:');
scheduleMap.forEach(([target, label]) => {
  const done = published.length >= target ? '✓' : published.length > 0 ? '→' : ' ';
  console.log(`  ${done} ${label} (cumulative: ${target.toLocaleString()})`);
});
