/*
 * _queue.js — shared approval-queue store (Netlify Blobs).
 *
 * The spine of the agent workforce: every outbound artefact an agent
 * produces lands here as a pending card; nothing reaches a customer until
 * Harry approves (or a category earns auto-send after 50 clean approvals).
 *
 * Blob layout (store "approval-queue"):
 *   items   -> [ { id, createdAt, status, category, to, subject, body,
 *                  prospect, sendAfter, meta, decidedAt, editedBody } ]
 *   control -> { autonomy: { <category>: { streak, auto } },
 *                kill: { global: bool, <category>: bool } }
 *
 * status: pending | approved | edited | rejected | sent | failed
 * Autonomy is EARNED: 50 consecutive approvals with no edit in a category
 * flips control.autonomy[cat].auto = true. Any edit or reject resets streak.
 * Agents NEVER move money, change pricing, or exceed budgets regardless of
 * autonomy level (enforced by category allow-list in the dispatcher).
 */
const { getNamedStore } = require('./_blobs');

const STORE = 'approval-queue';
const AUTO_THRESHOLD = 50;

async function load() {
  const s = getNamedStore(STORE);
  if (!s) return { store: null, items: [], control: defaultControl() };
  const items = (await s.get('items', { type: 'json' })) || [];
  const control = (await s.get('control', { type: 'json' })) || defaultControl();
  if (!control.autonomy) control.autonomy = {};
  if (!control.kill) control.kill = { global: false };
  return { store: s, items, control };
}
function defaultControl() { return { autonomy: {}, kill: { global: false } }; }

async function saveItems(store, items) { if (store) await store.setJSON('items', items.slice(-2000)); }
async function saveControl(store, control) { if (store) await store.setJSON('control', control); }

function autonomyFor(control, category) {
  return control.autonomy[category] || { streak: 0, auto: false };
}

// Record an approve/edit/reject decision and update the earned-autonomy streak.
function recordDecision(control, category, decision) {
  const a = autonomyFor(control, category);
  if (decision === 'approved') {
    a.streak = (a.streak || 0) + 1;
    if (a.streak >= AUTO_THRESHOLD) a.auto = true;
  } else {
    // edit or reject breaks the clean streak and revokes earned autonomy.
    a.streak = 0;
    a.auto = false;
  }
  control.autonomy[category] = a;
  return a;
}

module.exports = { load, saveItems, saveControl, autonomyFor, recordDecision, AUTO_THRESHOLD, STORE };
