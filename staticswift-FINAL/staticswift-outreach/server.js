require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// DB setup
const leadsDb = low(new FileSync('leads.json'));
const sentDb = low(new FileSync('sent_log.json'));
leadsDb.defaults({ leads: [], lastRun: null }).write();
sentDb.defaults({ sent: [], todayCount: 0, todayDate: null }).write();

const config = require('./outreach_config.json');
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || config.dailyLimit || 40);
const SENDER_NAME = process.env.SENDER_NAME || 'StaticSwift';

// ==========================================
// EMAIL TRANSPORT
// ==========================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  }
});

// ==========================================
// LEAD FINDER — Google Maps Places API
// ==========================================
async function findLeads(niche, city) {
  if (!MAPS_KEY) { console.log('No Google Maps API key — skipping lead finder'); return []; }
  const query = `${niche} in ${city} UK`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${MAPS_KEY}`;
  try {
    const { data } = await axios.get(url, { timeout: 8000 });
    return (data.results || []).slice(0, 60).map(p => ({
      id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      city,
      niche,
      rating: p.rating,
      reviewCount: p.user_ratings_total,
      websiteUrl: null,
      score: null,
      stage: 'new',
      addedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Places API error:', err.message);
    return [];
  }
}

// ==========================================
// WEBSITE SCORER
// ==========================================
async function scoreLead(lead) {
  if (!lead.websiteUrl) { lead.score = 0; lead.scoreDetails = ['No website']; return lead; }
  const checks = [];
  const start = Date.now();
  try {
    const { data: html } = await axios.get(lead.websiteUrl, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(html);
    const elapsed = Date.now() - start;
    if ($('meta[name="viewport"]').length) checks.push('mobile');
    if ($('title').text().trim().length > 0) checks.push('title');
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text.length > 500) checks.push('content');
    if (elapsed < 3000) checks.push('speed');
    lead.score = checks.length;
    lead.scoreDetails = checks;
    lead.loadTime = elapsed;
  } catch {
    lead.score = 1;
    lead.scoreDetails = ['Site unreachable or errors'];
  }
  return lead;
}

// ==========================================
// CLAUDE.AI PROMPT BUILDER
// ==========================================
function buildColdEmailPrompt(lead) {
  const issues = lead.score === 0
    ? 'They have no website at all.'
    : `Their website failed these checks: ${(lead.scoreDetails || []).filter(c => !['mobile','title','content','speed'].includes(c)).length ? lead.scoreDetails.join(', ') : 'poor mobile responsiveness, slow load time, thin content'}.`;
  return `Write a cold email under 100 words for a UK web design business called StaticSwift. The prospect is ${lead.name}, a ${lead.niche} in ${lead.city}. ${issues} StaticSwift builds professional websites from £149, one-time payment, no monthly fees, free support forever, money-back guarantee. Ask if they would like a free preview mockup. Sign off as ${SENDER_NAME} from StaticSwift, staticswift.co.uk. No bold text. No em dashes. Plain conversational English.`;
}

// ==========================================
// SEND EMAIL
// ==========================================
async function sendColdEmail(lead, subject, body) {
  const sentLog = sentDb.get('sent').value();
  const alreadySent = sentLog.filter(s => s.email === lead.email).length;
  if (alreadySent >= 2) { console.log('Max contacts reached for', lead.email); return false; }
  const today = new Date().toDateString();
  if (sentDb.get('todayDate').value() !== today) {
    sentDb.set('todayCount', 0).set('todayDate', today).write();
  }
  if (sentDb.get('todayCount').value() >= DAILY_LIMIT) { console.log('Daily limit reached'); return false; }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME} — StaticSwift" <${process.env.GMAIL_USER}>`,
      to: lead.email,
      subject,
      html: `<div style="font-family:sans-serif;max-width:560px;font-size:15px;line-height:1.7;color:#333">${body.replace(/\n/g,'<br>')}</div>`
    });
    sentDb.get('sent').push({ id: Date.now(), email: lead.email, businessName: lead.name, city: lead.city, niche: lead.niche, subject, sentAt: new Date().toISOString(), isFollowUp: false }).write();
    sentDb.update('todayCount', n => n + 1).write();
    leadsDb.get('leads').find({ id: lead.id }).assign({ stage: 'emailed', emailedAt: new Date().toISOString() }).write();
    console.log('Sent to:', lead.email, lead.name);
    return true;
  } catch (err) {
    console.error('Send error:', err.message);
    return false;
  }
}

// ==========================================
// SCHEDULED LEAD FINDER — 9am weekdays
// ==========================================
cron.schedule('0 9 * * 1-5', async () => {
  console.log('Running daily lead finder...');
  const existingIds = leadsDb.get('leads').map('id').value();
  let added = 0;
  for (const { niche, cities } of config.niches) {
    for (const city of cities) {
      const found = await findLeads(niche, city);
      for (const lead of found) {
        if (!existingIds.includes(lead.id)) {
          const scored = await scoreLead(lead);
          leadsDb.get('leads').push(scored).write();
          added++;
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  leadsDb.set('lastRun', new Date().toISOString()).write();
  console.log(`Lead finder complete. Added ${added} new leads.`);
});

// ==========================================
// FOLLOW-UP CHECKER — daily 10am
// ==========================================
cron.schedule('0 10 * * 1-5', () => {
  const cutoff = Date.now() - config.followUpAfterDays * 86400000;
  const dueFollowUps = sentDb.get('sent').filter(s => !s.isFollowUp && new Date(s.sentAt).getTime() < cutoff).value();
  dueFollowUps.forEach(s => {
    const lead = leadsDb.get('leads').find({ email: s.email }).value();
    if (lead) { leadsDb.get('leads').find({ email: s.email }).assign({ stage: 'followup-due' }).write(); }
  });
});

// ==========================================
// API ROUTES
// ==========================================

// Dashboard — review queue (score <= 2)
app.get('/api/queue', (req, res) => {
  const queue = leadsDb.get('leads').filter(l => (l.score <= 2) && l.stage === 'new').orderBy('score', 'asc').value();
  res.json(queue);
});

// Follow-up due
app.get('/api/followups', (req, res) => {
  const due = leadsDb.get('leads').filter(l => l.stage === 'followup-due').value();
  res.json(due);
});

// Sent log
app.get('/api/sent', (req, res) => {
  const sent = sentDb.get('sent').orderBy('sentAt', 'desc').value();
  const todayCount = sentDb.get('todayCount').value();
  res.json({ sent, todayCount, dailyLimit: DAILY_LIMIT });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json({ config, dailyLimit: DAILY_LIMIT, lastRun: leadsDb.get('lastRun').value(), todayCount: sentDb.get('todayCount').value() });
});

// Get prompt for lead
app.get('/api/prompt/:id', (req, res) => {
  const lead = leadsDb.get('leads').find({ id: req.params.id }).value();
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json({ prompt: buildColdEmailPrompt(lead), lead });
});

// Queue email manually
app.post('/api/queue-email', async (req, res) => {
  const { id, subject, body } = req.body;
  const lead = leadsDb.get('leads').find({ id }).value();
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.email) return res.status(400).json({ error: 'Lead has no email address' });
  const delay = Math.floor(Math.random() * (config.delayMaxMs - config.delayMinMs) + config.delayMinMs);
  setTimeout(async () => {
    await sendColdEmail(lead, subject, body);
  }, delay);
  leadsDb.get('leads').find({ id }).assign({ stage: 'queued', queuedAt: new Date().toISOString() }).write();
  res.json({ ok: true, sendingInMs: delay });
});

// Manual trigger lead finder
app.post('/api/find-leads', async (req, res) => {
  res.json({ ok: true, message: 'Lead finder started in background. Check /api/queue in a few minutes.' });
  const existingIds = leadsDb.get('leads').map('id').value();
  let added = 0;
  for (const { niche, cities } of config.niches) {
    for (const city of cities.slice(0, 3)) {
      const found = await findLeads(niche, city);
      for (const lead of found) {
        if (!existingIds.includes(lead.id)) {
          const scored = await scoreLead(lead);
          leadsDb.get('leads').push(scored).write();
          added++;
        }
      }
      await new Promise(r => setTimeout(r, 800));
    }
  }
  console.log('Manual lead find complete. Added:', added);
});

// Update settings
app.post('/api/settings', (req, res) => {
  const { dailyLimit } = req.body;
  if (dailyLimit) process.env.DAILY_LIMIT = dailyLimit;
  res.json({ ok: true });
});

// ==========================================
// FRONTEND
// ==========================================
app.get('/', (req, res) => res.send(getDashboardHTML()));
app.get('/sent', (req, res) => res.send(getSentHTML()));
app.get('/settings', (req, res) => res.send(getSettingsHTML()));

function getDashboardHTML() {
  return `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>StaticSwift Outreach</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif;min-height:100vh}
nav{background:#0d1018;border-bottom:1px solid rgba(255,255,255,0.07);padding:0 24px;height:56px;display:flex;align-items:center;gap:24px}
nav .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:16px;margin-right:auto}.logo span{color:#00C8E0}
nav a{color:#8890a8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;transition:all .2s}
nav a:hover,nav a.active{color:#f0f2f8;background:rgba(255,255,255,0.06)}
.wrap{max-width:1100px;margin:0 auto;padding:28px 24px}
h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:24px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px}
.stat{background:#181b26;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px}
.stat .lbl{font-size:11px;font-weight:700;color:#8890a8;text-transform:uppercase;letter-spacing:.08em;font-family:'DM Mono',monospace;margin-bottom:6px}
.stat .val{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#00C8E0}
.btn{display:inline-block;background:#00C8E0;color:#07090f;font-weight:700;font-size:13px;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;margin-bottom:20px}
.btn-ghost{background:transparent;color:#8890a8;border:1px solid rgba(255,255,255,0.1)}
table{width:100%;border-collapse:collapse;font-size:13px;background:#181b26;border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden}
th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8890a8;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(255,255,255,0.07);font-family:'DM Mono',monospace}
td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8890a8;vertical-align:top}
td strong{color:#f0f2f8}
.score{display:inline-block;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.s0{background:rgba(239,68,68,.2);color:#ef4444}.s1{background:rgba(239,68,68,.15);color:#ef4444}.s2{background:rgba(245,158,11,.15);color:#f59e0b}
.prompt-btn{background:rgba(0,200,224,.1);border:1px solid rgba(0,200,224,.2);color:#00C8E0;font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap}
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center;padding:24px}
.modal-bg.open{display:flex}
.modal{background:#0d1018;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto}
.modal h2{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:16px}
.modal-label{font-size:12px;font-weight:600;color:#8890a8;text-transform:uppercase;letter-spacing:.05em;font-family:'DM Mono',monospace;margin-bottom:6px;display:block}
.prompt-box{background:#07090f;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:14px;font-family:'DM Mono',monospace;font-size:12px;color:#8890a8;white-space:pre-wrap;line-height:1.6;margin-bottom:16px;max-height:200px;overflow-y:auto}
.modal textarea,.modal input{width:100%;background:#12151f;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:11px 14px;font-size:14px;color:#f0f2f8;outline:none;font-family:'DM Sans',sans-serif;margin-bottom:14px}
.modal textarea{resize:vertical;min-height:100px}
.modal-btns{display:flex;gap:10px}
.copy-btn{background:#181b26;border:1px solid rgba(255,255,255,.1);color:#f0f2f8;font-size:12px;padding:7px 14px;border-radius:6px;cursor:pointer;font-family:'DM Sans',sans-serif}
.empty{text-align:center;padding:48px;color:#4a5068;font-size:14px}
</style></head><body>
<nav>
  <span class="logo">STATIC<span>SWIFT</span> OUTREACH</span>
  <a href="/" class="active">Review Queue</a>
  <a href="/sent">Sent Log</a>
  <a href="/settings">Settings</a>
</nav>
<div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
    <h1>Review Queue</h1>
    <button class="btn" onclick="findLeads()">Run Lead Finder</button>
  </div>
  <div class="stats" id="stats"></div>
  <div id="queue-table"></div>
</div>

<div class="modal-bg" id="modal" onclick="closeIfBg(event)">
  <div class="modal">
    <h2 id="modal-title">Write Email</h2>
    <span class="modal-label">Step 1 — Copy this prompt into Claude.ai</span>
    <div class="prompt-box" id="modal-prompt"></div>
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button class="copy-btn" onclick="copyPrompt()">Copy Prompt</button>
      <button class="btn" onclick="window.open('https://claude.ai','_blank')" style="font-size:12px;padding:7px 14px">Open Claude.ai</button>
    </div>
    <span class="modal-label">Step 2 — Paste the email Claude wrote below</span>
    <input type="text" id="modal-subject" placeholder="Subject line">
    <textarea id="modal-body" placeholder="Paste the email body here..."></textarea>
    <div class="modal-btns">
      <button class="btn" onclick="queueEmail()">Queue Email</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
    <div id="modal-success" style="display:none;color:#22c55e;font-size:13px;margin-top:12px;font-weight:600">Email queued. Will send within 2 minutes.</div>
  </div>
</div>

<script>
let currentLeadId = null;

async function loadData(){
  const [qRes, sRes] = await Promise.all([fetch('/api/queue').then(r=>r.json()), fetch('/api/settings').then(r=>r.json())]);
  document.getElementById('stats').innerHTML = \`
    <div class="stat"><div class="lbl">In Queue</div><div class="val">\${qRes.length}</div></div>
    <div class="stat"><div class="lbl">Sent Today</div><div class="val">\${sRes.todayCount} / \${sRes.dailyLimit}</div></div>
    <div class="stat"><div class="lbl">Last Run</div><div class="val" style="font-size:16px">\${sRes.lastRun ? new Date(sRes.lastRun).toLocaleDateString('en-GB') : 'Never'}</div></div>
  \`;
  if(!qRes.length){ document.getElementById('queue-table').innerHTML='<div class="empty">Queue is empty. Run the lead finder to populate it.</div>'; return; }
  document.getElementById('queue-table').innerHTML = \`<table>
    <thead><tr><th>Business</th><th>City</th><th>Niche</th><th>Website</th><th>Score</th><th>Action</th></tr></thead>
    <tbody>\${qRes.map(l=>\`<tr>
      <td><strong>\${l.name||'Unknown'}</strong><br>\${l.address||''}</td>
      <td>\${l.city}</td>
      <td>\${l.niche}</td>
      <td>\${l.websiteUrl ? \`<a href="\${l.websiteUrl}" target="_blank" style="color:#00C8E0">\${l.websiteUrl.replace('https://','').replace('http://','').slice(0,30)}</a>\` : '<span style="color:#ef4444">No website</span>'}</td>
      <td><span class="score s\${l.score}">\${l.score}</span></td>
      <td><button class="prompt-btn" onclick="openModal('\${l.id}')">Write Email</button></td>
    </tr>\`).join('')}</tbody>
  </table>\`;
}

async function openModal(id){
  const {prompt, lead} = await fetch('/api/prompt/'+id).then(r=>r.json());
  currentLeadId = id;
  document.getElementById('modal-title').textContent = 'Write email for '+lead.name;
  document.getElementById('modal-prompt').textContent = prompt;
  document.getElementById('modal-subject').value = '';
  document.getElementById('modal-body').value = '';
  document.getElementById('modal-success').style.display='none';
  document.getElementById('modal').classList.add('open');
}
function closeModal(){ document.getElementById('modal').classList.remove('open'); }
function closeIfBg(e){ if(e.target.id==='modal') closeModal(); }
function copyPrompt(){ navigator.clipboard.writeText(document.getElementById('modal-prompt').textContent); }

async function queueEmail(){
  const subject = document.getElementById('modal-subject').value.trim();
  const body = document.getElementById('modal-body').value.trim();
  if(!subject||!body){ alert('Please fill in subject and email body.'); return; }
  await fetch('/api/queue-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentLeadId,subject,body})});
  document.getElementById('modal-success').style.display='block';
  setTimeout(()=>{ closeModal(); loadData(); },2000);
}

async function findLeads(){
  if(!confirm('This will call the Google Maps API and may take a few minutes. Continue?')) return;
  fetch('/api/find-leads',{method:'POST'});
  alert('Lead finder running in background. Refresh in 2-3 minutes.');
}

loadData();
</script></body></html>`;
}

function getSentHTML() {
  return `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><title>Sent Log — StaticSwift Outreach</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Mono:wght@400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif}nav{background:#0d1018;border-bottom:1px solid rgba(255,255,255,.07);padding:0 24px;height:56px;display:flex;align-items:center;gap:24px}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:16px;margin-right:auto}.logo span{color:#00C8E0}nav a{color:#8890a8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px}nav a.active,nav a:hover{color:#f0f2f8;background:rgba(255,255,255,.06)}.wrap{max-width:1100px;margin:0 auto;padding:28px 24px}h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px;background:#181b26;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden}th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8890a8;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(255,255,255,.07);font-family:'DM Mono',monospace}td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);color:#8890a8}td strong{color:#f0f2f8}.empty{text-align:center;padding:48px;color:#4a5068;font-size:14px}</style></head><body>
<nav><span class="logo">STATIC<span>SWIFT</span> OUTREACH</span><a href="/">Review Queue</a><a href="/sent" class="active">Sent Log</a><a href="/settings">Settings</a></nav>
<div class="wrap"><h1>Sent Log</h1><div id="table"></div></div>
<script>
fetch('/api/sent').then(r=>r.json()).then(({sent,todayCount,dailyLimit})=>{
  if(!sent.length){document.getElementById('table').innerHTML='<div class="empty">No emails sent yet.</div>';return;}
  document.getElementById('table').innerHTML=\`<p style="margin-bottom:16px;font-size:13px;color:#8890a8">Sent today: \${todayCount} / \${dailyLimit}</p><table><thead><tr><th>Business</th><th>City</th><th>Niche</th><th>Subject</th><th>Sent</th><th>Type</th></tr></thead><tbody>\${sent.map(s=>\`<tr><td><strong>\${s.businessName}</strong></td><td>\${s.city}</td><td>\${s.niche}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${s.subject}</td><td style="font-family:'DM Mono',monospace;font-size:11px">\${new Date(s.sentAt).toLocaleDateString('en-GB')}</td><td>\${s.isFollowUp?'<span style="color:#f59e0b">Follow-up</span>':'Cold'}</td></tr>\`).join('')}</tbody></table>\`;
});
</script></body></html>`;
}

function getSettingsHTML() {
  return `<!DOCTYPE html><html lang="en-gb"><head><meta charset="UTF-8"><title>Settings — StaticSwift Outreach</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Mono:wght@400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:#07090f;color:#f0f2f8;font-family:'DM Sans',sans-serif}nav{background:#0d1018;border-bottom:1px solid rgba(255,255,255,.07);padding:0 24px;height:56px;display:flex;align-items:center;gap:24px}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:16px;margin-right:auto}.logo span{color:#00C8E0}nav a{color:#8890a8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px}nav a.active,nav a:hover{color:#f0f2f8;background:rgba(255,255,255,.06)}.wrap{max-width:600px;margin:0 auto;padding:28px 24px}h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:24px}.card{background:#181b26;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:24px;margin-bottom:20px}.card h3{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8890a8;margin-bottom:16px;font-family:'DM Mono',monospace}.field{margin-bottom:16px}.field label{display:block;font-size:12px;font-weight:600;color:#8890a8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;font-family:'DM Mono',monospace}.field input{width:100%;background:#0d1018;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:11px 14px;font-size:14px;color:#f0f2f8;outline:none;font-family:'DM Sans',sans-serif}.btn{background:#00C8E0;color:#07090f;font-weight:700;font-size:14px;padding:11px 24px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif}</style></head><body>
<nav><span class="logo">STATIC<span>SWIFT</span> OUTREACH</span><a href="/">Review Queue</a><a href="/sent">Sent Log</a><a href="/settings" class="active">Settings</a></nav>
<div class="wrap"><h1>Settings</h1>
<div class="card"><h3>Email Limits</h3>
<div class="field"><label>Daily Send Limit (max 40)</label><input type="number" id="daily-limit" value="40" min="1" max="40"></div>
<button class="btn" onclick="saveSettings()">Save Settings</button>
<p id="saved" style="display:none;color:#22c55e;font-size:13px;margin-top:12px">Saved.</p>
</div>
<div class="card"><h3>Current Config</h3><pre id="config-display" style="font-family:'DM Mono',monospace;font-size:12px;color:#8890a8;line-height:1.6;overflow-x:auto"></pre></div>
</div>
<script>
fetch('/api/settings').then(r=>r.json()).then(s=>{
  document.getElementById('daily-limit').value=s.dailyLimit;
  document.getElementById('config-display').textContent=JSON.stringify(s.config,null,2);
});
async function saveSettings(){
  const v=document.getElementById('daily-limit').value;
  await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dailyLimit:v})});
  document.getElementById('saved').style.display='block';
  setTimeout(()=>document.getElementById('saved').style.display='none',2000);
}
</script></body></html>`;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StaticSwift Outreach running at http://localhost:${PORT}`));
