/*
 * categorize-reply.js
 * ---------------------------------------------------------------
 * Takes a recipient's reply text → returns:
 *   { category: "interested" | "objection" | "not-interested" | "autoreply" | "unsubscribe",
 *     suggestion: "..." }
 *
 * Uses OpenAI GPT-4o-mini (cheap, fast). Falls back to a rule-based
 * classifier when OPENAI_API_KEY is missing — so it works out of the
 * box even before you've provisioned an API key.
 */

const ADMIN = process.env.ADMIN_PASSWORD;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const { addSuppression, isUnsubReply } = require('./_suppression');

const SYSTEM_PROMPT = `You categorize replies to a cold B2B outreach email from a UK web designer.
Reply with strict JSON: {"category":"...","reason":"...","suggestion":"..."}.
Valid categories:
  interested      — they want to talk / hear more / see preview
  objection       — they have a concern (price, timing, existing site) but aren't a no
  not-interested  — clear, polite no, not now, no thanks
  unsubscribe     — STOP/unsubscribe/remove me/never contact
  autoreply       — out-of-office, holiday, auto-responder
Suggestion: one-sentence next move ("Send pricing PDF" / "Ask for their domain to mock up" / "Mark dead, move on" / "Honour unsubscribe immediately").`;

function ruleClassify(text) {
  const t = (text || '').toLowerCase();
  if (/\bunsubscribe|\bstop\b|remove me|don'?t contact|never contact me/.test(t))
    return { category: 'unsubscribe', reason: 'Detected unsubscribe phrase', suggestion: 'Honour immediately. Mark status=dead. Do not email again.' };
  if (/out of office|on holiday|away until|automatic reply|out of the office/.test(t))
    return { category: 'autoreply', reason: 'Out-of-office phrasing detected', suggestion: 'Wait for return-date and re-queue follow-up.' };
  if (/yes please|sounds good|let'?s talk|happy to|interested|tell me more|book a call|free preview|send (it|the|me) over|when can/.test(t))
    return { category: 'interested', reason: 'Positive intent phrasing', suggestion: 'Reply within 1h with next-step (preview / call).' };
  if (/(no thanks|not interested|not now|all set|we'?re happy with|have one already|don'?t need)/.test(t))
    return { category: 'not-interested', reason: 'Clear soft no', suggestion: 'Mark status=dead. Thank them, do not push.' };
  if (/(too expensive|how much|can you|what about|but|though|however|hmm|not sure)/.test(t))
    return { category: 'objection', reason: 'Objection phrasing', suggestion: 'Address objection directly. Offer reassurance (no payment until approved).' };
  return { category: 'interested', reason: 'Default — review manually', suggestion: 'Open the reply and decide manually.' };
}

async function aiClassify(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 4000) },
      ],
    }),
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + await res.text());
  const data = await res.json();
  const json = data.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(json); } catch { return ruleClassify(text); }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['x-admin-password'];
  if (auth !== ADMIN) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  let text, fromEmail, prospectId;
  try { ({ text, fromEmail, prospectId } = JSON.parse(event.body || '{}')); } catch {}
  if (!text || !text.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'text required' }) };

  let result;
  let mode;
  try {
    result = OPENAI_KEY ? await aiClassify(text) : ruleClassify(text);
    mode = OPENAI_KEY ? 'ai' : 'rule';
  } catch (err) {
    result = ruleClassify(text);
    mode = 'rule-fallback';
    result.aiError = err.message;
  }

  // Auto-suppression: any unsubscribe-intent reply MUST hit the suppression
  // list immediately. Belt-and-braces: check both the AI category AND the
  // regex — if either says unsub, we suppress. Cheaper to over-suppress.
  let suppressed = false;
  const looksLikeUnsub = result.category === 'unsubscribe' || isUnsubReply(text);
  if (looksLikeUnsub && fromEmail) {
    try {
      await addSuppression(fromEmail, { reason: 'reply_unsubscribe', source: 'categorize-reply', prospectId });
      suppressed = true;
    } catch (e) {
      console.warn('[categorize-reply] auto-suppression failed:', e.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ...result, mode, autoSuppressed: suppressed }),
  };
};
