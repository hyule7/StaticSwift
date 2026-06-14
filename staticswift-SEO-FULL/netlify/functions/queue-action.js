/*
 * queue-action.js — admin acts on a queue item (one tap, mobile).
 *
 * Actions: approve | edit | reject | kill | unkill
 *   approve  -> status=approved, dispatcher will send. Bumps autonomy streak.
 *   edit     -> status=edited + editedBody, dispatcher sends the edit. Resets
 *               the category's clean streak and revokes earned auto-send.
 *   reject   -> status=rejected, never sent. Resets streak.
 *   kill/unkill -> flip a per-category or global kill switch.
 *
 * Approving a design/build item (category 'design'/'build') with meta.deploy
 * triggers the production delivery pipeline; that hand-off is left as a
 * meta flag the deploy function reads, so phone-approval completes delivery.
 */
const { load, saveItems, saveControl, recordDecision } = require('./_queue');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  let p; try { p = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'bad JSON' }; }
  const { action, id, category, editedBody } = p;

  const { store, items, control } = await load();
  if (!store) return { statusCode: 500, body: JSON.stringify({ error: 'Blobs unavailable' }) };

  if (action === 'kill' || action === 'unkill') {
    const on = action === 'kill';
    if (category === 'global' || !category) control.kill.global = on;
    else control.kill[category] = on;
    await saveControl(store, control);
    return { statusCode: 200, body: JSON.stringify({ ok: true, kill: control.kill }) };
  }

  const item = items.find(i => i.id === id);
  if (!item) return { statusCode: 404, body: JSON.stringify({ error: 'not found' }) };
  const now = new Date().toISOString();

  let delivery = null;
  if (action === 'approve') {
    item.status = 'approved'; item.decidedAt = now; recordDecision(control, item.category, 'approved');
    // Phone-tap-completes-delivery: approving a design build ships it.
    if (item.category === 'design' && item.meta && item.meta.deploy) {
      try { const { deliverApprovedDesign } = require('./_deliver'); delivery = await deliverApprovedDesign(item); item.delivery = delivery; item.status = 'sent'; }
      catch (e) { item.deliveryError = e.message; }
    }
  }
  else if (action === 'edit') { item.status = 'edited'; item.editedBody = editedBody || item.body; item.decidedAt = now; recordDecision(control, item.category, 'edited'); }
  else if (action === 'reject') { item.status = 'rejected'; item.decidedAt = now; recordDecision(control, item.category, 'rejected'); }
  else return { statusCode: 400, body: JSON.stringify({ error: 'unknown action' }) };

  await saveItems(store, items);
  await saveControl(store, control);
  return { statusCode: 200, body: JSON.stringify({ ok: true, item: { id: item.id, status: item.status }, delivery, autonomy: control.autonomy[item.category] }) };
};
