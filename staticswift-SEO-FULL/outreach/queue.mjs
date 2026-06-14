/*
 * queue.mjs — shared approval-queue writer for the outreach toolchain.
 *
 * Every outbound artefact lands here, never on the wire. The approval queue
 * lives in Netlify Blobs (store "approval-queue", key "items"); offline it
 * falls back to outreach/.queue.local.json so the pipeline is testable.
 *
 * Suppression is checked at draft time: a drafted email to a suppressed
 * address is dropped here, before it can ever reach the dispatcher.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL = join(HERE, '.queue.local.json');
const SUPPRESS_LOCAL = join(HERE, '.suppression.local.json');

// Blobs are only reachable inside Netlify; the toolchain runs in a shift on
// Harry's Mac, so it posts to a small admin endpoint when creds exist, else
// writes the local file the dispatcher/dev reads.
async function blobsAvailable() {
  return !!(process.env.NETLIFY_BLOBS_TOKEN && (process.env.NETLIFY_SITE_ID || process.env.SITE_ID));
}

function loadLocal(path, fallback) {
  try { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback; }
  catch { return fallback; }
}

const norm = e => String(e || '').trim().toLowerCase();

export function isSuppressed(email) {
  const sup = loadLocal(SUPPRESS_LOCAL, { emails: [] });
  return sup.emails.map(norm).includes(norm(email));
}

/**
 * Push one artefact to the approval queue.
 * item = { category, to, subject, body, prospect, sendAfter, meta }
 * Returns { queued: bool, reason? }
 */
export async function enqueue(item) {
  if (!item || !item.category) throw new Error('item.category required');
  if (item.to && isSuppressed(item.to)) return { queued: false, reason: 'suppressed' };

  const record = {
    id: 'q_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
    createdAt: new Date().toISOString(),
    status: 'pending',            // pending | approved | edited | rejected | sent
    category: item.category,      // outreach | outreach-followup | cs-reply | ...
    to: item.to || null,
    subject: item.subject || '',
    body: item.body || '',
    prospect: item.prospect || null,
    sendAfter: item.sendAfter || null,
    meta: item.meta || {},
  };

  if (await blobsAvailable()) {
    // Posted via the admin queue endpoint (Phase 6.2) so Blobs creds stay server-side.
    const url = (process.env.URL || 'https://staticswift.co.uk') + '/.netlify/functions/queue-submit';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.AGENT_TOKEN || '' },
      body: JSON.stringify(record),
    });
    if (!r.ok) throw new Error('queue-submit failed: ' + r.status);
    return { queued: true, id: record.id, via: 'blobs' };
  }

  const q = loadLocal(LOCAL, { items: [] });
  q.items.push(record);
  writeFileSync(LOCAL, JSON.stringify(q, null, 2));
  return { queued: true, id: record.id, via: 'local' };
}

export function readLocalQueue() { return loadLocal(LOCAL, { items: [] }); }
