#!/usr/bin/env node
/**
 * publish-batch.js
 * Copies the next N undeployed pages from output/ into deploy/
 * Usage: node publish-batch.js 500
 */
const fs = require('fs');
const path = require('path');

const batchSize = parseInt(process.argv[2]) || 500;
const OUTPUT_DIR = './output';
const DEPLOY_DIR = './deploy';
const PUBLISHED_FILE = './published.json';

if (!fs.existsSync(OUTPUT_DIR)) { console.error('No output/ directory. Run node generate.js first.'); process.exit(1); }

let published = [];
try { published = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf8')); } catch { published = []; }
const publishedSet = new Set(published);

// Get all generated directories
const allDirs = fs.readdirSync(OUTPUT_DIR).filter(d => {
  const full = path.join(OUTPUT_DIR, d);
  return fs.statSync(full).isDirectory();
});

const unpublished = allDirs.filter(d => !publishedSet.has(d));
const thisBatch = unpublished.slice(0, batchSize);

if (!thisBatch.length) {
  console.log('All pages already published. Nothing to deploy.');
  process.exit(0);
}

if (!fs.existsSync(DEPLOY_DIR)) fs.mkdirSync(DEPLOY_DIR, { recursive: true });

// Copy batch to deploy/
thisBatch.forEach(dir => {
  const src = path.join(OUTPUT_DIR, dir);
  const dest = path.join(DEPLOY_DIR, dir);
  fs.mkdirSync(dest, { recursive: true });
  const indexFile = path.join(src, 'index.html');
  if (fs.existsSync(indexFile)) {
    fs.copyFileSync(indexFile, path.join(dest, 'index.html'));
  }
  published.push(dir);
});

// Also copy sitemaps
['sitemap-pages.xml','sitemap-index.xml'].forEach(f => {
  const src = path.join(OUTPUT_DIR, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DEPLOY_DIR, f));
});

fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(published, null, 2));

console.log(`\nBatch ready: ${thisBatch.length} pages added to deploy/`);
console.log(`Total published: ${published.length} / ${allDirs.length}`);
console.log(`Remaining: ${allDirs.length - published.length}`);
console.log('\nNow run these git commands from your staticswift-site directory:');
console.log(`  cp -r deploy/* ../staticswift-site/`);
console.log(`  cd ../staticswift-site`);
console.log(`  git add .`);
console.log(`  git commit -m "Add ${thisBatch.length} programmatic pages (batch ${Math.ceil(published.length/batchSize)})"`);
console.log(`  git push`);
