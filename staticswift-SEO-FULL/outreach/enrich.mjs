#!/usr/bin/env node
/*
 * enrich.mjs — score prospects 0-100 on "needs StaticSwift".
 *
 * Input: JSON array of prospects:
 *   { business, trade, town, email?, phone?, website?, gbp?, incorporatedOn? }
 * Output (stdout): same array, each with { score, signals[], observation }.
 *
 * The `observation` is ONE specific, verifiable true thing the writer can
 * open the email with. If nothing truthful is available, observation is null
 * and the writer must say nothing specific (Covenant: then say nothing).
 *
 * Live checks (analyze-site, domain-age) are used when a website is given and
 * the site is reachable; otherwise scoring leans on the no-website signal,
 * which is the highest-intent prospect there is.
 */
import { readFileSync } from 'node:fs';

const SITE = process.env.URL || 'https://staticswift.co.uk';

async function checkSite(url) {
  try {
    const r = await fetch(SITE + '/.netlify/functions/analyze-site-public', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function daysSince(iso) {
  const t = Date.parse(iso); if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

async function enrichOne(p) {
  const signals = [];
  let score = 30;
  let observation = null;

  if (!p.website) {
    score += 45;
    signals.push('no-website');
    observation = `you don't seem to have a website yet`;
  } else {
    const a = await checkSite(p.website);
    if (a && a.ok) {
      if (a.score < 55) { score += 25; signals.push('weak-site(' + a.score + ')'); }
      else if (a.score < 80) { score += 12; signals.push('patchy-site(' + a.score + ')'); }
      else { score -= 10; signals.push('decent-site(' + a.score + ')'); }
      // Pick the most concrete true observation from the audit.
      const issue = (a.issues || [])[0];
      if (issue) observation = issue.replace(/ — .*/, '').toLowerCase().replace(/^no /, 'your site has no ');
      if (/slow|sluggish/i.test((a.issues || []).join(' '))) {
        const ms = a.responseMs;
        if (ms) observation = `your site takes about ${(ms / 1000).toFixed(1)} seconds to load on a phone`;
      }
    } else {
      score += 15; signals.push('site-unreachable');
      observation = `your website didn't load when I checked it`;
    }
  }

  // New-incorporation intent: a days-old trade company is gold.
  const age = daysSince(p.incorporatedOn);
  if (age !== null && age <= 60) {
    score += 20; signals.push('new-company(' + age + 'd)');
    if (!observation) observation = `congratulations on registering ${p.business}`;
  }

  // Contactability.
  if (p.email) signals.push('has-email'); else score -= 5;
  if (p.gbp) { score += 5; signals.push('has-gbp'); }

  score = Math.max(0, Math.min(100, score));
  return { ...p, score, signals, observation };
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node outreach/enrich.mjs prospects.json'); process.exit(1); }
  const prospects = JSON.parse(readFileSync(file, 'utf8'));
  const out = [];
  for (const p of prospects) { out.push(await enrichOne(p)); }
  out.sort((a, b) => b.score - a.score);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  console.error(`enriched ${out.length}; top score ${out[0]?.score}, ${out.filter(p => p.score >= 70).length} at >=70`);
}
main();
