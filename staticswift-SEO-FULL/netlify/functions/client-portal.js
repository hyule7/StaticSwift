/*
 * client-portal.js
 * ----------------------------------------------------------------
 * Premium client portal — matches the cinematic feel of the marketing
 * site (Switzer + Cormorant typography, cyan/cream + ink dark mode,
 * spring-eased motion, breathing live indicators).
 *
 * What lives in here:
 *   • Project timeline visualisation (Brief → Build → Preview → Approve → Pay → Live).
 *   • Browser-shell preview iframe with desktop/mobile device toggle.
 *   • Quick reactions on the preview (🔥/🤔/❌) — fast, low-friction signal.
 *   • Signed approval (client types their name) → auto-fires invoice + admin alert.
 *   • Live message thread (polls every 25s for new admin replies, no refresh).
 *   • Asset / brand-kit upload zone (logo, photos, brief copy).
 *   • Project file vault (brief PDF, invoice, preview history, final delivery).
 *   • Add-ons upsell strip (hosting, copy polish, photography referral).
 *   • Bookmark / share prompt — clients lose portal links constantly.
 *
 * Every interaction posts to portal-response.js which records the event
 * AND fires a pipeline-stage update so the admin dashboard reflects state
 * in real time without me having to babysit the bin.
 */

const { getClients } = require('./_db');

exports.handler = async (event) => {
  const uuid = event.queryStringParameters?.uuid
    || event.path.replace(/.*\/client\/?/, '').replace(/\//g, '').trim();

  if (!uuid) return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: errorPage('No portal ID provided.') };

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === uuid);
    if (!client) return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: errorPage('This link has expired or does not exist.') };
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow',
      },
      body: buildPortal(client, uuid),
    };
  } catch (err) {
    console.error('[client-portal]', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: errorPage('Something went wrong. Contact support@staticswift.co.uk') };
  }
};

function errorPage(msg) {
  return `<!doctype html><html><head><meta charset="UTF-8"><title>StaticSwift</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#06070b;color:#f0f2f8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.box{max-width:420px}h2{margin-bottom:12px;font-weight:500;font-size:24px}p{color:#8890a8;font-size:15px;margin-top:8px;line-height:1.6}a{color:#7de8ff}</style></head>
  <body><div class="box"><h2>Portal not found</h2><p>${e(msg)}</p><p style="margin-top:18px"><a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a></p></div></body></html>`;
}

// ── Stage helpers ───────────────────────────────────────────────
const STAGE_ORDER = ['new-lead', 'building', 'preview-sent', 'approved', 'invoice-sent', 'paid', 'complete'];
const STAGE_LABELS = {
  'new-lead': 'Brief received',
  'building': 'Designing your site',
  'preview-sent': 'Preview ready',
  'approved': 'Approved',
  'invoice-sent': 'Invoice sent',
  'paid': 'Payment received',
  'complete': 'Delivered',
};

function stageIndex(s) {
  const i = STAGE_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (isNaN(t)) return '—';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calcPackagePrice(c) {
  const adv = c.package === 'advanced';
  const hosting = c.hosting_addon === 'yes';
  return (adv ? 299 : 149) + (hosting ? 29 : 0);
}

function buildTimeline(c) {
  const stages = [
    { key: 'new-lead',      label: 'Brief',       at: c.createdAt },
    { key: 'building',      label: 'Building',    at: c.buildStartedAt || c.createdAt },
    { key: 'preview-sent',  label: 'Preview',     at: c.previewSentAt },
    { key: 'approved',      label: 'Approved',    at: c.approvedAt },
    { key: 'invoice-sent',  label: 'Invoice',     at: c.invoiceSentAt },
    { key: 'paid',          label: 'Paid',        at: c.paidAt },
    { key: 'complete',      label: 'Delivered',   at: c.deliveredAt },
  ];
  const currentIdx = stageIndex(c.stage || 'new-lead');
  return stages.map((s, i) => ({
    ...s,
    done: i < currentIdx || (i === currentIdx && (c.stage === 'complete' || s.at)),
    current: i === currentIdx,
  }));
}

function buildActivity(c) {
  // Synthesised activity log from known timestamps.
  // Lightweight — no extra storage, just inferred from the client record.
  const events = [];
  const push = (at, kind, text) => at && events.push({ at, kind, text });
  push(c.createdAt, 'brief', 'Brief received — project queued for build');
  push(c.buildStartedAt, 'build', 'Started designing your site');
  push(c.previewSentAt, 'preview', 'Preview sent for your review');
  push(c.changeRequestAt, 'changes', 'Change request received — back in progress');
  push(c.approvedAt, 'approved', 'You approved the preview');
  push(c.invoiceSentAt, 'invoice', 'Invoice sent — £' + (c.amount || calcPackagePrice(c)));
  push(c.paidAt, 'paid', 'Payment confirmed — preparing final files');
  push(c.deliveredAt, 'delivered', 'Final files delivered');
  // Add any portal messages as inline activity
  const msgs = Array.isArray(c.portalMessages) ? c.portalMessages : [];
  msgs.forEach(m => {
    if (!m.sentAt) return;
    if (m.from === 'client' && m.type === 'message') push(m.sentAt, 'msg-out', 'You sent a message');
    else if (m.from === 'admin') push(m.sentAt, 'msg-in', 'Harry replied');
  });
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
}

function buildPortal(c, uuid) {
  const stage = c.stage || 'new-lead';
  const hasPreview = !!c.previewUrl;
  const hasFinal = !!c.finalUrl;
  const isPaid = stage === 'paid' || stage === 'complete' || !!c.paid;
  const isInvoiced = stage === 'invoice-sent' || isPaid;
  const isApproved = stage === 'approved' || isInvoiced;
  const isComplete = stage === 'complete' && hasFinal;
  const awaitingReview = hasPreview && !isApproved;
  const messages = Array.isArray(c.portalMessages) ? c.portalMessages : [];
  const assets = Array.isArray(c.clientAssets) ? c.clientAssets : [];
  const reactions = c.previewReactions || {};
  const timeline = buildTimeline(c);
  const activity = buildActivity(c);
  const firstName = (c.name || '').trim().split(/\s+/)[0] || 'there';
  const bizName = c.business_name || 'Your project';
  const price = calcPackagePrice(c);
  const promisedDelivery = c.createdAt
    ? new Date(Date.parse(c.createdAt) + 24 * 60 * 60 * 1000)
    : null;
  const revisionsUsed = (messages.filter(m => m.type === 'changes').length) || 0;
  const portalUrl = (process.env.URL || 'https://staticswift.co.uk') + '/client?uuid=' + uuid;

  return `<!doctype html>
<html lang="en-gb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<title>${e(bizName)} — StaticSwift</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#06070b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@1,400;1,500&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#06070b; --ink-2:#0c0f17; --ink-3:#141823; --ink-4:#1d2230;
  --paper:#f6f3ec;
  --cyan:#00c6ff; --cyan-2:#7de8ff; --cyan-dim:#00a0cc; --cyan-glow:rgba(0,168,216,.4);
  --gold:#d4af37;
  --green:#22c55e; --amber:#f59e0b; --red:#f87171;
  --text:#f0f2f8; --muted:#8890a8; --dim:#5a6072;
  --line:rgba(255,255,255,.07); --line-strong:rgba(255,255,255,.14);
  --r:14px; --r-lg:20px; --r-xl:28px;
  --spring:cubic-bezier(.19,1,.22,1);
  --shadow-soft:0 12px 30px rgba(0,0,0,.32);
  --shadow-strong:0 26px 60px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body{background:var(--ink);color:var(--text);font-family:'Switzer','Inter Tight',sans-serif;font-size:15.5px;line-height:1.55;font-weight:400;min-height:100vh;overflow-x:hidden}
.serif-i{font-family:'Cormorant',Georgia,serif;font-style:italic;font-weight:400}
a{color:var(--cyan-2);text-decoration:none;transition:color .25s var(--spring)}
a:hover{color:var(--cyan)}
button{font-family:inherit;cursor:pointer;border:0;background:none;color:inherit}
::selection{background:var(--cyan);color:var(--ink)}

/* ── Ambient backdrop ──────────────────────────────────────────── */
.bg-ambient{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.bg-ambient::before,.bg-ambient::after{content:'';position:absolute;width:60vw;height:60vw;border-radius:50%;filter:blur(80px);opacity:.18}
.bg-ambient::before{background:radial-gradient(circle,var(--cyan) 0%,transparent 60%);top:-15vw;left:-15vw;animation:drift 28s ease-in-out infinite alternate}
.bg-ambient::after{background:radial-gradient(circle,#7e4f37 0%,transparent 60%);bottom:-20vw;right:-15vw;animation:drift 36s ease-in-out infinite alternate-reverse}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(8vw,4vh) scale(1.1)}}

main,header,footer{position:relative;z-index:1}

/* ── Header ────────────────────────────────────────────────────── */
header{display:flex;align-items:center;justify-content:space-between;padding:18px clamp(16px,3vw,28px);border-bottom:1px solid var(--line);background:rgba(6,7,11,.7);backdrop-filter:blur(18px) saturate(1.4);position:sticky;top:0;z-index:50}
.brand{display:flex;align-items:center;gap:10px}
.brand-mark{width:30px;height:30px;display:grid;place-items:center;color:var(--cyan)}
.brand-mark svg{width:100%;height:100%;transition:transform .8s var(--spring)}
.brand:hover .brand-mark svg{transform:rotate(180deg)}
.brand-name{font-family:'Switzer','Inter Tight',sans-serif;font-size:14px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.brand-sub{font-size:10.5px;color:var(--dim);letter-spacing:.18em;text-transform:uppercase;margin-top:1px}

.head-live{display:flex;align-items:center;gap:10px;padding:8px 14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.22);border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--green)}
.head-live i{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:pulse 1.6s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}80%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

/* ── Hero ──────────────────────────────────────────────────────── */
.hero{padding:clamp(40px,7vw,72px) clamp(16px,4vw,28px) clamp(28px,4vw,48px);max-width:1100px;margin:0 auto;text-align:left}
.hero-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan-2);background:rgba(125,232,255,.06);border:1px solid rgba(125,232,255,.18);padding:7px 14px;border-radius:100px;margin-bottom:18px}
.hero-eyebrow i{width:5px;height:5px;border-radius:50%;background:var(--cyan-2)}
.hero h1{font-family:'Switzer','Inter Tight',sans-serif;font-size:clamp(34px,5.4vw,60px);font-weight:500;letter-spacing:-.03em;line-height:1.04;margin-bottom:14px}
.hero h1 em{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-2);font-weight:400}
.hero-lede{font-size:clamp(15px,1.4vw,17px);color:var(--muted);max-width:680px;line-height:1.65}

.hero-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:30px;max-width:840px}
.stat{background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;transition:all .35s var(--spring)}
.stat:hover{border-color:var(--cyan-dim);background:rgba(0,168,204,.06);transform:translateY(-2px)}
.stat-lbl{font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
.stat-val{font-size:24px;font-weight:500;letter-spacing:-.02em;color:var(--text)}
.stat-val.serif{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-2)}
.stat-meta{font-size:11.5px;color:var(--muted);margin-top:4px}

/* ── Timeline ──────────────────────────────────────────────────── */
.timeline-wrap{padding:0 clamp(16px,4vw,28px) clamp(28px,4vw,48px);max-width:1100px;margin:0 auto}
.timeline{position:relative;display:flex;align-items:flex-start;justify-content:space-between;padding:36px 6px 18px;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.005));border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.timeline::before{content:'';position:absolute;left:30px;right:30px;top:54px;height:2px;background:var(--line-strong);border-radius:2px}
.timeline-fill{position:absolute;left:30px;top:54px;height:2px;background:linear-gradient(90deg,var(--cyan-dim),var(--cyan),var(--cyan-2));border-radius:2px;transition:width 1.4s var(--spring);box-shadow:0 0 14px var(--cyan-glow)}
.ts{flex:1;min-width:0;position:relative;text-align:center;padding:0 8px}
.ts-dot{width:18px;height:18px;border-radius:50%;background:var(--ink);border:2px solid var(--line-strong);margin:0 auto 12px;position:relative;z-index:1;transition:all .5s var(--spring)}
.ts.done .ts-dot{background:var(--cyan);border-color:var(--cyan);box-shadow:0 0 0 4px rgba(0,198,255,.16)}
.ts.current .ts-dot{background:var(--ink);border-color:var(--cyan);box-shadow:0 0 0 4px rgba(0,198,255,.16),0 0 0 0 rgba(0,198,255,.4);animation:pulse 1.6s ease-out infinite}
.ts-label{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts.done .ts-label,.ts.current .ts-label{color:var(--text)}
.ts-meta{font-size:10.5px;color:var(--muted);min-height:14px}
@media(max-width:640px){
  .timeline{padding:24px 6px 12px}
  .timeline::before,.timeline-fill{left:22px;right:22px;top:42px}
  .ts-dot{width:14px;height:14px;margin-bottom:8px}
  .ts-label{font-size:9.5px;letter-spacing:.08em}
  .ts-meta{font-size:9.5px}
}

/* ── Main layout ───────────────────────────────────────────────── */
main{padding:0 clamp(16px,4vw,28px) clamp(40px,6vw,72px);max-width:1100px;margin:0 auto}
.grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:18px}
@media(max-width:880px){.grid{grid-template-columns:1fr}}

.card{background:rgba(13,16,24,.7);border:1px solid var(--line);border-radius:var(--r-lg);padding:24px;margin-bottom:18px;backdrop-filter:blur(12px);position:relative;overflow:hidden}
.card.span-2{grid-column:1/-1}
.card-eyebrow{display:flex;align-items:center;gap:10px;font-size:10.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan-dim);margin-bottom:18px}
.card-eyebrow .line{flex:1;height:1px;background:linear-gradient(90deg,var(--line-strong),transparent)}
.card h2{font-family:'Switzer','Inter Tight',sans-serif;font-size:24px;font-weight:500;letter-spacing:-.02em;margin-bottom:8px}
.card h2 em{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-2);font-weight:400}
.card-lede{font-size:14px;color:var(--muted);line-height:1.65;margin-bottom:18px}

/* ── Status badges ─────────────────────────────────────────────── */
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:100px;font-size:11.5px;font-weight:700;letter-spacing:.04em;margin-bottom:14px}
.badge i{width:6px;height:6px;border-radius:50%}
.b-amber{background:rgba(245,158,11,.1);color:var(--amber);border:1px solid rgba(245,158,11,.22)}
.b-amber i{background:var(--amber);animation:pulse 2s ease-out infinite}
.b-cyan{background:rgba(0,198,255,.1);color:var(--cyan-2);border:1px solid rgba(0,198,255,.22)}
.b-cyan i{background:var(--cyan-2);animation:pulse 2s ease-out infinite}
.b-green{background:rgba(34,197,94,.1);color:var(--green);border:1px solid rgba(34,197,94,.22)}
.b-green i{background:var(--green)}
.b-red{background:rgba(248,113,113,.1);color:var(--red);border:1px solid rgba(248,113,113,.22)}
.b-red i{background:var(--red)}

/* ── Preview shell ─────────────────────────────────────────────── */
.preview-shell{border:1px solid var(--line-strong);border-radius:var(--r-lg);overflow:hidden;background:#0d1018;margin-bottom:16px;box-shadow:var(--shadow-soft)}
.preview-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;background:#0a0d16;border-bottom:1px solid var(--line);font-size:12px;color:var(--muted)}
.preview-bar .dots{display:flex;gap:6px}
.preview-bar .dots i{width:10px;height:10px;border-radius:50%;display:block}
.preview-bar .url{flex:1;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:100px;padding:6px 14px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}
.preview-bar .device-toggle{display:flex;gap:4px}
.preview-bar .device-toggle button{background:transparent;border:1px solid var(--line);color:var(--muted);padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .25s var(--spring)}
.preview-bar .device-toggle button.on{background:rgba(0,198,255,.16);color:var(--cyan-2);border-color:rgba(0,198,255,.34)}
.preview-stage{padding:16px;background:#0d1018;display:flex;justify-content:center;align-items:flex-start;min-height:300px}
iframe.preview-frame{width:100%;height:680px;border:0;border-radius:8px;display:block;background:#fff;box-shadow:0 16px 40px rgba(0,0,0,.5);transition:width .45s var(--spring),height .45s var(--spring),border-radius .35s var(--spring),border-width .35s var(--spring)}
.preview-stage.is-mobile iframe.preview-frame{width:380px;height:740px;border-radius:32px;border:8px solid #1a1d28;box-shadow:0 22px 50px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.04)}
@media(max-width:560px){iframe.preview-frame{height:520px}.preview-stage.is-mobile iframe.preview-frame{width:100%;max-width:340px;height:600px;border-width:6px;border-radius:26px}}

.preview-open-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--cyan-2);margin-bottom:18px;font-weight:500}
.preview-open-link:hover{color:var(--cyan)}

/* ── Reactions ─────────────────────────────────────────────────── */
.reactions{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r);margin-bottom:18px}
.reactions-lbl{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);align-self:center;margin-right:6px}
.rx{background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--muted);padding:7px 14px;border-radius:100px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px;transition:all .25s var(--spring);cursor:pointer}
.rx:hover{border-color:var(--cyan-dim);color:var(--cyan-2);background:rgba(0,168,204,.1);transform:translateY(-1px)}
.rx.on{background:rgba(0,198,255,.14);border-color:rgba(0,198,255,.4);color:var(--cyan-2)}
.rx-count{font-size:11.5px;color:var(--muted);font-weight:600;font-variant-numeric:tabular-nums}

/* ── Action buttons / forms ────────────────────────────────────── */
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
@media(max-width:520px){.btn-row{grid-template-columns:1fr}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 22px;border-radius:100px;font-size:14px;font-weight:600;letter-spacing:.01em;cursor:pointer;font-family:inherit;transition:all .35s var(--spring);border:1.5px solid transparent;width:100%}
.btn-cyan{background:linear-gradient(135deg,#7de8ff,#00c6ff);color:var(--ink);box-shadow:0 10px 28px rgba(0,168,216,.4)}
.btn-cyan:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(0,168,216,.55)}
.btn-ghost{background:rgba(255,255,255,.04);border:1.5px solid var(--line-strong);color:var(--text)}
.btn-ghost:hover{border-color:var(--cyan-dim);background:rgba(0,168,204,.08);color:var(--cyan-2)}
.btn-red{background:rgba(248,113,113,.08);border:1.5px solid rgba(248,113,113,.32);color:var(--red)}
.btn-red:hover{background:rgba(248,113,113,.14);border-color:var(--red)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.btn .arrow{transition:transform .35s var(--spring)}
.btn:hover .arrow{transform:translateX(3px)}

.panel{margin-top:14px;display:none;padding:18px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r)}
.panel.open{display:block;animation:slideIn .45s var(--spring) both}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

label.field-lbl{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:8px}
textarea,input[type=text],input[type=email]{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--text);font-family:inherit;font-size:14px;padding:12px 14px;border-radius:10px;line-height:1.6;outline:none;transition:all .25s var(--spring)}
textarea{min-height:96px;resize:vertical}
textarea:focus,input[type=text]:focus,input[type=email]:focus{border-color:var(--cyan-dim);background:rgba(0,168,204,.06);box-shadow:0 0 0 3px rgba(0,168,204,.12)}

.flash{margin-top:12px;padding:12px 16px;border-radius:10px;font-size:13.5px;line-height:1.5;display:none;animation:slideIn .45s var(--spring) both}
.flash.show{display:block}
.flash-ok{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);color:var(--green)}
.flash-err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);color:var(--red)}

/* ── Signed approval ───────────────────────────────────────────── */
.sig-block{padding:18px;background:linear-gradient(160deg,rgba(0,198,255,.06),rgba(125,232,255,.02));border:1px solid rgba(0,198,255,.22);border-radius:var(--r);margin-top:14px}
.sig-line{position:relative;padding-bottom:6px;margin-bottom:8px;border-bottom:1.5px solid var(--cyan-dim)}
.sig-line input{background:transparent;border:0;font-family:'Cormorant',Georgia,serif;font-style:italic;font-size:30px;color:var(--cyan-2);padding:4px 0;font-weight:400;width:100%}
.sig-line input:focus{outline:none}
.sig-line input::placeholder{color:var(--dim);opacity:.45}
.sig-helper{font-size:11px;color:var(--muted);letter-spacing:.06em}

/* ── Messages ──────────────────────────────────────────────────── */
.msg-list{display:flex;flex-direction:column;gap:12px;margin-bottom:18px;max-height:520px;overflow-y:auto;padding-right:6px}
.msg-list::-webkit-scrollbar{width:6px}
.msg-list::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:6px}
.msg{padding:14px 16px;border-radius:14px;font-size:14px;line-height:1.6;animation:msgIn .55s var(--spring) both}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-from{background:rgba(0,198,255,.06);border:1px solid rgba(0,198,255,.18);align-self:flex-end;max-width:88%;border-bottom-right-radius:4px}
.msg-in{background:rgba(255,255,255,.03);border:1px solid var(--line);align-self:flex-start;max-width:88%;border-bottom-left-radius:4px}
.msg-meta{font-size:10.5px;color:var(--dim);margin-bottom:6px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.msg-meta .avatar{width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#7de8ff,#00c6ff);color:var(--ink);font-weight:700;display:grid;place-items:center;font-size:9.5px;letter-spacing:0}
.msg-empty{padding:30px 16px;text-align:center;color:var(--dim);font-size:13px;background:rgba(255,255,255,.02);border:1px dashed var(--line);border-radius:var(--r)}
.compose{display:flex;flex-direction:column;gap:10px}
.compose-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--dim)}

/* ── File vault ────────────────────────────────────────────────── */
.files{display:flex;flex-direction:column;gap:8px}
.file{display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r);transition:all .25s var(--spring)}
.file:hover{border-color:var(--cyan-dim);background:rgba(0,168,204,.06);transform:translateY(-1px)}
.file-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:rgba(0,198,255,.1);color:var(--cyan-2);flex-shrink:0}
.file-info{flex:1;min-width:0}
.file-name{font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-meta{font-size:11.5px;color:var(--muted)}
.file-action{font-size:12px;color:var(--cyan-2);font-weight:600;letter-spacing:.04em;padding:6px 12px;border-radius:100px;border:1px solid rgba(0,198,255,.3)}
.file-action:hover{background:rgba(0,198,255,.1)}

/* ── Activity feed ─────────────────────────────────────────────── */
.act-list{display:flex;flex-direction:column;gap:0;position:relative}
.act-list::before{content:'';position:absolute;left:11px;top:8px;bottom:8px;width:1.5px;background:linear-gradient(180deg,var(--cyan-dim) 0%,var(--line-strong) 60%);opacity:.4}
.act{display:grid;grid-template-columns:24px 1fr auto;gap:14px;padding:10px 0;position:relative;align-items:center}
.act-dot{width:10px;height:10px;border-radius:50%;background:var(--ink-3);border:2px solid var(--cyan-dim);margin-left:7px;position:relative;z-index:1}
.act:first-child .act-dot{background:var(--cyan);border-color:var(--cyan)}
.act-txt{font-size:13.5px;color:var(--text);line-height:1.5}
.act-when{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}

/* ── Assets / brand-kit upload ─────────────────────────────────── */
.drop{position:relative;border:1.5px dashed var(--line-strong);border-radius:var(--r-lg);padding:30px 20px;text-align:center;background:rgba(255,255,255,.025);transition:all .25s var(--spring);cursor:pointer}
.drop:hover,.drop.over{border-color:var(--cyan-dim);background:rgba(0,168,204,.06)}
.drop-ico{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;background:rgba(0,198,255,.1);color:var(--cyan-2);margin:0 auto 12px}
.drop-h{font-size:15px;font-weight:600;margin-bottom:4px}
.drop-sub{font-size:12.5px;color:var(--muted)}
.drop input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
.asset-list{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.asset{display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:10px;font-size:13px}
.asset .ico{width:18px;height:18px;color:var(--cyan-2)}
.asset-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.asset-size{font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums}

/* ── Add-ons strip ─────────────────────────────────────────────── */
.addons{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.addon{padding:18px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r);transition:all .35s var(--spring);position:relative;overflow:hidden}
.addon::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 30%,rgba(0,198,255,.04) 50%,transparent 70%);transform:translateX(-110%);transition:transform .8s var(--spring)}
.addon:hover{transform:translateY(-3px);border-color:var(--cyan-dim);box-shadow:0 14px 30px rgba(0,0,0,.25)}
.addon:hover::after{transform:translateX(110%)}
.addon-h{font-size:15px;font-weight:600;margin-bottom:4px}
.addon-h em{font-family:'Cormorant',Georgia,serif;font-style:italic;color:var(--cyan-2);font-weight:400}
.addon-p{font-size:13px;color:var(--muted);line-height:1.55;margin-bottom:10px}
.addon-price{font-family:'Cormorant',Georgia,serif;font-style:italic;font-size:22px;color:var(--cyan-2)}
.addon-cta{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:.06em;color:var(--text);margin-top:8px}
.addon-cta:hover{color:var(--cyan-2)}

/* ── Share / bookmark ─────────────────────────────────────────── */
.share{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;background:linear-gradient(135deg,rgba(0,198,255,.06),rgba(125,232,255,.02));border:1px solid rgba(0,198,255,.18);border-radius:var(--r);margin-bottom:18px;flex-wrap:wrap}
.share-txt{font-size:13.5px;color:var(--text);line-height:1.5;flex:1;min-width:220px}
.share-actions{display:flex;gap:8px;flex-wrap:wrap}
.share-btn{background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--text);padding:8px 14px;border-radius:100px;font-size:12px;font-weight:600;cursor:pointer;transition:all .25s var(--spring);font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.share-btn:hover{border-color:var(--cyan-dim);background:rgba(0,168,204,.08)}

/* ── Support ───────────────────────────────────────────────────── */
.support{display:flex;align-items:center;gap:14px;padding:18px 20px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:var(--r);margin-bottom:18px}
.support-avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#7de8ff,#00c6ff);color:var(--ink);font-weight:700;font-size:18px;display:grid;place-items:center;flex-shrink:0}
.support-name{font-size:14px;font-weight:600;margin-bottom:2px}
.support-sub{font-size:12.5px;color:var(--muted)}
.support a{font-weight:600}

/* ── Toast (live notifications) ────────────────────────────────── */
.toast-stack{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:200;pointer-events:none}
.toast{background:rgba(13,16,24,.95);border:1px solid var(--line-strong);border-radius:14px;padding:14px 18px;font-size:13px;color:var(--text);max-width:340px;box-shadow:var(--shadow-strong);backdrop-filter:blur(12px);display:flex;gap:12px;align-items:flex-start;animation:toastIn .5s var(--spring) both;pointer-events:auto}
.toast .ico{flex-shrink:0;color:var(--cyan-2);margin-top:1px}
@keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.toast.dismiss{animation:toastOut .35s var(--spring) both}
@keyframes toastOut{to{opacity:0;transform:translateY(-10px)}}

/* ── Reveal-on-scroll ──────────────────────────────────────────── */
.reveal{opacity:0;transform:translateY(24px);transition:opacity .9s var(--spring),transform .9s var(--spring)}
.reveal.in{opacity:1;transform:translateY(0)}
@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}}

/* ── Footer ────────────────────────────────────────────────────── */
footer{padding:32px clamp(16px,4vw,28px);text-align:center;font-size:12px;color:var(--dim);border-top:1px solid var(--line)}
footer .row{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:8px}
footer .row a{color:var(--muted)}
footer .row a:hover{color:var(--cyan-2)}
</style>
</head>
<body>

<div class="bg-ambient"></div>

<header>
  <a class="brand" href="https://staticswift.co.uk" target="_blank" rel="noopener">
    <span class="brand-mark">
      <svg viewBox="0 0 28 28" fill="none" width="30" height="30"><polygon points="14,1 27,7.5 27,20.5 14,27 1,20.5 1,7.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/><polygon points="14,6 22,10 22,18 14,22 6,18 6,10" fill="currentColor" opacity=".18"/><polygon points="14,10 18,12 18,16 14,18 10,16 10,12" fill="currentColor" opacity=".55"/></svg>
    </span>
    <span>
      <div class="brand-name">StaticSwift</div>
      <div class="brand-sub">Client portal</div>
    </span>
  </a>
  <div class="head-live"><i></i> Live · synced</div>
</header>

<section class="hero reveal">
  <div class="hero-eyebrow"><i></i> <span>${e(STAGE_LABELS[stage] || stage)}</span></div>
  <h1>Welcome back, <em>${e(firstName)}</em>.</h1>
  <p class="hero-lede">Everything about your <strong>${e(bizName)}</strong> project lives here — your preview, every message, every file. Real-time, no refresh required.</p>

  <div class="hero-stats">
    <div class="stat">
      <div class="stat-lbl">Project</div>
      <div class="stat-val">${e(c.package === 'advanced' ? 'Advanced' : 'Starter')}</div>
      <div class="stat-meta">£${price} · One-time payment</div>
    </div>
    <div class="stat">
      <div class="stat-lbl">Started</div>
      <div class="stat-val serif">${e(fmtDate(c.createdAt))}</div>
      <div class="stat-meta">${e(relTime(c.createdAt))}</div>
    </div>
    <div class="stat">
      <div class="stat-lbl">Delivery target</div>
      <div class="stat-val serif">${promisedDelivery ? e(fmtDate(promisedDelivery.toISOString())) : '24h after brief'}</div>
      <div class="stat-meta">Preview within 24 hours</div>
    </div>
    <div class="stat">
      <div class="stat-lbl">Revisions used</div>
      <div class="stat-val">${revisionsUsed}<span style="font-size:14px;color:var(--muted);font-weight:400"> / 1 free</span></div>
      <div class="stat-meta">${revisionsUsed === 0 ? 'Full revision still available' : 'Extra revisions £29 each'}</div>
    </div>
  </div>
</section>

<div class="timeline-wrap reveal">
  <div class="timeline" id="timeline">
    <div class="timeline-fill" id="timeline-fill" style="width:0%"></div>
    ${timeline.map(t => `
      <div class="ts ${t.done ? 'done' : ''} ${t.current ? 'current' : ''}">
        <div class="ts-dot"></div>
        <div class="ts-label">${e(t.label)}</div>
        <div class="ts-meta">${t.at ? e(fmtDate(t.at)) : ''}</div>
      </div>
    `).join('')}
  </div>
</div>

<main>

  <div class="grid">
    <div>

      ${/* STATUS / PREVIEW CARD */
        isComplete ? `
      <div class="card reveal">
        <div class="card-eyebrow">Delivery <span class="line"></span></div>
        <span class="badge b-green"><i></i> Paid &amp; delivered</span>
        <h2>Your site is <em>live in your hands</em>.</h2>
        <p class="card-lede">Files delivered. Use the guide to upload, or let us host it for you.</p>
        <div class="btn-row" style="grid-template-columns:1fr 1fr">
          <a class="btn btn-cyan" href="${e(c.finalUrl)}" download>Download files <span class="arrow">↓</span></a>
          <a class="btn btn-ghost" href="https://staticswift.co.uk/how-to-upload.html" target="_blank" rel="noopener">Upload guide <span class="arrow">↗</span></a>
        </div>
      </div>` : isPaid ? `
      <div class="card reveal">
        <div class="card-eyebrow">Delivery <span class="line"></span></div>
        <span class="badge b-green"><i></i> Paid — preparing files</span>
        <h2>Payment received. <em>Files inbound</em>.</h2>
        <p class="card-lede">Your final files arrive within 1 hour. We'll email you and update this page the moment they're ready.</p>
      </div>` : isInvoiced ? `
      <div class="card reveal">
        <div class="card-eyebrow">Invoice <span class="line"></span></div>
        <span class="badge b-cyan"><i></i> Invoice sent — awaiting payment</span>
        <h2>One step to <em>go live</em>.</h2>
        <p class="card-lede">Invoice landed in ${e(c.delivery_email)}. Settle by bank transfer (or card on request) and your files land within the hour.</p>
        <div class="btn-row" style="grid-template-columns:1fr 1fr">
          <a class="btn btn-cyan" href="mailto:${e(process.env.SMTP_USER || 'hello@staticswift.co.uk')}?subject=Resend invoice — ${encodeURIComponent(bizName)}">Resend invoice <span class="arrow">↗</span></a>
          <a class="btn btn-ghost" href="mailto:${e(process.env.SMTP_USER || 'hello@staticswift.co.uk')}?subject=Pay by card — ${encodeURIComponent(bizName)}">Pay by card <span class="arrow">↗</span></a>
        </div>
      </div>` : awaitingReview ? `
      <div class="card reveal">
        <div class="card-eyebrow">Preview <span class="line"></span></div>
        <span class="badge b-cyan"><i></i> Ready for your review</span>
        <h2>Your <em>${e(bizName)}</em> site is built.</h2>
        <p class="card-lede">Click through every link. Try it on desktop and on your phone. One free revision is included — use it.</p>

        <div class="preview-shell">
          <div class="preview-bar">
            <div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
            <div class="url" title="${e(c.previewUrl)}">${e(c.previewUrl)}</div>
            <div class="device-toggle">
              <button type="button" class="on" onclick="ssDevice('desktop',this)">Desktop</button>
              <button type="button" onclick="ssDevice('mobile',this)">Mobile</button>
            </div>
          </div>
          <div class="preview-stage" id="preview-stage">
            <iframe class="preview-frame" src="${e(c.previewUrl)}" loading="lazy" title="Preview" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>
          </div>
        </div>
        <a class="preview-open-link" href="${e(c.previewUrl)}" target="_blank" rel="noopener">Open full-screen in a new tab →</a>

        <div class="reactions" id="reactions">
          <span class="reactions-lbl">First take</span>
          ${['🔥 Love it', '🤔 Hmm', '✨ Nice touches', '❌ Issues'].map((r, i) => {
            const key = ['love','hmm','nice','issues'][i];
            const count = reactions[key] || 0;
            return `<button class="rx" data-rx="${key}">${e(r)}${count ? ` <span class="rx-count">${count}</span>` : ''}</button>`;
          }).join('')}
        </div>

        <div class="btn-row">
          <button class="btn btn-cyan" onclick="ssShow('approve')">Approve preview <span class="arrow">→</span></button>
          <button class="btn btn-red" onclick="ssShow('changes')">Request changes</button>
        </div>

        <div class="panel" id="panel-approve">
          <label class="field-lbl" for="txt-approve">Anything you'd like to say? (optional)</label>
          <textarea id="txt-approve" placeholder="e.g. Love the gold accents. Ship it."></textarea>
          <div class="sig-block">
            <div class="sig-line"><input type="text" id="sig-name" placeholder="${e(c.name || 'Your full name')}" autocomplete="name"></div>
            <div class="sig-helper">Type your full name to confirm — this counts as a digital sign-off and triggers your invoice automatically.</div>
          </div>
          <button class="btn btn-cyan" style="margin-top:12px" onclick="ssSend('approve')">Confirm approval <span class="arrow">→</span></button>
        </div>

        <div class="panel" id="panel-changes">
          <label class="field-lbl" for="txt-changes">Be specific — the more detail, the better the next round.</label>
          <textarea id="txt-changes" placeholder="e.g. Hero headline could be bigger. Move the gallery above the prices. Use the gold for the CTA, not cyan."></textarea>
          <button class="btn btn-ghost" style="margin-top:12px" onclick="ssSend('changes')">Send change request <span class="arrow">→</span></button>
        </div>

        <div class="flash flash-ok" id="flash-ok"></div>
        <div class="flash flash-err" id="flash-err"></div>
      </div>` : isApproved ? `
      <div class="card reveal">
        <div class="card-eyebrow">Status <span class="line"></span></div>
        <span class="badge b-cyan"><i></i> Approved — invoice incoming</span>
        <h2>Signed off. <em>Invoice on the way</em>.</h2>
        <p class="card-lede">Thanks for the approval. Your invoice lands in the next few minutes.</p>
      </div>` : hasPreview ? `
      <div class="card reveal">
        <div class="card-eyebrow">Preview <span class="line"></span></div>
        <span class="badge b-amber"><i></i> Awaiting your review</span>
        <h2>Your preview is <em>here</em>.</h2>
        <p class="card-lede">Click through it, take your time. Use the message box below if you have any questions.</p>
        <div class="preview-shell">
          <div class="preview-bar">
            <div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
            <div class="url" title="${e(c.previewUrl)}">${e(c.previewUrl)}</div>
            <div class="device-toggle">
              <button type="button" class="on" onclick="ssDevice('desktop',this)">Desktop</button>
              <button type="button" onclick="ssDevice('mobile',this)">Mobile</button>
            </div>
          </div>
          <div class="preview-stage" id="preview-stage">
            <iframe class="preview-frame" src="${e(c.previewUrl)}" loading="lazy" title="Preview" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>
          </div>
        </div>
        <a class="preview-open-link" href="${e(c.previewUrl)}" target="_blank" rel="noopener">Open full-screen in a new tab →</a>
      </div>` : `
      <div class="card reveal">
        <div class="card-eyebrow">In progress <span class="line"></span></div>
        <span class="badge b-amber"><i></i> Building your site</span>
        <h2>We're <em>writing your code</em>.</h2>
        <p class="card-lede">Every line of HTML on your site is hand-written — no templates, no drag-drop builders. You'll get an email the moment your preview is ready (usually within 24h of brief).</p>
        <div class="share">
          <div class="share-txt"><strong>Want to keep tabs?</strong> Bookmark this page or send the link to a partner who needs to weigh in.</div>
          <div class="share-actions">
            <button class="share-btn" onclick="ssCopyLink(this)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy link</button>
          </div>
        </div>
      </div>`}

      <!-- MESSAGE THREAD — polls for new admin replies live -->
      <div class="card reveal" id="card-messages">
        <div class="card-eyebrow">Direct line <span class="line"></span> <span id="msg-livetag" style="font-size:10px;color:var(--green);letter-spacing:.1em;display:none">● LIVE</span></div>
        <h2>Talk to <em>Harry</em>.</h2>
        <p class="card-lede">Real designer, not a chatbot. Replies usually arrive within an hour during the day — every message lands in your inbox too.</p>

        <div class="msg-list" id="msg-list">
          ${messages.length === 0 ? `<div class="msg-empty">No messages yet. Use the box below to ask anything.</div>` :
            messages.map(m => `
              <div class="msg ${m.from === 'client' ? 'msg-from' : 'msg-in'}">
                <div class="msg-meta">
                  <span class="avatar">${m.from === 'client' ? e(firstName.charAt(0).toUpperCase()) : 'H'}</span>
                  ${m.from === 'client' ? e(c.name || 'You') : 'Harry'} · ${e(relTime(m.sentAt))}
                </div>
                <div>${e(m.notes || m.text || '').replace(/\n/g, '<br>')}</div>
              </div>
            `).join('')
          }
        </div>

        <div class="compose">
          <textarea id="txt-message" placeholder="Type a message… (Shift+Enter for new line, Enter to send)"></textarea>
          <div class="compose-foot">
            <span>Press <kbd style="font-family:inherit;background:rgba(255,255,255,.06);border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:11px">⏎</kbd> to send</span>
            <button class="btn btn-ghost" style="width:auto;padding:10px 22px" onclick="ssSend('message')">Send message <span class="arrow">→</span></button>
          </div>
          <div class="flash flash-ok" id="flash-msg-ok">Sent. Harry sees this right away.</div>
          <div class="flash flash-err" id="flash-msg-err"></div>
        </div>
      </div>

    </div>

    <div>

      <!-- SHARE / BOOKMARK -->
      <div class="share reveal">
        <div class="share-txt"><strong>Bookmark this page</strong> — it's the fastest way back. Or copy the link to invite a partner who needs to approve.</div>
        <div class="share-actions">
          <button class="share-btn" onclick="ssCopyLink(this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Copy link
          </button>
        </div>
      </div>

      <!-- PROJECT TIMELINE / ACTIVITY -->
      <div class="card reveal">
        <div class="card-eyebrow">Activity <span class="line"></span></div>
        <h2>Project <em>activity</em>.</h2>
        <p class="card-lede">Every checkpoint, message and revision — kept in one place.</p>
        <div class="act-list">
          ${activity.length === 0 ? `<div class="act"><div class="act-dot"></div><div class="act-txt">Your project hasn't started yet — we'll start the moment your brief is in.</div><div class="act-when"></div></div>` :
            activity.map(a => `
              <div class="act">
                <div class="act-dot"></div>
                <div class="act-txt">${e(a.text)}</div>
                <div class="act-when">${e(relTime(a.at))}</div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- BRAND ASSETS UPLOAD -->
      <div class="card reveal">
        <div class="card-eyebrow">Brand kit <span class="line"></span></div>
        <h2>Drop your <em>brand assets</em>.</h2>
        <p class="card-lede">Logo, photos, brand colours, anything we should use. Drop or browse — they go straight to Harry.</p>
        <div class="drop" id="drop">
          <div class="drop-ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div class="drop-h">Drag &amp; drop files</div>
          <div class="drop-sub">or click to browse · PNG, JPG, PDF, ZIP · 8 MB max</div>
          <input type="file" id="drop-input" multiple accept="image/*,.pdf,.zip,.svg">
        </div>
        <div class="asset-list" id="asset-list">
          ${assets.map(a => `
            <div class="asset">
              <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span class="asset-name" title="${e(a.name)}">${e(a.name)}</span>
              <span class="asset-size">${e(humanSize(a.bytes))}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- FILE VAULT -->
      <div class="card reveal">
        <div class="card-eyebrow">Files <span class="line"></span></div>
        <h2>Your <em>file vault</em>.</h2>
        <p class="card-lede">Everything we've shared with you, in one place.</p>
        <div class="files">
          ${hasPreview ? `<div class="file">
            <div class="file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
            <div class="file-info"><div class="file-name">Live preview</div><div class="file-meta">Updated ${e(relTime(c.previewSentAt))}</div></div>
            <a class="file-action" href="${e(c.previewUrl)}" target="_blank" rel="noopener">Open</a>
          </div>` : ''}
          ${hasFinal ? `<div class="file">
            <div class="file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
            <div class="file-info"><div class="file-name">Final site files</div><div class="file-meta">ZIP · delivered ${e(relTime(c.deliveredAt))}</div></div>
            <a class="file-action" href="${e(c.finalUrl)}" download>Download</a>
          </div>` : ''}
          ${c.invoiceSentAt ? `<div class="file">
            <div class="file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg></div>
            <div class="file-info"><div class="file-name">Invoice ${e(c.invoiceNumber || '')}</div><div class="file-meta">£${c.amount || price} · ${e(relTime(c.invoiceSentAt))}</div></div>
            <a class="file-action" href="mailto:${e(process.env.SMTP_USER || 'hello@staticswift.co.uk')}?subject=Resend invoice — ${encodeURIComponent(bizName)}">Resend</a>
          </div>` : ''}
          ${(!hasPreview && !hasFinal && !c.invoiceSentAt) ? `<div class="msg-empty">Your file vault populates as your project moves through stages.</div>` : ''}
        </div>
      </div>

      <!-- ADD-ONS / UPSELL -->
      ${!isComplete ? `
      <div class="card reveal">
        <div class="card-eyebrow">Add-ons <span class="line"></span></div>
        <h2>Want to <em>add more</em>?</h2>
        <p class="card-lede">Optional polish, no obligation. Hit a tile and we'll send you a quote.</p>
        <div class="addons">
          ${c.hosting_addon !== 'yes' ? `<div class="addon" onclick="ssAddon('hosting')">
            <div class="addon-h">Hosted by <em>us</em></div>
            <p class="addon-p">We upload to Netlify, connect your domain, set up SSL. Done in an hour.</p>
            <div class="addon-price">£29</div>
            <span class="addon-cta">Add to my project →</span>
          </div>` : ''}
          <div class="addon" onclick="ssAddon('copy')">
            <div class="addon-h"><em>Copy</em> polish</div>
            <p class="addon-p">A copywriter rewrites your hero, services and CTAs to convert harder.</p>
            <div class="addon-price">£79</div>
            <span class="addon-cta">Quote me →</span>
          </div>
          <div class="addon" onclick="ssAddon('photos')">
            <div class="addon-h"><em>Photography</em></div>
            <p class="addon-p">We connect you with a local photographer for proper, on-brand shots.</p>
            <div class="addon-price">From £180</div>
            <span class="addon-cta">Quote me →</span>
          </div>
          <div class="addon" onclick="ssAddon('seo')">
            <div class="addon-h"><em>SEO</em> boost</div>
            <p class="addon-p">Local schema, GSC setup, sitemap, fast-track Google indexing.</p>
            <div class="addon-price">£99</div>
            <span class="addon-cta">Quote me →</span>
          </div>
        </div>
      </div>` : `
      <div class="card reveal">
        <div class="card-eyebrow">Spread the word <span class="line"></span></div>
        <h2>Know someone who'd <em>love</em> this?</h2>
        <p class="card-lede">Refer a friend → <strong>they get 10% off, you get £50 back</strong>. Just hit the button — we'll handle the rest.</p>
        <button class="btn btn-cyan" onclick="ssAddon('referral')">Refer a friend <span class="arrow">→</span></button>
      </div>`}

      <!-- SUPPORT -->
      <div class="support reveal">
        <div class="support-avatar">H</div>
        <div>
          <div class="support-name">Harry · your designer</div>
          <div class="support-sub">Stuck? <a href="mailto:support@staticswift.co.uk">Email support</a> · <a href="https://wa.me/447502731799" target="_blank" rel="noopener">WhatsApp</a></div>
        </div>
      </div>

    </div>
  </div>

</main>

<footer>
  <div>© StaticSwift · <span class="serif-i">handmade in Manchester</span></div>
  <div class="row">
    <a href="https://staticswift.co.uk" target="_blank" rel="noopener">staticswift.co.uk</a>
    <a href="mailto:support@staticswift.co.uk">support@staticswift.co.uk</a>
    <a href="https://wa.me/447502731799" target="_blank" rel="noopener">WhatsApp</a>
  </div>
</footer>

<div class="toast-stack" id="toast-stack"></div>

<script>
const UUID = '${e(uuid)}';
const PORTAL_URL = '${e(portalUrl)}';
const STAGE_NOW = '${e(stage)}';
const CURRENT_STAGE_IDX = ${stageIndex(stage)};
const STAGE_COUNT = ${timeline.length};
let lastMessageCount = ${messages.length};

// ── Reveal-on-scroll ──────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── Animated timeline fill ────────────────────────────────────
requestAnimationFrame(() => {
  const fill = document.getElementById('timeline-fill');
  if (!fill || STAGE_COUNT < 2) return;
  // Position the fill end at the dot of the current stage
  const pct = Math.min(100, (CURRENT_STAGE_IDX / (STAGE_COUNT - 1)) * 100);
  setTimeout(() => { fill.style.width = pct + '%'; }, 280);
});

// ── Device toggle ────────────────────────────────────────────
function ssDevice(mode, btn) {
  const stage = document.getElementById('preview-stage');
  if (!stage) return;
  stage.classList.toggle('is-mobile', mode === 'mobile');
  const wrap = btn && btn.parentElement;
  if (wrap) wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
}

// ── Panel show/hide for approve / changes ────────────────────
function ssShow(type) {
  ['approve','changes'].forEach(t => {
    const el = document.getElementById('panel-' + t);
    if (el) el.classList.toggle('open', t === type);
  });
  setTimeout(() => {
    const el = document.getElementById('panel-' + type);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 60);
}

// ── Send (approve / changes / message / reaction / addon) ────
async function ssSend(type, extra) {
  let notes = '';
  let signature = '';
  let btn;
  if (type === 'approve') {
    notes = (document.getElementById('txt-approve') || {}).value || '';
    signature = (document.getElementById('sig-name') || {}).value || '';
    if (!signature.trim()) { ssFlash('err', 'Type your name to sign off.'); return; }
    btn = document.querySelector('#panel-approve .btn');
  } else if (type === 'changes') {
    notes = (document.getElementById('txt-changes') || {}).value || '';
    if (!notes.trim()) { ssFlash('err', 'Tell us what you would like changed — even a sentence helps.'); return; }
    btn = document.querySelector('#panel-changes .btn');
  } else if (type === 'message') {
    notes = (document.getElementById('txt-message') || {}).value || '';
    if (!notes.trim()) { ssFlash('msg-err', 'Write a message first.'); return; }
    btn = document.querySelector('[onclick="ssSend(\\'message\\')"]');
  } else if (type === 'reaction' || type === 'addon' || type === 'asset') {
    // pass-through — extra holds the payload
  }
  if (btn) { btn.disabled = true; const orig = btn.innerHTML; btn.dataset.orig = orig; btn.innerHTML = 'Sending…'; }

  try {
    const payload = { portalUUID: UUID, type, notes, signature, ...(extra || {}) };
    const r = await fetch('/.netlify/functions/portal-response', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Server error');

    if (type === 'approve') {
      document.getElementById('panel-approve').classList.remove('open');
      ssToast('🎉 Approved', "Your invoice is on its way — usually within 60 seconds.");
      setTimeout(() => location.reload(), 1800);
    } else if (type === 'changes') {
      document.getElementById('panel-changes').classList.remove('open');
      ssToast('Got it', 'Change request received. New preview in 24h.');
      setTimeout(() => location.reload(), 1500);
    } else if (type === 'message') {
      document.getElementById('txt-message').value = '';
      ssAppendMessage({ from: 'client', notes, sentAt: new Date().toISOString() });
      ssFlash('msg-ok', 'Sent. Harry sees this right away.');
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.orig || 'Send message'; }
    } else if (type === 'reaction') {
      // already optimistic-rendered
    } else if (type === 'addon') {
      ssToast('Request sent', 'We will email you a quote within a few hours.');
    }
  } catch (err) {
    ssFlash(type === 'message' ? 'msg-err' : 'err', err.message || 'Network error.');
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.orig || 'Send'; }
  }
}

function ssFlash(id, msg) {
  const el = document.getElementById('flash-' + id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  el.style.display = 'block';
  setTimeout(() => { el.classList.remove('show'); el.style.display = 'none'; }, 6000);
}

// ── Toast ─────────────────────────────────────────────────────
function ssToast(title, body) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<div class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><strong>' + ssEsc(title) + '</strong><br><span style="color:var(--muted);font-size:12.5px">' + ssEsc(body) + '</span></div>';
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('dismiss'); setTimeout(() => t.remove(), 400); }, 6500);
}

function ssEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Reactions ─────────────────────────────────────────────────
document.querySelectorAll('[data-rx]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('on')) return; // one per user
    btn.classList.add('on');
    const span = btn.querySelector('.rx-count');
    const n = span ? (parseInt(span.textContent) || 0) + 1 : 1;
    if (span) span.textContent = n;
    else btn.insertAdjacentHTML('beforeend', ' <span class="rx-count">' + n + '</span>');
    ssSend('reaction', { key: btn.dataset.rx });
  });
});

// ── Copy portal link ──────────────────────────────────────────
function ssCopyLink(btn) {
  navigator.clipboard.writeText(PORTAL_URL).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  }).catch(() => ssToast('Copy failed', 'Long-press the URL bar instead.'));
}

// ── Add-on interest ───────────────────────────────────────────
function ssAddon(kind) {
  ssSend('addon', { addon: kind });
}

// ── Drop-zone upload ──────────────────────────────────────────
(function setupDrop(){
  const drop = document.getElementById('drop');
  const input = document.getElementById('drop-input');
  if (!drop || !input) return;
  const handle = (files) => {
    Array.from(files).forEach(f => {
      if (f.size > 8 * 1024 * 1024) { ssToast('Too big', f.name + ' is over 8 MB.'); return; }
      // We register the asset metadata in the bin so admin sees it.
      // Actual upload to blob is handled separately in portal-upload.
      const fd = new FormData();
      fd.append('file', f);
      fd.append('portalUUID', UUID);
      fetch('/.netlify/functions/portal-upload', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            const list = document.getElementById('asset-list');
            const item = document.createElement('div');
            item.className = 'asset';
            item.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="asset-name">' + ssEsc(f.name) + '</span><span class="asset-size">' + ssHumanSize(f.size) + '</span>';
            list.appendChild(item);
            ssToast('Uploaded', f.name + ' is in the brand kit.');
          } else {
            ssToast('Upload failed', d.error || 'Try again or email it to support@staticswift.co.uk');
          }
        })
        .catch(() => ssToast('Upload failed', 'Email it to support@staticswift.co.uk instead.'));
    });
  };
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files); });
  input.addEventListener('change', () => handle(input.files));
})();

function ssHumanSize(n){ if(n<1024)return n+'B'; if(n<1024*1024)return (n/1024).toFixed(1)+'KB'; return (n/1024/1024).toFixed(1)+'MB'; }

// ── Append a new message to the list ──────────────────────────
function ssAppendMessage(m, opts={}) {
  const list = document.getElementById('msg-list');
  if (!list) return;
  const empty = list.querySelector('.msg-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'msg ' + (m.from === 'client' ? 'msg-from' : 'msg-in');
  const av = m.from === 'client' ? '${e(firstName.charAt(0).toUpperCase())}' : 'H';
  const who = m.from === 'client' ? '${e(c.name || 'You').replace(/'/g, "\\'")}' : 'Harry';
  div.innerHTML = '<div class="msg-meta"><span class="avatar">' + ssEsc(av) + '</span>' + ssEsc(who) + ' · just now</div><div>' + ssEsc(m.notes || m.text || '').replace(/\\n/g,'<br>') + '</div>';
  list.appendChild(div);
  div.scrollIntoView({ behavior:'smooth', block:'end' });
  if (opts.notify) ssToast('New reply', who + ' just replied.');
}

// ── Live poll for new admin replies ───────────────────────────
async function ssPoll() {
  try {
    const r = await fetch('/.netlify/functions/portal-poll?uuid=' + encodeURIComponent(UUID) + '&since=' + lastMessageCount, { cache:'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    if (!d.ok || !Array.isArray(d.newMessages)) return;
    if (d.newMessages.length) {
      d.newMessages.forEach(m => ssAppendMessage(m, { notify: m.from === 'admin' }));
      lastMessageCount = d.totalCount;
      document.getElementById('msg-livetag').style.display = 'inline';
      setTimeout(() => { document.getElementById('msg-livetag').style.display = 'none'; }, 4000);
    }
    if (d.stage && d.stage !== STAGE_NOW) {
      // Stage changed server-side — soft refresh after a delay so the
      // user sees the new state without jank.
      ssToast('Updated', 'Your project moved to a new stage — refreshing…');
      setTimeout(() => location.reload(), 1600);
    }
  } catch (e) { /* offline — try again next tick */ }
}
setInterval(ssPoll, 25000);
// Fire one quick poll a few seconds in too, in case admin replied
// while the page was loading.
setTimeout(ssPoll, 4000);

// ── Enter-to-send in the message compose box ──────────────────
document.getElementById('txt-message')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    ssSend('message');
  }
});

// ── Page-visibility: re-poll on tab-focus so they see new msgs fast
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(ssPoll, 600);
});
</script>
</body>
</html>`;
}

function e(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function humanSize(n) {
  if (!n) return '';
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}
