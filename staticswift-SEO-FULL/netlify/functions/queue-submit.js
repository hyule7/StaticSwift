/*
 * queue-submit.js — agents push artefacts into the approval queue.
 *
 * Auth: x-agent-token == AGENT_TOKEN env var (separate from the admin
 * password, so shift agents can submit without admin rights). If a category
 * has earned auto-send (control.autonomy[cat].auto) and the global/category
 * kill switch is off, the item is marked 'approved' immediately so the
 * dispatcher will send it; otherwise it lands 'pending' for Harry.
 */
const { load, saveItems, autonomyFor } = require('./_queue');

const SENDABLE = new Set(['outreach', 'outreach-followup', 'cs-reply']); // money/pricing never here

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const token = event.headers['x-agent-token'];
  if (!process.env.AGENT_TOKEN || token !== process.env.AGENT_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let item;
  try { item = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'bad JSON' }; }
  if (!item.category) return { statusCode: 400, body: JSON.stringify({ error: 'category required' }) };

  const { store, items, control } = await load();
  if (!store) return { statusCode: 500, body: JSON.stringify({ error: 'Blobs unavailable' }) };

  const auto = autonomyFor(control, item.category);
  const killed = control.kill.global || control.kill[item.category];
  const earned = auto.auto && !killed && SENDABLE.has(item.category);

  const record = {
    id: item.id || ('q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    createdAt: new Date().toISOString(),
    status: earned ? 'approved' : 'pending',
    autoApproved: earned,
    category: item.category,
    to: item.to || null,
    subject: item.subject || '',
    body: item.body || '',
    prospect: item.prospect || null,
    sendAfter: item.sendAfter || null,
    meta: item.meta || {},
  };
  items.push(record);
  await saveItems(store, items);
  return { statusCode: 200, body: JSON.stringify({ ok: true, id: record.id, status: record.status }) };
};
