/* ============================================================
   StaticSwift Admin — Application JS
   All original functions preserved (IDs/onclick names unchanged).
   New features at bottom: live visitors, command palette, Google
   prospecting tools, UK backlink directory.
   ============================================================ */

// ==========================================
// AUTH
// ==========================================
let ADMIN_PW = '';

function tryLogin() {
  const val = document.getElementById('pw-input').value;
  if (!val) return;

  // Client-side password check FIRST — works immediately
  if (val === 'Harry2001!') {
    ADMIN_PW = val;
    sessionStorage.setItem('ss_pw', val);
    showApp();
    initApp();
    return;
  }

  // If not the hardcoded password, try API (in case env var was changed)
  fetch('/.netlify/functions/get-clients', {
    headers: { 'x-admin-password': val }
  }).then(r => {
    if (r.ok) {
      ADMIN_PW = val;
      sessionStorage.setItem('ss_pw', val);
      showApp();
      initApp();
    } else {
      document.getElementById('login-err').style.display = 'block';
      document.getElementById('pw-input').value = '';
    }
  }).catch(() => {
    document.getElementById('login-err').style.display = 'block';
    document.getElementById('pw-input').value = '';
  });
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.classList.add('shown');
}

document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

const savedPw = sessionStorage.getItem('ss_pw');
if (savedPw) {
  ADMIN_PW = savedPw;
  showApp();
  initApp();
}

function logout() { sessionStorage.removeItem('ss_pw'); location.reload(); }

async function testSubmission() {
  const btn = document.querySelector('[onclick="testSubmission()"]');
  btn.textContent = '⚡ Testing...';
  btn.disabled = true;
  try {
    const resp = await fetch('/.netlify/functions/handle-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Lead',
        business_name: 'Test Business',
        business_type: 'Plumber',
        business_description: 'Emergency plumbing and boiler servicing across Manchester, available 7 days.',
        usp: '15 years experience, same-day service, fully insured',
        location: 'Manchester',
        trading_years: '5-10 years',
        target_customers: 'Local homeowners / families',
        website_goals: 'get phone calls, get email enquiries, look professional / credible',
        colour_preference: 'Dark & bold (black, navy, charcoal)',
        brand_colours: 'navy blue',
        vibe: 'professional & corporate, traditional & trustworthy',
        theme: 'dark',
        sections: 'customer testimonials, Google Map embed',
        services: 'Emergency Callout\nBoiler Service — £80\nLeak Repair\nBathroom Installation',
        phone: '07700 900000',
        enquiry_email: 'test@smithplumbing.co.uk',
        hours: 'Mon–Fri 8am–6pm, Sat 9am–2pm',
        address: '123 Test Street, Manchester M1 1AA',
        social_links: '@smithplumbing',
        contact_methods: 'phone number, WhatsApp button, contact form',
        special_requests: 'include a Gas Safe logo, prominent call now button',
        delivery_email: 'test@staticswift.co.uk',
        whatsapp: '07700900000',
        package: 'starter',
        hosting_addon: 'no',
        heard_about: 'Google search',
        source: 'admin-test'
      })
    });
    const data = await resp.json();
    if (data.ok) {
      btn.textContent = '✓ Test worked!';
      btn.style.borderColor = '#22c55e';
      btn.style.color = '#22c55e';
      await refreshData();
    } else {
      btn.textContent = '✗ Failed: ' + (data.error || 'unknown');
      btn.style.borderColor = '#ef4444';
      btn.style.color = '#ef4444';
    }
  } catch(err) {
    btn.textContent = '✗ Network error';
    btn.style.borderColor = '#ef4444';
    btn.style.color = '#ef4444';
  }
  setTimeout(() => {
    btn.textContent = '⚡ Test Submit';
    btn.style.borderColor = '#f59e0b';
    btn.style.color = '#f59e0b';
    btn.disabled = false;
  }, 4000);
}

// ==========================================
// API
// ==========================================
let allClients = [];
const LOCAL_CLIENTS_KEY = 'ss_clients_backup';

function saveClientsLocally(clients) {
  try {
    localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify({ clients, savedAt: new Date().toISOString() }));
  } catch(e) { console.warn('Local save failed:', e.message); }
}
function loadClientsLocally() {
  try {
    const raw = localStorage.getItem(LOCAL_CLIENTS_KEY);
    if (!raw) return null;
    const { clients } = JSON.parse(raw);
    return clients;
  } catch(e) { return null; }
}

async function fetchClients() {
  try {
    const r = await fetch('/.netlify/functions/get-clients?t=' + Date.now(), {
      headers: { 'x-admin-password': ADMIN_PW, 'Cache-Control': 'no-cache' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    allClients = await r.json();
    saveClientsLocally(allClients);
    return allClients;
  } catch(err) {
    console.error('[fetchClients] failed:', err.message);
    const local = loadClientsLocally();
    if (local && local.length > 0) {
      allClients = local;
      console.warn('[fetchClients] using local backup —', allClients.length, 'clients');
      const existing = document.getElementById('offline-banner');
      if (!existing) {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#07090f;padding:10px 20px;font-size:13px;font-weight:600;text-align:center';
        banner.textContent = '⚠ Could not reach server — showing locally saved data. Changes may not save. Click Refresh to retry.';
        document.body.prepend(banner);
      }
      return allClients;
    }
    throw err;
  }
}

async function updateClient(clientId, updates) {
  const r = await fetch('/.netlify/functions/update-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
    body: JSON.stringify({ clientId, updates })
  });
  if (!r.ok) {
    let errMsg = 'Failed to update client (HTTP ' + r.status + ')';
    try { const d = await r.json(); errMsg = d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }
  const result = await r.json();
  const idx = allClients.findIndex(c => c.clientId === clientId);
  if (idx >= 0) allClients[idx] = { ...allClients[idx], ...updates };
  saveClientsLocally(allClients);
  return result;
}

async function saveClient(data) {
  const r = await fetch('/.netlify/functions/save-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('Failed to save client');
  const result = await r.json();
  const idx = allClients.findIndex(c => c.clientId === data.clientId);
  if (idx >= 0) allClients[idx] = { ...allClients[idx], ...data };
  else allClients.unshift(data);
  saveClientsLocally(allClients);
  return result;
}

// ==========================================
// INIT
// ==========================================
async function initApp() {
  try {
    await fetchClients();
    renderDashboard();
    renderPipeline();
    renderRevenue();
    renderPrompts();
    initCommandPalette();
    initGlobalSearch();
    loadVisitorWidget();
    setInterval(loadVisitorWidget, 60_000);
  } catch (err) {
    console.error('Init error:', err);
  }
}

async function refreshData() {
  const btn = document.querySelector('.refresh-btn');
  if (btn) btn.textContent = '↻ Refreshing...';
  try {
    await fetchClients();
    const banner = document.getElementById('offline-banner');
    if (banner) banner.remove();
    renderDashboard();
    renderPipeline();
    renderRevenue();
    loadVisitorWidget();
    if (currentClientId) {
      const fresh = allClients.find(c => c.clientId === currentClientId);
      if (fresh) openClient(currentClientId);
    }
  } catch(e) { console.error('refreshData error:', e.message); }
  if (btn) btn.textContent = '↻ Refresh';
}

// ==========================================
// DASHBOARD
// ==========================================
function renderDashboard() {
  const now = new Date();
  const todayStr = now.toDateString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const leadsToday = allClients.filter(c => new Date(c.createdAt).toDateString() === todayStr).length;
  const active = allClients.filter(c => !['paid','complete','archived'].includes(c.stage)).length;
  const paidMonth = allClients.filter(c => c.paid && c.paidAt && new Date(c.paidAt).getTime() >= monthStart)
    .reduce((s, c) => s + (c.amount || 149), 0);

  document.getElementById('stat-leads').textContent = leadsToday;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-revenue').textContent = '£' + paidMonth;
  document.getElementById('stat-total').textContent = allClients.length;
  document.getElementById('month-revenue').textContent = '£' + paidMonth + ' this month';
  // Update sidebar nav badges
  const newCountEl = document.getElementById('nav-count-pipeline');
  if (newCountEl) {
    const newLeads = allClients.filter(c => c.stage === 'new-lead').length;
    if (newLeads > 0) { newCountEl.textContent = newLeads; newCountEl.classList.add('has-count'); }
    else newCountEl.classList.remove('has-count');
  }

  // Tasks
  const tasks = [];
  const ts = Date.now();
  allClients.forEach(c => {
    const hrs = c.createdAt ? (ts - new Date(c.createdAt).getTime()) / 3600000 : 0;
    if (c.stage === 'new-lead' && hrs < 4) {
      tasks.push({ label: `New lead: ${c.business_name || c.name} — start building`, urgency: 'green', id: c.clientId });
    }
    if (c.stage === 'preview-sent' && c.previewSentAt) {
      const h = (ts - new Date(c.previewSentAt).getTime()) / 3600000;
      if (h >= 48) tasks.push({ label: `${c.business_name} — preview sent ${Math.round(h)}hrs ago, no payment`, urgency: 'red', id: c.clientId });
    }
    if (c.stage === 'invoice-sent' && c.invoiceSentAt) {
      const d = (ts - new Date(c.invoiceSentAt).getTime()) / 86400000;
      if (d >= 3) tasks.push({ label: `${c.business_name} — invoice ${Math.round(d)} days old`, urgency: 'amber', id: c.clientId });
    }
  });

  const tl = document.getElementById('tasks-list');
  tl.innerHTML = tasks.length
    ? tasks.map(t => `<div class="task-item">
        <span class="task-label">${escapeHTML(t.label)}</span>
        <span class="urgency u-${t.urgency}">${t.urgency}</span>
        <button class="task-btn" onclick="openClient('${t.id}')">Open</button>
      </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;padding:8px">No urgent tasks. All caught up. ✨</div>';

  const feed = document.getElementById('activity-feed');
  const recent = [...allClients].slice(0, 8);
  feed.innerHTML = recent.length
    ? recent.map(c => `<div class="activity-item" onclick="openClient('${c.clientId}')" style="cursor:pointer">
        <div class="activity-dot"></div>
        <span><strong>${escapeHTML(c.business_name || c.name || '—')}</strong> — ${STAGE_LABELS[c.stage] || c.stage}</span>
        <span class="activity-time">${timeAgo(c.createdAt)}</span>
      </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">No clients yet. Submit a test intake form at your live site.</div>';
}

// ==========================================
// PIPELINE
// ==========================================
const STAGES = ['new-lead','building','uploaded','preview-sent','approved','invoice-sent','paid','complete'];
const STAGE_LABELS = {'new-lead':'New Lead','building':'Building','uploaded':'Uploaded','preview-sent':'Preview Sent','approved':'Approved','invoice-sent':'Invoice Sent','paid':'Paid','complete':'Complete'};

function renderPipeline() {
  const board = document.getElementById('pipeline-board');
  board.innerHTML = STAGES.map(stage => {
    const cards = allClients.filter(c => c.stage === stage);
    return `<div class="pipeline-col">
      <div class="col-header">${STAGE_LABELS[stage]}<span class="col-count">${cards.length}</span></div>
      ${cards.map(c => renderCard(c)).join('')}
      <button class="add-card-btn" onclick="showPage('new-order',document.querySelector('[data-page=&quot;new-order&quot;]'))">+ Add</button>
    </div>`;
  }).join('');
}

function renderCard(c) {
  const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
  const urgentClass = days >= 3 && ['preview-sent','invoice-sent'].includes(c.stage) ? 'urgent' : days >= 2 ? 'warn' : '';
  const amount = (c.package === 'advanced' ? 299 : 149) + (c.hosting_addon === 'yes' ? 29 : 0);
  const src = c.source === 'intake-form' ? 'form' : 'manual';
  return `<div class="pipeline-card ${urgentClass}" onclick="openClient('${c.clientId}')">
    <div class="card-name">${escapeHTML(c.name || '—')}</div>
    <div class="card-biz">${escapeHTML(c.business_name || '—')}</div>
    <span class="badge ${c.package === 'advanced' ? 'badge-advanced' : 'badge-starter'}">${c.package === 'advanced' ? 'Advanced' : 'Starter'}</span>
    <span class="badge badge-${src}">${src}</span>
    <div class="card-meta">
      <span class="card-days">${days === 0 ? 'Today' : days + 'd ago'}</span>
      <span class="card-value">£${amount}</span>
    </div>
  </div>`;
}

// ==========================================
// CLIENT PANEL
// ==========================================
let currentClientId = null;

function openClient(id) {
  const c = allClients.find(x => x.clientId === id);
  if (!c) return;
  currentClientId = id;

  ['preview', 'final'].forEach(type => {
    const drop = document.getElementById(type + '-drop');
    const status = document.getElementById(type + '-upload-status');
    const input = document.getElementById(type + '-file-input');
    if (drop) {
      drop.textContent = type === 'preview'
        ? 'Drop preview .html or .zip here or click to browse'
        : 'Drop final .html or .zip here or click to browse';
      drop.style.borderColor = 'var(--border)';
    }
    if (status) { status.style.display = 'none'; status.textContent = ''; }
    if (input) input.value = '';
  });

  const actionMsg = document.getElementById('panel-action-msg');
  if (actionMsg) actionMsg.style.display = 'none';
  const replyText = document.getElementById('portal-reply-text');
  if (replyText) replyText.value = '';
  const replyMsg = document.getElementById('portal-reply-msg');
  if (replyMsg) replyMsg.style.display = 'none';

  document.getElementById('panel-title').textContent = c.business_name || c.name || 'Client';
  document.getElementById('panel-subtitle').textContent = `${c.package === 'advanced' ? 'Advanced £299' : 'Starter £149'} — ${STAGE_LABELS[c.stage] || c.stage}`;

  const waNum = (c.whatsapp || c.wa || c.phone || '').replace(/\D/g, '').replace(/^0/, '44');
  const waBase = waNum ? `https://wa.me/${waNum}?text=` : null;
  const firstName = (c.name || 'there').split(' ')[0];
  const bizName = c.business_name || 'your business';

  const waMessages = {
    'new-lead':      `Hi ${firstName}! 👋 This is Harry from StaticSwift. Thanks for your order for ${bizName}! I'm starting work on your website now and will have a preview ready within 24 hours. Please keep an eye on your email — and check your junk folder as our emails sometimes land there. Any questions just message me here! 😊`,
    'building':      `Hi ${firstName}, just a quick update — I'm currently building your website for ${bizName} and it's coming along great! I'll send your preview link very soon. Please check your junk/spam folder when it arrives as emails sometimes get filtered. 🙌`,
    'uploaded':      `Hi ${firstName}, your ${bizName} website preview is ready and I've sent the link to your email. Please check your junk/spam folder if you can't see it! Let me know what you think — you can approve or request changes directly from the link. 🚀`,
    'preview-sent':  `Hi ${firstName}! Just checking in — I sent your ${bizName} website preview to your email. Have you had a chance to look at it? Check your junk folder if you haven't seen it. Let me know if you have any questions or changes! 😊`,
    'approved':      `Hi ${firstName}, great news — your ${bizName} website has been approved! I'll now send your invoice. Once payment is received I'll send over the final files straight away. Thank you! 🎉`,
    'invoice-sent':  `Hi ${firstName}! I've sent your invoice to your email for the ${bizName} website. Please check your junk folder if you haven't seen it. Once payment is received I'll send your final website files the same day. Any questions just let me know! 💳`,
    'paid':          `Hi ${firstName}, payment received — thank you so much! 🙏 I'm now preparing your final ${bizName} website files and will send them to your email shortly. Please check your junk folder when they arrive. Exciting times! 🎉`,
    'complete':      `Hi ${firstName}! Your ${bizName} website has been delivered to your email — please check your junk folder if you haven't seen it. It includes your website file, upload guide, and a review link. I'd really appreciate a review when you get a chance! Thanks again for choosing StaticSwift 🌟`,
  };

  const waMsg = waMessages[c.stage] || waMessages['new-lead'];
  const waActionsHtml = waBase
    ? `<div style="margin-bottom:12px;padding:12px;background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.15);border-radius:8px;">
        <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#25D366;font-weight:700;margin-bottom:8px;">💬 WhatsApp ${escapeHTML(firstName)}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px;padding:8px;background:rgba(0,0,0,.3);border-radius:6px;">"${escapeHTML(waMsg.substring(0, 100))}..."</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="${waBase}${encodeURIComponent(waMsg)}" target="_blank" style="background:#25D366;color:#fff;padding:8px 16px;border-radius:5px;font-size:12px;font-weight:700;text-decoration:none;display:inline-block;">Send via WhatsApp ↗</a>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(waMsg)});this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Message',2000)" style="font-size:12px;">Copy Message</button>
        </div>
      </div>`
    : `<div style="margin-bottom:12px;padding:10px 12px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);border-radius:8px;font-size:12px;color:var(--amber);">⚠ No WhatsApp number — ask client for their number.</div>`;

  const waActionsEl = document.getElementById('panel-wa-actions');
  if (waActionsEl) waActionsEl.innerHTML = waActionsHtml;
  document.getElementById('panel-contact').innerHTML = `
    <div class="info-row"><span class="info-key">Name</span><span class="info-val">${escapeHTML(c.name || '—')}</span></div>
    <div class="info-row"><span class="info-key">Email</span><span class="info-val"><a href="mailto:${encodeURIComponent(c.delivery_email||'')}">${escapeHTML(c.delivery_email || '—')}</a></span></div>
    <div class="info-row"><span class="info-key">Phone</span><span class="info-val">${c.phone ? `<a href="tel:${escapeHTML(c.phone)}" style="color:var(--cyan)">${escapeHTML(c.phone)}</a>` : '—'}</span></div>
    <div class="info-row"><span class="info-key">WhatsApp</span><span class="info-val">${(c.whatsapp||c.wa) ? (() => { const n=(c.whatsapp||c.wa||'').replace(/\D/g,'').replace(/^0/,'44'); return `<a href="https://wa.me/${n}" target="_blank" style="background:#25D366;color:#fff;padding:4px 12px;border-radius:4px;font-weight:700;font-size:12px;text-decoration:none;">💬 WhatsApp</a>`; })() : '—'}</span></div>
    <div class="info-row"><span class="info-key">Business Type</span><span class="info-val">${escapeHTML(c.business_type || '—')}</span></div>
    <div class="info-row"><span class="info-key">Location</span><span class="info-val">${escapeHTML(c.location || '—')}</span></div>
    <div class="info-row"><span class="info-key">Trading</span><span class="info-val">${escapeHTML(c.trading_years || '—')}</span></div>
    <div class="info-row"><span class="info-key">Customers</span><span class="info-val">${escapeHTML(c.target_customers || '—')}</span></div>
    ${c.website_goals ? `<div class="info-row"><span class="info-key">Goals</span><span class="info-val">${escapeHTML(c.website_goals)}</span></div>` : ''}
    ${c.vibe ? `<div class="info-row"><span class="info-key">Vibe</span><span class="info-val">${escapeHTML(c.vibe)}</span></div>` : ''}
    ${c.sections ? `<div class="info-row"><span class="info-key">Sections</span><span class="info-val">${escapeHTML(c.sections)}</span></div>` : ''}
    ${c.contact_methods ? `<div class="info-row"><span class="info-key">Contact on site</span><span class="info-val">${escapeHTML(c.contact_methods)}</span></div>` : ''}
    ${c.colour_preference ? `<div class="info-row"><span class="info-key">Colours</span><span class="info-val">${escapeHTML(c.colour_preference)}${c.brand_colours ? ' — ' + escapeHTML(c.brand_colours) : ''}</span></div>` : ''}
    ${c.social_links ? `<div class="info-row"><span class="info-key">Social</span><span class="info-val">${escapeHTML(c.social_links)}</span></div>` : ''}
    ${c.hours ? `<div class="info-row"><span class="info-key">Hours</span><span class="info-val">${escapeHTML(c.hours)}</span></div>` : ''}
    ${c.address ? `<div class="info-row"><span class="info-key">Address</span><span class="info-val">${escapeHTML(c.address)}</span></div>` : ''}
    ${c.enquiry_email ? `<div class="info-row"><span class="info-key">Enquiry email</span><span class="info-val">${escapeHTML(c.enquiry_email)}</span></div>` : ''}
    <div class="info-row"><span class="info-key">Source</span><span class="info-val">${escapeHTML(c.source || '—')}${c.heard_about ? ' · ' + escapeHTML(c.heard_about) : ''}</span></div>
    <div class="info-row"><span class="info-key">Received</span><span class="info-val">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}</span></div>
    ${c.previewUrl ? `<div class="info-row"><span class="info-key">Preview</span><span class="info-val"><a href="${encodeURI(c.previewUrl)}" target="_blank" rel="noopener">View ↗</a></span></div>` : ''}
    ${c.finalUrl ? `<div class="info-row"><span class="info-key">Final File</span><span class="info-val"><a href="${encodeURI(c.finalUrl)}" target="_blank" rel="noopener">Download ↗</a></span></div>` : ''}
  `;
  const stageIdx = STAGES.indexOf(c.stage);
  document.getElementById('panel-stage').innerHTML = STAGES.map((s, i) =>
    `<div class="stage-dot">
      <div class="dot-c ${i < stageIdx ? 'done' : i === stageIdx ? 'current' : ''}"></div>
      <span class="dot-lbl">${STAGE_LABELS[s]}</span>
    </div>`).join('');
  document.getElementById('panel-brief').textContent = c.brief || c.business_description || 'No brief provided.';
  const promptText = c.claudePrompt || generatePrompt(c);
  document.getElementById('panel-prompt').textContent = promptText;
  document.getElementById('panel-notes').value = c.notes || '';

  if (c.portalUUID) {
    const portalUrl = 'https://staticswift.co.uk/client?uuid=' + encodeURIComponent(c.portalUUID);
    document.getElementById('panel-portal-section').style.display = 'block';
    document.getElementById('panel-portal').innerHTML =
      '<a href="' + portalUrl + '" target="_blank" style="color:var(--cyan);font-weight:600;font-size:13px;word-break:break-all;display:block;margin-bottom:8px">Open portal ↗</a>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="copy-btn" id="copy-portal-btn">Copy Link</button>' +
      '<button class="copy-btn" onclick="panelAction(\'portal-link\')" style="background:var(--cyan);color:#07090f;border-color:var(--cyan)">Resend Email</button>' +
      '</div>';
    const cpb = document.getElementById('copy-portal-btn');
    if (cpb) cpb.addEventListener('click', function() {
      navigator.clipboard.writeText(portalUrl);
      this.textContent = 'Copied!';
      setTimeout(() => this.textContent = 'Copy Link', 2000);
    });

    const msgs = Array.isArray(c.portalMessages) ? c.portalMessages : [];
    const msgsEl = document.getElementById('panel-messages');
    const msgsSec = document.getElementById('panel-messages-section');
    if (msgs.length > 0 || c.changeRequest) {
      msgsSec.style.display = 'block';
      let html = '';
      if (c.changeRequest) {
        html += '<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:13px"><div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:4px;text-transform:uppercase">⚠ Change Request ' + (c.changeRequestAt ? '· ' + new Date(c.changeRequestAt).toLocaleDateString('en-GB') : '') + '</div>' + escapeHTML(c.changeRequest || '') + '</div>';
      }
      html += msgs.map(m => '<div style="background:' + (m.from === 'client' ? 'rgba(0,200,224,.08);border:1px solid rgba(0,200,224,.15)' : 'rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)') + ';border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px"><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;text-transform:uppercase">' + (m.from === 'client' ? escapeHTML(c.name || 'Client') : 'You') + ' · ' + new Date(m.sentAt).toLocaleDateString('en-GB') + '</div>' + escapeHTML(m.notes || m.text || '') + '</div>').join('');
      msgsEl.innerHTML = html;
      msgsEl.scrollTop = msgsEl.scrollHeight;
    } else {
      msgsSec.style.display = 'none';
    }
  } else {
    document.getElementById('panel-portal-section').style.display = 'block';
    document.getElementById('panel-portal').innerHTML =
      '<p style="font-size:13px;color:var(--muted);margin-bottom:10px">No portal generated yet.</p>' +
      '<button class="copy-btn" style="background:var(--cyan);color:#07090f;border-color:var(--cyan)" onclick="panelAction(\'portal-link\')">Generate &amp; Send Portal Link</button>';
    document.getElementById('panel-messages-section').style.display = 'none';
  }
  document.getElementById('client-panel').classList.add('open');
}

function closePanel() { document.getElementById('client-panel').classList.remove('open'); currentClientId = null; }
function closePanelBg(e) { if (e.target.id === 'client-panel') closePanel(); }

function copyPrompt() {
  navigator.clipboard.writeText(document.getElementById('panel-prompt').textContent)
    .then(() => { const b = document.querySelector('[onclick="copyPrompt()"]'); b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy Prompt', 2000); });
}

async function regeneratePrompt() {
  const c = allClients.find(x => x.clientId === currentClientId);
  if (!c) return;
  const promptText = generatePrompt(c);
  document.getElementById('panel-prompt').textContent = promptText;
  await updateClient(currentClientId, { claudePrompt: promptText });
}

async function saveNotes() {
  if (!currentClientId) return;
  const notes = document.getElementById('panel-notes').value;
  await updateClient(currentClientId, { notes });
  const btn = document.querySelector('[onclick="saveNotes()"]');
  btn.textContent = 'Saved ✓'; setTimeout(() => btn.textContent = 'Save Notes', 1500);
  const c = allClients.find(x => x.clientId === currentClientId);
  if (c) c.notes = notes;
}

async function panelAction(type) {
  if (!currentClientId) return;
  const c = allClients.find(x => x.clientId === currentClientId);
  if (!c) return;
  const msg = document.getElementById('panel-action-msg');
  msg.style.display = 'none';

  async function sendEmailAction(body) {
    try {
      const r = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.ok) {
        msg.style.display = 'block'; msg.style.color = 'var(--green)';
        msg.textContent = 'Email sent to ' + d.to + (d.invoiceNumber ? ' (' + d.invoiceNumber + ')' : '');
        await refreshData();
        openClient(currentClientId);
      } else {
        msg.style.display = 'block'; msg.style.color = 'var(--red)';
        msg.textContent = 'Error: ' + (d.error || 'Unknown error');
      }
    } catch(err) {
      msg.style.display = 'block'; msg.style.color = 'var(--red)';
      msg.textContent = 'Network error: ' + err.message;
    }
  }

  if (type === 'portal-link') {
    let portalUUID = c.portalUUID;
    if (!portalUUID) {
      portalUUID = makeUUID('portal');
      await updateClient(currentClientId, { portalUUID });
      c.portalUUID = portalUUID;
    }
    const portalUrl = 'https://staticswift.co.uk/client?uuid=' + portalUUID;
    if (confirm('Send portal link to ' + c.delivery_email + '?\n\n' + portalUrl)) {
      await sendEmailAction({ clientId: currentClientId, emailType: 'custom', customSubject: 'Your StaticSwift client portal', customBody: 'Hi ' + (c.name || c.business_name) + ',\n\nYour private client portal is ready. Use the link below to review your project, approve your preview, and access your files:\n\n' + portalUrl + '\n\nBookmark this link — you can return to it any time.\n\nThanks,\nStaticSwift' });
    }
  }
  if (type === 'confirmation') {
    if (confirm('Send confirmation email to ' + c.delivery_email + '?')) {
      await sendEmailAction({ clientId: currentClientId, emailType: 'confirmation' });
    }
  }
  if (type === 'preview') {
    const url = prompt('Enter the preview URL:');
    if (url) {
      await sendEmailAction({ clientId: currentClientId, emailType: 'preview', previewUrl: url });
    }
  }
  if (type === 'invoice') {
    if (confirm('Send invoice to ' + c.delivery_email + '?')) {
      await sendEmailAction({ clientId: currentClientId, emailType: 'invoice' });
    }
  }
  if (type === 'custom') {
    const subject = prompt('Email subject:');
    if (!subject) return;
    const body = prompt('Email body (plain text):');
    if (!body) return;
    await sendEmailAction({ clientId: currentClientId, emailType: 'custom', customSubject: subject, customBody: body });
  }
  if (type === 'next-stage') {
    const idx = STAGES.indexOf(c.stage);
    if (idx < STAGES.length - 1) {
      const newStage = STAGES[idx + 1];
      try {
        await updateClient(currentClientId, { stage: newStage });
        c.stage = newStage;
        await refreshData();
        openClient(currentClientId);
        msg.style.display = 'block'; msg.style.color = 'var(--cyan)';
        msg.textContent = 'Moved to: ' + STAGE_LABELS[newStage];
      } catch(err) {
        msg.style.display = 'block'; msg.style.color = 'var(--red)';
        msg.textContent = 'Stage update failed: ' + err.message;
      }
    }
  }
  if (type === 'paid') {
    if (confirm('Mark ' + c.business_name + ' as paid?')) {
      const amount = (c.package === 'advanced' ? 299 : 149) + (c.hosting_addon === 'yes' ? 29 : 0);
      let portalUUID = c.portalUUID;
      if (!portalUUID) portalUUID = makeUUID('portal');
      const portalUrl = 'https://staticswift.co.uk/client?uuid=' + portalUUID;
      try {
        await updateClient(currentClientId, { stage: 'paid', paid: true, paidAt: new Date().toISOString(), amount, portalUUID });
        c.stage = 'paid'; c.paid = true; c.portalUUID = portalUUID;
        await refreshData();
        openClient(currentClientId);
        msg.style.display = 'block'; msg.style.color = 'var(--green)';
        msg.innerHTML = 'Marked as paid. Client portal: <a href="' + portalUrl + '" target="_blank" style="color:var(--cyan)">' + portalUrl + '</a>';
      } catch(err) {
        msg.style.display = 'block'; msg.style.color = 'var(--red)';
        msg.textContent = 'Mark paid failed: ' + err.message;
      }
    }
  }
  if (type === 'archive') {
    if (confirm('Archive ' + c.business_name + '?')) {
      try {
        await updateClient(currentClientId, { stage: 'archived' });
        c.stage = 'archived';
        await refreshData();
        closePanel();
      } catch(err) {
        msg.style.display = 'block'; msg.style.color = 'var(--red)';
        msg.textContent = 'Archive failed: ' + err.message;
      }
    }
  }
}

// Stronger UUID generator (uses crypto when available — addresses portal-UUID predictability)
function makeUUID(prefix) {
  let body;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    body = crypto.randomUUID();
  } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    body = Array.from(buf, b => b.toString(16).padStart(2,'0')).join('');
  } else {
    body = Date.now().toString(36) + Math.random().toString(36).substr(2, 16);
  }
  return (prefix || 'id') + '-' + body;
}

// ==========================================
// NEW ORDER
// ==========================================
async function saveNewOrder() {
  const name = document.getElementById('no-name').value.trim();
  const bizname = document.getElementById('no-bizname').value.trim();
  const email = document.getElementById('no-email').value.trim();
  const brief = document.getElementById('no-brief').value.trim();
  if (!name || !bizname || !email || !brief) {
    alert('Please fill in: Name, Business Name, Email, and Brief.'); return;
  }
  const pkg = document.getElementById('no-package').value;
  const hosting = document.getElementById('no-hosting').value;
  const client = {
    name, business_name: bizname, delivery_email: email,
    phone: document.getElementById('no-phone').value,
    wa: document.getElementById('no-wa').value,
    business_type: document.getElementById('no-biztype').value,
    referral: document.getElementById('no-referral').value,
    location: document.getElementById('no-location').value,
    brand_colours: document.getElementById('no-colours').value,
    brief, reference_1: document.getElementById('no-refs').value,
    services: document.getElementById('no-services').value,
    special_requests: document.getElementById('no-requests').value,
    notes: document.getElementById('no-notes').value,
    package: pkg, hosting_addon: hosting,
    amount: (pkg === 'advanced' ? 299 : 149) + (hosting === 'yes' ? 29 : 0),
    stage: 'new-lead', source: 'admin-manual',
  };
  client.claudePrompt = generatePrompt(client);
  try {
    const result = await saveClient(client);
    allClients.unshift(result.client);
    document.getElementById('no-success').style.display = 'block';
    setTimeout(() => {
      document.getElementById('no-success').style.display = 'none';
      clearNewOrder();
      showPage('pipeline', document.querySelector('[data-page="pipeline"]'));
      renderPipeline();
      openClient(result.clientId);
    }, 1500);
  } catch(err) {
    document.getElementById('no-error').style.display = 'block';
    document.getElementById('no-error').textContent = 'Error: ' + err.message;
  }
}

function clearNewOrder() {
  ['no-name','no-bizname','no-email','no-phone','no-wa','no-brief','no-refs','no-services','no-requests','no-notes','no-location','no-colours']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('no-success').style.display = 'none';
  document.getElementById('no-error').style.display = 'none';
}

// ==========================================
// REVENUE
// ==========================================
function renderRevenue() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const paid = allClients.filter(c => c.paid && c.paidAt);
  const sum = (from, to) => paid.filter(c => { const t = new Date(c.paidAt).getTime(); return t >= from && (!to || t < to); }).reduce((s,c) => s + (c.amount||149), 0);

  document.getElementById('rev-today').textContent = '£' + sum(todayStart);
  document.getElementById('rev-week').textContent = '£' + sum(weekStart);
  document.getElementById('rev-month').textContent = '£' + sum(monthStart);
  document.getElementById('rev-alltime').textContent = '£' + sum(0);
  document.getElementById('rev-starter').textContent = allClients.filter(c => c.package !== 'advanced').length;
  document.getElementById('rev-advanced').textContent = allClients.filter(c => c.package === 'advanced').length;

  const tbody = document.getElementById('revenue-tbody');
  if (!allClients.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No clients yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allClients.map(c => {
    const amount = c.amount || (c.package === 'advanced' ? 299 : 149);
    const statusColor = c.paid ? 'var(--green)' : c.stage === 'invoice-sent' ? 'var(--amber)' : 'var(--muted)';
    const statusLabel = c.paid ? 'Paid' : c.stage === 'invoice-sent' ? 'Invoice Sent' : STAGE_LABELS[c.stage] || c.stage;
    return `<tr>
      <td style="padding:12px 16px"><strong>${escapeHTML(c.business_name || '—')}</strong><br><span style="font-size:12px;color:var(--muted)">${escapeHTML(c.delivery_email || '')}</span></td>
      <td style="padding:12px 16px;color:var(--muted)">${c.package === 'advanced' ? 'Advanced' : 'Starter'}</td>
      <td style="padding:12px 16px;font-family:'DM Mono',monospace;font-weight:700;color:var(--cyan)">£${amount}</td>
      <td style="padding:12px 16px;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted)">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}</td>
      <td style="padding:12px 16px"><span style="font-size:12px;font-weight:700;color:${statusColor}">${statusLabel}</span></td>
    </tr>`;
  }).join('');
}

// ==========================================
// PROMPT GENERATOR
// ==========================================
function generatePrompt(c) {
  const pkg = c.package === 'advanced';
  const goals = Array.isArray(c.website_goals) ? c.website_goals.join(', ') : (c.website_goals || 'get phone calls, look professional');
  const vibe = Array.isArray(c.vibe) ? c.vibe.join(', ') : (c.vibe || 'professional, trustworthy, local');
  const sections = Array.isArray(c.sections) ? c.sections.join(', ') : (c.sections || '');
  const contactMethods = Array.isArray(c.contact_methods) ? c.contact_methods.join(', ') : (c.contact_methods || 'phone, email, contact form');
  const refs = [c.reference_1, c.reference_2, c.reference_3].filter(Boolean).join(' | ');

  return `=== STATICSWIFT BUILD PROMPT ===

You are a world-class creative director and frontend engineer.
Build a complete single-file HTML website for ${c.business_name || '[BUSINESS]'}, a ${c.business_type || '[TYPE]'} based in ${c.location || '[LOCATION]'}.
Tier: ${pkg ? 'Advanced (multi-section, gallery, testimonials, rich animations). Worth £299.' : 'Starter (clean single page). Worth £149.'}

=== CLIENT ===
Owner: ${c.name || '—'}
Business: ${c.business_name || '—'}
Type: ${c.business_type || '—'}
Location: ${c.location || '—'}
Trading: ${c.trading_years || 'not specified'}
Customers: ${c.target_customers || 'local customers'}
Description: ${c.brief || c.business_description || 'not specified'}
USP: ${c.usp || 'not specified'}

=== GOALS ===
Website goals: ${goals}
${sections ? 'Requested sections: ' + sections : ''}

=== DESIGN ===
Colours: ${c.colour_preference || 'choose best palette for this trade'}
Brand colours: ${c.brand_colours || 'none — use best judgement'}
Theme: ${c.theme === 'dark' ? 'Dark' : c.theme === 'light' ? 'Light' : 'Best judgement'}
Vibe: ${vibe}
Reference: ${refs || 'none — use best judgement'}

=== CONTENT ===
Services: ${c.services || 'not specified — use judgement for this type'}
Phone: ${c.phone || 'not specified'}
Email (form sends to): ${c.enquiry_email || c.delivery_email || 'not specified'}
Hours: ${c.hours || 'not specified'}
Address: ${c.address || 'not specified — omit'}
Social: ${c.social_links || 'not specified'}
Contact methods: ${contactMethods}
Requests: ${c.special_requests || 'none'}

=== CREATIVE DIRECTION ===
This must feel PREMIUM and TRUSTWORTHY. Not a template.
Every section answers: Why trust them? Why are they better? What do I get? Why contact now?

DESIGN PHILOSOPHY:
- Premium editorial. High-end agency feel, not generic template.
- WHITE BACKGROUND. Warm whites (#ffffff, #fafaf8, #f4f3f0). Rich black text (#0b0b0b).
- Warm gold accent (#b8953e) for highlights and CTAs.
- Typography: Fraunces serif for headlines + DM Sans for body. NOT Inter/Roboto.
- Hero headline 64px+ desktop. Body 15-16px, 1.7 line-height.
- Luxury spacing: 120px+ section padding.
- Apple-style scroll animations: translateY(40px) + opacity fade, cubic-bezier(.16,1,.3,1), 0.9s duration.
- Cards: border-radius 16px, 1px borders, hover lift with shadow.
- Buttons: border-radius 100px (pill shape), black fill or outline.
- No cheap gradients. No bounce animations. No flashy effects.

=== BUILD RULES ===
- Single HTML file. All CSS + JS inline. Google Fonts CDN only.
- Mobile-first responsive. 375px min.
- Contact form: formsubmit.co (action="https://formsubmit.co/${c.enquiry_email || c.delivery_email || 'EMAIL'}") with _captcha=false and _template=table.
- WhatsApp: https://wa.me/[international number, no spaces/+]
- Phone: <a href="tel:NUMBER">
- SEO: title, meta description, Open Graph, LocalBusiness JSON-LD.
- Animations: IntersectionObserver fade-in, CSS transitions.
- Footer: "Site by StaticSwift — staticswift.co.uk"
- No prices unless client provided them. No location unless provided.
- No external images. CSS gradients, shapes, abstract art only.

${pkg ? `=== ADVANCED SECTIONS ===
1. Nav — sticky, frosted glass blur, logo left, links right, pill CTA
2. Hero — centred, large headline, subhead, 2 CTAs, proof stats strip
3. Marquee ticker
4. Services — 6 cards, icons, descriptions, hover lift
5. Gallery — masonry grid, CSS art, hover category labels
6. About — split layout, CSS illustration, bio, signature
7. Process — 4 numbered steps
8. Testimonials — featured quote + 3 cards
9. CTA band — dark background, strong headline
10. Contact — details + form, pill inputs
11. Footer — 3-4 columns` : `=== STARTER SECTIONS ===
1. Nav — sticky, frosted glass
2. Hero — centred headline, 2 CTAs, stats
3. Marquee ticker
4. Services — 3 cards
5. About — 2 columns
6. Testimonials — 3 cards
7. Contact — details + form
8. Footer`}

=== END ===`;
}

// ==========================================
// PROMPTS LIBRARY
// ==========================================
const DEFAULT_PROMPTS = [
  { id:'barbers', niche:'Barbers & Hair Salons', content:'Dark luxe aesthetic. Gold or white accent. Bebas Neue style heading. Sections: hero with click-to-call, services with prices, gallery of cuts, reviews, hours + map. Trust signals: years trading, walk-ins welcome. CTA: Call Now / Walk In Today.' },
  { id:'trades', niche:'Trades (Plumbers, Electricians, Builders)', content:'Professional, trustworthy. Mobile-first — customers search on phone in emergencies. Prominent click-to-call as the #1 element. Trust signals: Gas Safe/NICEIC/NAPIT registration, years experience, fully insured, service area. Sections: hero with phone, services, qualifications, reviews, contact. CTA: Call Now / Free Quote.' },
  { id:'photographers', niche:'Photographers', content:'Clean minimal image-led design. Let photography speak. Generous whitespace. Gallery must be fast-loading. Sections: hero gallery, packages with pricing, style/about, testimonials, booking form. CTA: Check Availability / Book a Consultation.' },
  { id:'food', niche:'Cafes, Restaurants, Food Trucks', content:'Warm, inviting, personality-led. Feels like the venue itself. Menu easy to read on mobile. Google Maps embed essential. Sections: hero, menu highlights, story, hours + location, reservations. CTA: View Menu / Find Us / Reserve.' },
  { id:'pt', niche:'Personal Trainers', content:'Energetic but professional. State specialism upfront. Trust signals: Level 3 PT, specialist certs, client results. Sections: hero with specialism, services/packages with pricing, qualifications, testimonials/results, contact. CTA: Free Consultation / Start Your Journey.' },
];

function renderPrompts() {
  const prompts = JSON.parse(localStorage.getItem('ss_prompts') || 'null') || DEFAULT_PROMPTS;
  const grid = document.getElementById('prompts-grid');
  if (!grid) return;
  grid.innerHTML = prompts.map(p => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <h3 style="font-size:15px;font-weight:700">${escapeHTML(p.niche)}</h3>
        <button onclick="deletePrompt('${p.id}')" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px;color:var(--muted);line-height:1.6;max-height:120px;overflow-y:auto;margin-bottom:14px">${escapeHTML(p.content)}</div>
      <div style="display:flex;gap:8px">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(\`${p.content.replace(/`/g,"'")}\`)">Copy</button>
        <button class="open-claude-btn" onclick="blendWithLatest('${p.id}')">Blend with Client</button>
      </div>
    </div>`).join('');
}

function blendWithLatest(promptId) {
  const prompts = JSON.parse(localStorage.getItem('ss_prompts') || 'null') || DEFAULT_PROMPTS;
  const niche = prompts.find(p => p.id === promptId);
  if (!niche) return;
  const latest = allClients[0];
  const intakePrompt = latest ? generatePrompt(latest) : '(No clients yet — save a new order first)';
  const combined = intakePrompt + '\n\n=== NICHE DESIGN DIRECTION ===\n\n' + niche.content;
  navigator.clipboard.writeText(combined);
  alert('Combined prompt copied to clipboard. Paste into Claude.ai.');
}

function addPrompt() {
  const name = prompt('Niche name:'); if (!name) return;
  const content = prompt('Design direction notes:'); if (!content) return;
  const prompts = JSON.parse(localStorage.getItem('ss_prompts') || 'null') || DEFAULT_PROMPTS;
  prompts.push({ id: 'custom_' + Date.now(), niche: name, content });
  localStorage.setItem('ss_prompts', JSON.stringify(prompts));
  renderPrompts();
}

function deletePrompt(id) {
  if (!confirm('Remove this prompt?')) return;
  const prompts = (JSON.parse(localStorage.getItem('ss_prompts') || 'null') || DEFAULT_PROMPTS).filter(p => p.id !== id);
  localStorage.setItem('ss_prompts', JSON.stringify(prompts));
  renderPrompts();
}

// ==========================================
// EXPORT
// ==========================================
async function exportData() {
  try {
    const r = await fetch('/.netlify/functions/excel-export', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    if (!r.ok) { alert('Export failed — add ADMIN_PASSWORD env var in Netlify.'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'StaticSwift_' + new Date().toISOString().split('T')[0] + '.xlsx';
    a.click(); URL.revokeObjectURL(url);
  } catch(err) { alert('Export error: ' + err.message); }
}

// ==========================================
// ANALYTICS
// ==========================================
async function loadAnalytics() {
  document.getElementById('analytics-status').textContent = 'Refreshing...';
  let anyData = false;

  try {
    const r = await fetch('/.netlify/functions/analytics-data', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    const d = await r.json();
    if (d.unavailable) {
      showAnalyticsSetup('GA4: ' + d.reason);
    } else {
      anyData = true;
      document.getElementById('ga-sessions').textContent = d.overview.sessions.toLocaleString();
      document.getElementById('ga-users').textContent = d.overview.users.toLocaleString();
      document.getElementById('ga-pageviews').textContent = d.overview.pageviews.toLocaleString();
      document.getElementById('ga-duration').textContent = Math.floor(d.overview.avgDuration/60) + 'm ' + (d.overview.avgDuration%60) + 's';
      document.getElementById('ga-bounce').textContent = d.overview.bounceRate + '%';

      document.getElementById('ga-top-pages').innerHTML = d.topPages.map(p =>
        `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
          <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${escapeHTML(p.path)}</span>
          <span style="font-family:'DM Mono',monospace;color:var(--cyan);flex-shrink:0">${p.views.toLocaleString()}</span>
        </div>`).join('') || '<div class="empty">No data yet</div>';

      document.getElementById('ga-sources').innerHTML = d.sources.map(s =>
        `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
          <span style="color:var(--muted)">${escapeHTML(s.channel)}</span>
          <span style="font-family:'DM Mono',monospace;color:var(--cyan)">${s.sessions.toLocaleString()}</span>
        </div>`).join('') || '<div class="empty">No data yet</div>';
    }
  } catch(err) {
    document.getElementById('ga-top-pages').innerHTML = `<div class="empty">GA4 not connected</div>`;
    document.getElementById('ga-sources').innerHTML = `<div class="empty">GA4 not connected</div>`;
  }

  try {
    const r = await fetch('/.netlify/functions/search-console-data', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    const d = await r.json();
    if (d.unavailable) {
      showAnalyticsSetup('GSC: ' + d.reason);
    } else {
      anyData = true;
      document.getElementById('gsc-clicks').textContent = d.overview.clicks.toLocaleString();
      document.getElementById('gsc-impressions').textContent = d.overview.impressions.toLocaleString();
      document.getElementById('gsc-ctr').textContent = d.overview.ctr + '%';
      document.getElementById('gsc-position').textContent = '#' + d.overview.position;

      document.getElementById('gsc-queries').innerHTML = d.topQueries.map(q =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);gap:8px">
          <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escapeHTML(q.query)}</span>
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--dim);flex-shrink:0">${q.clicks} clicks · #${q.position}</span>
        </div>`).join('') || '<div class="empty">No data yet</div>';

      document.getElementById('gsc-sitemaps').innerHTML = d.sitemaps.length
        ? d.sitemaps.map(s => {
            const pct = s.submitted > 0 ? Math.round((s.indexed / s.submitted) * 100) : 0;
            const color = pct >= 60 ? 'var(--green)' : pct >= 30 ? 'var(--amber)' : 'var(--red)';
            return `<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis">${escapeHTML(s.path.replace('https://staticswift.co.uk',''))}</span>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:${color}">${s.indexed}/${s.submitted} (${pct}%)</span>
              </div>
              <div style="height:4px;background:var(--dark3);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .4s"></div>
              </div>
            </div>`;}).join('')
        : '<div class="empty" style="font-size:13px">No sitemaps submitted yet.<br><a href="https://search.google.com/search-console" target="_blank" style="color:var(--cyan)">Submit at Search Console →</a></div>';
    }
  } catch(err) {
    document.getElementById('gsc-queries').innerHTML = `<div class="empty">Search Console not connected</div>`;
    document.getElementById('gsc-sitemaps').innerHTML = `<div class="empty">Search Console not connected</div>`;
  }

  document.getElementById('analytics-status').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
  if (!anyData) {
    document.getElementById('analytics-setup').style.display = 'block';
  }
}

function showAnalyticsSetup(reason) {
  document.getElementById('analytics-setup').style.display = 'block';
}

async function pingSitemaps() {
  const btn = event.target;
  btn.textContent = 'Pinging...';
  btn.disabled = true;
  try {
    const r = await fetch('/.netlify/functions/ping-sitemaps', {
      method: 'POST',
      headers: { 'x-admin-password': ADMIN_PW }
    });
    const d = await r.json();
    if (d.ok) {
      btn.textContent = `Pinged ✓ (${d.sitemapsPinged} sitemaps, ${d.priorityUrlsSubmitted} priority URLs)`;
      btn.style.color = 'var(--green)';
    } else {
      btn.textContent = 'Ping failed';
    }
  } catch(err) {
    btn.textContent = 'Error: ' + err.message;
  }
  setTimeout(() => {
    btn.textContent = 'Ping Sitemaps';
    btn.style.color = '';
    btn.disabled = false;
  }, 5000);
}

// ==========================================
// UTILS
// ==========================================
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.round(diff/60) + 'm ago';
  if (diff < 86400) return Math.round(diff/3600) + 'h ago';
  return Math.round(diff/86400) + 'd ago';
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// ==========================================
// INBOX
// ==========================================
let inboxEmails = [];
let inboxLoaded = false;
let selectedEmail = null;

async function loadInbox() {
  const list = document.getElementById('inbox-list');
  const detail = document.getElementById('inbox-detail');
  if (!list) return;
  list.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px">Loading...</div>';
  detail.innerHTML = '<div style="color:var(--muted);font-size:14px;padding-top:60px;text-align:center">Select an email to read</div>';
  try {
    const r = await fetch('/.netlify/functions/fetch-inbox', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    if (!r.ok) {
      const d = await r.json();
      list.innerHTML = '<div style="padding:24px;color:var(--red);font-size:13px">Error: ' + (d.error || r.status) + '</div>';
      return;
    }
    inboxEmails = await r.json();
    inboxLoaded = true;
    renderInbox();
    detectProspectReplies(inboxEmails);
  } catch(err) {
    list.innerHTML = '<div style="padding:24px;color:var(--red);font-size:13px">Failed to load: ' + err.message + '</div>';
  }
}

function detectProspectReplies(emails) {
  if (!emails || !emails.length || !prospects.length) return;
  let updated = 0;
  emails.forEach(email => {
    const fromMatch = email.from && email.from.match(/<(.+)>/);
    const senderEmail = fromMatch ? fromMatch[1].toLowerCase() : (email.from || '').toLowerCase().trim();
    if (!senderEmail) return;
    const idx = prospects.findIndex(p => p.email && p.email.toLowerCase() === senderEmail);
    if (idx < 0) return;
    const p = prospects[idx];
    if (p.status !== 'sent') return;
    const emailDate = new Date(email.date);
    const lastContacted = p.lastContacted ? new Date(p.lastContacted) : null;
    if (lastContacted && emailDate < lastContacted) return;
    prospects[idx].status = 'replied';
    prospects[idx].repliedAt = email.date;
    if (!Array.isArray(prospects[idx].emailHistory)) prospects[idx].emailHistory = [];
    prospects[idx].emailHistory.push({
      template: '↩ Reply received: ' + (email.subject || '(no subject)'),
      sentAt: email.date,
      to: senderEmail,
      direction: 'inbound'
    });
    updated++;
  });
  if (updated > 0) {
    saveProspects();
    renderProspects();
    const notif = document.createElement('div');
    notif.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--green);color:#07090f;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3)';
    notif.textContent = '✓ ' + updated + ' prospect' + (updated > 1 ? 's' : '') + ' marked as Replied from inbox';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }
}

function renderInbox() {
  const list = document.getElementById('inbox-list');
  if (!list) return;
  const filter = document.getElementById('inbox-filter')?.value || 'all';
  const emails = filter === 'all' ? inboxEmails : inboxEmails.filter(e => e.mailbox === filter);

  if (!emails.length) {
    list.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px">' + (inboxLoaded ? 'No emails found.' : 'Click Refresh to load.') + '</div>';
    return;
  }

  list.innerHTML = emails.map((e, i) => {
    const isSelected = selectedEmail && selectedEmail.id === e.id;
    const badgeCol = e.mailbox === 'support' ? '#f59e0b' : '#00C8E0';
    const fromName = e.from.replace(/<.*>/, '').trim() || e.from;
    return `<div onclick="openEmail(${i})" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:${isSelected ? 'var(--surface2)' : 'transparent'};transition:background .15s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${escapeHTML(fromName)}</span>
        <span style="font-size:11px;color:var(--muted);white-space:nowrap">${timeAgo(e.date)}</span>
      </div>
      <div style="font-size:12px;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(e.subject)}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${badgeCol}22;color:${badgeCol};font-weight:600">${escapeHTML(e.mailbox)}</span>
        <span style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(e.snippet || '')}</span>
      </div>
    </div>`;
  }).join('');
}

function openEmail(idx) {
  const filter = document.getElementById('inbox-filter')?.value || 'all';
  const emails = filter === 'all' ? inboxEmails : inboxEmails.filter(e => e.mailbox === filter);
  const e = emails[idx];
  if (!e) return;
  selectedEmail = e;
  renderInbox();

  const detail = document.getElementById('inbox-detail');
  const fromAddr = e.from.match(/<(.+)>/)?.[1] || e.from;
  const badgeCol = e.mailbox === 'support' ? '#f59e0b' : '#00C8E0';

  detail.innerHTML = `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div style="font-size:17px;font-weight:700;margin-bottom:8px;color:var(--text)">${escapeHTML(e.subject)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--muted)">
        <span><strong style="color:var(--text)">From:</strong> ${escapeHTML(e.from)}</span>
        <span><strong style="color:var(--text)">To:</strong> ${escapeHTML(e.to||'')}</span>
        <span><strong style="color:var(--text)">Date:</strong> ${new Date(e.date).toLocaleString('en-GB')}</span>
        <span style="padding:2px 8px;border-radius:4px;background:${badgeCol}22;color:${badgeCol};font-weight:600;font-size:11px">${escapeHTML(e.mailbox)}@staticswift.co.uk</span>
      </div>
    </div>
    <div style="font-size:14px;line-height:1.7;color:var(--text);margin-bottom:28px;white-space:pre-wrap">${escapeHTML(e.text || '(HTML email — no plain text version)')}</div>
    <div style="border-top:1px solid var(--border);padding-top:20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text)">Reply from:
        <select id="reply-mailbox" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:6px;font-size:12px;margin-left:8px">
          <option value="hello" ${e.mailbox === 'hello' ? 'selected' : ''}>hello@staticswift.co.uk</option>
          <option value="support" ${e.mailbox === 'support' ? 'selected' : ''}>support@staticswift.co.uk</option>
        </select>
      </div>
      <textarea id="reply-body" placeholder="Write your reply..." style="width:100%;min-height:140px;background:var(--dark3);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text);outline:none;resize:vertical;margin-bottom:10px;font-family:'DM Sans',sans-serif"></textarea>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="sendReply(this.dataset.to,this.dataset.subj)" data-to="${escapeHTML(fromAddr)}" data-subj="${escapeHTML(e.subject||'(no subject)')}" style="background:var(--cyan);color:#07090f;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;border:none;cursor:pointer">Send Reply</button>
        <span id="reply-status" style="font-size:13px"></span>
      </div>
    </div>`;
}

async function sendReply(to, subject) {
  const bodyEl = document.getElementById('reply-body');
  const fromEl = document.getElementById('reply-mailbox');
  const status = document.getElementById('reply-status');
  if (!bodyEl || !status) return;
  const body = bodyEl.value.trim();
  const fromMailbox = fromEl ? fromEl.value : 'hello';
  if (!body) { status.style.color = 'var(--red)'; status.textContent = 'Write a reply first'; return; }
  status.style.color = 'var(--muted)'; status.textContent = 'Sending...';
  try {
    const r = await fetch('/.netlify/functions/send-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ to, subject: subject || '(no subject)', body, fromMailbox })
    });
    const d = await r.json();
    if (d.ok) {
      status.style.color = 'var(--green)'; status.textContent = 'Sent!';
      bodyEl.value = '';
    } else {
      status.style.color = 'var(--red)'; status.textContent = 'Error: ' + (d.error || 'unknown');
    }
  } catch(err) {
    status.style.color = 'var(--red)'; status.textContent = 'Network error';
  }
}

async function sendPortalReply() {
  if (!currentClientId) return;
  const text = document.getElementById('portal-reply-text').value.trim();
  const msgEl = document.getElementById('portal-reply-msg');
  if (!text) { msgEl.style.display='block'; msgEl.style.color='var(--red)'; msgEl.textContent='Write a message first.'; return; }
  msgEl.style.display='block'; msgEl.style.color='var(--muted)'; msgEl.textContent='Sending...';
  try {
    const r = await fetch('/.netlify/functions/portal-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ clientId: currentClientId, text })
    });
    const d = await r.json();
    if (d.ok) {
      msgEl.style.color = 'var(--green)'; msgEl.textContent = 'Sent — client will receive an email.';
      document.getElementById('portal-reply-text').value = '';
      await refreshData();
      openClient(currentClientId);
    } else {
      msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Error: ' + (d.error || 'unknown');
    }
  } catch(e) {
    msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Network error';
  }
}

// ==========================================
// FILE UPLOAD
// ==========================================
async function handleFileSelect(input, fileType) {
  const file = input.files[0];
  if (!file) return;
  if (!file.name.endsWith('.html') && !file.name.endsWith('.zip')) {
    alert('Please select an HTML or ZIP file.');
    return;
  }
  if (!currentClientId) { alert('No client selected.'); return; }

  const statusEl = document.getElementById(fileType + '-upload-status');
  const dropEl = document.getElementById(fileType + '-drop');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = 'Reading file...';
  dropEl.style.borderColor = 'var(--cyan)';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    statusEl.textContent = 'Uploading...';

    const r = await fetch('/.netlify/functions/upload-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ clientId: currentClientId, fileType, htmlBase64: base64, filename: file.name })
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Upload failed');

    const uploadedUrl = data.previewUrl;
    const downloadUrl = data.cdnUrl || data.previewUrl;
    dropEl.textContent = '✓ ' + file.name;
    dropEl.style.borderColor = 'var(--green)';

    const msg = document.getElementById('panel-action-msg');

    if (fileType === 'preview') {
      await updateClient(currentClientId, {
        previewUrl: uploadedUrl,
        stage: 'preview-sent',
        previewSentAt: new Date().toISOString(),
        approvedAt: null,
        approvalNotes: null,
        changeRequest: null,
        changeRequestAt: null,
      });
      statusEl.textContent = 'Sending preview email to client...';

      const c = allClients.find(x => x.clientId === currentClientId);
      if (!c.portalUUID) {
        const newUUID = makeUUID('portal');
        await updateClient(currentClientId, { portalUUID: newUUID });
        c.portalUUID = newUUID;
      }

      const portalUrl = 'https://staticswift.co.uk/client?uuid=' + c.portalUUID;

      const emailR = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ clientId: currentClientId, emailType: 'preview', previewUrl: portalUrl })
      });
      const emailData = await emailR.json();

      if (emailData.ok) {
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = '✓ Preview sent to ' + emailData.to;
        msg.style.display = 'block'; msg.style.color = 'var(--green)';
        msg.textContent = 'Preview uploaded and emailed. Client portal updated — awaiting their approval.';
      } else {
        statusEl.style.color = 'var(--amber)';
        statusEl.textContent = '✓ Uploaded — email failed: ' + (emailData.error || 'unknown');
      }

    } else if (fileType === 'final') {
      await updateClient(currentClientId, {
        finalUrl: downloadUrl,
        stage: 'complete',
        deliveredAt: new Date().toISOString()
      });
      statusEl.textContent = 'Sending delivery email to client...';

      const c = allClients.find(x => x.clientId === currentClientId);
      const emailR = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({
          clientId: currentClientId,
          emailType: 'custom',
          customSubject: 'Your website files are ready — ' + (c?.business_name || ''),
          customBody: 'Hi ' + (c?.name || 'there') + ',\n\nYour website is complete and ready to download:\n\n' + downloadUrl + '\n\nRight-click the link and choose "Save As" to download your HTML file, then follow our upload guide to go live:\nhttps://staticswift.co.uk/how-to-upload.html\n\nThank you for choosing StaticSwift!\n\nHarry\nStaticSwift — staticswift.co.uk'
        })
      });
      const emailData = await emailR.json();

      if (emailData.ok) {
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = '✓ Final files sent to ' + emailData.to;
        msg.style.display = 'block'; msg.style.color = 'var(--green)';
        msg.textContent = 'Final file delivered. Job complete.';
      } else {
        statusEl.style.color = 'var(--amber)';
        statusEl.textContent = '✓ Uploaded — email failed: ' + (emailData.error || 'unknown');
      }
    }

    await refreshData();
    openClient(currentClientId);

  } catch(err) {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = '✗ Error: ' + err.message;
    dropEl.style.borderColor = 'var(--red)';
  }

  input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  ['preview-drop','final-drop'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', e => { e.preventDefault(); el.style.borderColor='var(--cyan)'; });
    el.addEventListener('dragleave', () => { el.style.borderColor='var(--border)'; });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.borderColor='var(--border)';
      const fileType = id.includes('preview') ? 'preview' : 'final';
      const input = document.getElementById(fileType + '-file-input');
      input.files = e.dataTransfer.files;
      handleFileSelect(input, fileType);
    });
  });
});

// ==========================================
// TICKETS
// ==========================================
let allTickets = [];
let selectedTicket = null;

async function loadTickets() {
  const list = document.getElementById('ticket-list');
  list.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px">Loading from both mailboxes...</div>';
  try {
    const r = await fetch('/.netlify/functions/fetch-inbox', { headers: { 'x-admin-password': ADMIN_PW } });
    if (!r.ok) {
      const d = await r.json();
      list.innerHTML = '<div style="padding:24px;color:var(--red);font-size:13px">Error: ' + (d.error || r.status) + '</div>';
      return;
    }
    const emails = await r.json();
    const threads = {};
    emails.forEach(e => {
      const key = e.subject.replace(/^(re:|fwd?:)\s*/i,'').trim().toLowerCase();
      if (!threads[key]) threads[key] = { subject: e.subject.replace(/^(re:|fwd?:)\s*/i,'').trim(), emails: [], mailbox: e.mailbox, lastDate: e.date, status: 'open' };
      threads[key].emails.push(e);
      if (e.date > threads[key].lastDate) threads[key].lastDate = e.date;
    });
    allTickets = Object.values(threads).sort((a,b) => new Date(b.lastDate) - new Date(a.lastDate));
    renderTickets();
    detectProspectReplies(emails);
  } catch(err) {
    list.innerHTML = '<div style="padding:24px;color:var(--red);font-size:13px">Failed: ' + err.message + '</div>';
  }
}

function renderTickets() {
  const list = document.getElementById('ticket-list');
  const filter = document.getElementById('ticket-filter')?.value || 'open';
  const tickets = filter === 'all' ? allTickets : allTickets.filter(t => filter === 'closed' ? t.status === 'closed' : t.status !== 'closed');
  if (!tickets.length) { list.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px">No tickets. Click Refresh to load.</div>'; return; }
  list.innerHTML = tickets.map((t,i) => {
    const isSelected = selectedTicket && selectedTicket.subject === t.subject;
    const badgeCol = t.mailbox === 'support' ? '#f59e0b' : '#00C8E0';
    const from = t.emails[0]?.from?.replace(/<.*>/,'').trim() || t.emails[0]?.from || '';
    return `<div onclick="openTicket(${i})" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:${isSelected?'var(--surface2)':'transparent'}">
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px">${escapeHTML(t.subject || '(no subject)')}</span>
        <span style="font-size:11px;color:var(--muted);white-space:nowrap">${timeAgo(t.lastDate)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${badgeCol}22;color:${badgeCol};font-weight:600">${escapeHTML(t.mailbox)}</span>
        <span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${t.status==='closed'?'rgba(34,197,94,.15)':'rgba(251,191,36,.12)'};color:${t.status==='closed'?'#22c55e':'#fbbf24'};font-weight:600">${t.status}</span>
        <span style="font-size:11px;color:var(--muted)">${t.emails.length} msg${t.emails.length>1?'s':''}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(from)}</div>
    </div>`;
  }).join('');
}

function openTicket(idx) {
  const filter = document.getElementById('ticket-filter')?.value || 'open';
  const tickets = filter === 'all' ? allTickets : allTickets.filter(t => filter === 'closed' ? t.status === 'closed' : t.status !== 'closed');
  const t = tickets[idx];
  if (!t) return;
  selectedTicket = t;
  renderTickets();
  const detail = document.getElementById('ticket-detail');
  const fromAddr = t.emails[0]?.from?.match(/<(.+)>/)?.[1] || t.emails[0]?.from || '';
  const thread = [...t.emails].sort((a,b) => new Date(a.date)-new Date(b.date));
  detail.innerHTML = `
    <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${escapeHTML(t.subject || '(no subject)')}</div>
        <div style="font-size:12px;color:var(--muted)">${t.emails.length} message${t.emails.length>1?'s':''} &nbsp;·&nbsp; ${escapeHTML(t.mailbox)}@staticswift.co.uk</div>
      </div>
      <button onclick="toggleTicketStatus()" style="background:${t.status==='closed'?'rgba(251,191,36,.15)':'rgba(34,197,94,.15)'};color:${t.status==='closed'?'#fbbf24':'#22c55e'};border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">
        ${t.status==='closed'?'Reopen':'Close ticket'}
      </button>
    </div>
    <div style="padding:20px 24px;max-height:320px;overflow-y:auto">
      ${thread.map(e => `
        <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:600">${escapeHTML(e.from)}</span>
            <span style="font-size:12px;color:var(--muted)">${new Date(e.date).toLocaleString('en-GB')}</span>
          </div>
          <div style="font-size:13px;color:var(--muted);line-height:1.7;white-space:pre-wrap">${escapeHTML(e.text || '(HTML only)')}</div>
        </div>`).join('')}
    </div>
    <div style="padding:20px 24px;border-top:1px solid var(--border)">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">Reply from:
        <select id="ticket-reply-mailbox" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:6px;font-size:12px;margin-left:8px">
          <option value="hello" ${t.mailbox==='hello'?'selected':''}>hello@staticswift.co.uk</option>
          <option value="support" ${t.mailbox==='support'?'selected':''}>support@staticswift.co.uk</option>
        </select>
      </div>
      <textarea id="ticket-reply-body" placeholder="Write your reply..." style="width:100%;min-height:120px;background:var(--dark3);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text);outline:none;resize:vertical;margin-bottom:10px;font-family:'DM Sans',sans-serif"></textarea>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="sendTicketReply(this.dataset.to,this.dataset.subj,'Re: ')" data-to="${escapeHTML(fromAddr)}" data-subj="${escapeHTML(t.subject||'')}" style="background:var(--cyan);color:#07090f;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;border:none;cursor:pointer">Send Reply</button>
        <span id="ticket-reply-status" style="font-size:13px"></span>
      </div>
    </div>`;
}

function toggleTicketStatus() {
  if (!selectedTicket) return;
  selectedTicket.status = selectedTicket.status === 'closed' ? 'open' : 'closed';
  renderTickets();
  const idx = allTickets.findIndex(t => t.subject === selectedTicket.subject);
  if (idx >= 0) openTicket(idx);
}

async function sendTicketReply(to, subject, prefix) {
  const bodyEl = document.getElementById('ticket-reply-body');
  const fromEl = document.getElementById('ticket-reply-mailbox');
  const status = document.getElementById('ticket-reply-status');
  if (!bodyEl || !status) return;
  const body = bodyEl.value.trim();
  const fromMailbox = fromEl ? fromEl.value : 'support';
  if (!body) { status.style.color='var(--red)'; status.textContent='Write a reply first'; return; }
  status.style.color='var(--muted)'; status.textContent='Sending...';
  try {
    const r = await fetch('/.netlify/functions/send-reply', {
      method:'POST', headers:{'Content-Type':'application/json','x-admin-password':ADMIN_PW},
      body:JSON.stringify({ to, subject: (prefix||'Re: ')+(subject || '(no subject)'), body, fromMailbox })
    });
    const d = await r.json();
    if (d.ok) { status.style.color='var(--green)'; status.textContent='Sent!'; bodyEl.value=''; }
    else { status.style.color='var(--red)'; status.textContent='Error: '+(d.error||'unknown'); }
  } catch(e) { status.style.color='var(--red)'; status.textContent='Network error'; }
}

function showNewTicket() {
  const to = prompt('Send new email to:');
  if (!to) return;
  const subject = prompt('Subject:');
  if (!subject) return;
  const body = prompt('Message:');
  if (!body) return;
  // Inline send (no DOM dependency on ticket-reply-body)
  fetch('/.netlify/functions/send-reply', {
    method:'POST', headers:{'Content-Type':'application/json','x-admin-password':ADMIN_PW},
    body:JSON.stringify({ to, subject, body, fromMailbox: 'support' })
  }).then(r => r.json()).then(d => {
    alert(d.ok ? '✓ Sent!' : '✗ Error: '+(d.error||'unknown'));
  }).catch(()=> alert('✗ Network error'));
}

// ==========================================
// OUTREACH
// ==========================================
let prospects = JSON.parse(localStorage.getItem('ss_prospects') || '[]');
let selectedProspectIdx = null;

const OUTREACH_TEMPLATES = [
  { name: '🚫 No Website', subject: 'Quick idea for {business}',
    body: `Hi {name},\n\nI came across {business} on Facebook — great reviews and clearly a busy operation.\n\nI noticed you don't have a website yet. When someone Googles "{type} {location}", you're invisible — even if you're the best in the area.\n\nI build clean, professional websites for local businesses from £149, delivered within 24 hours. No monthly fees, you own the files outright.\n\nHappy to put together a free mockup for you with no obligation — just reply and I'll get it done.\n\nHarry\nStaticSwift — staticswift.co.uk` },
  { name: '🔄 Outdated Site', subject: 'Quick idea for {business}',
    body: `Hi {name},\n\nI came across {business} online — I build websites for local businesses and noticed yours could do with a refresh.\n\nA modern, fast site helps you rank on Google and gives customers confidence before they call. From £149, delivered in 24 hours, you own the files.\n\nHappy to show you a free mockup — just reply and I'll put one together.\n\nHarry\nStaticSwift — staticswift.co.uk` },
  { name: '📲 Facebook Only', subject: 'Free mockup for {business}',
    body: `Hi {name},\n\nI found {business} on Facebook — you've clearly got a great reputation locally.\n\nThe problem is, Facebook doesn't show up when people Google "{type} near me". A proper website fixes that overnight.\n\nI build professional sites from £149, delivered in 24 hours. No monthly fees, no lock-in — you own everything.\n\nI'll build you a free mockup so you can see exactly what it would look like before paying anything. Just reply with a yes.\n\nHarry\nStaticSwift — staticswift.co.uk` },
  { name: '🔁 Follow-Up', subject: 'Following up — {business}',
    body: `Hi {name},\n\nJust following up on my earlier message about a website for {business}.\n\nIf the timing's not right, no worries at all — but if you're open to it I'd love to show you what I can put together. It only takes 24 hours and starts at £149.\n\nHarry\nStaticSwift — staticswift.co.uk` },
  { name: '🏆 Trades Special', subject: 'More jobs from Google — {business}',
    body: `Hi {name},\n\nI work with tradespeople across the UK who are missing out on Google enquiries because they don't have a website.\n\nFor {business}, a simple professional site would mean that when someone in {location} Googles "{type}", you actually show up.\n\n£149 one-off, delivered in 24 hours, no monthly fees. I'll do a free mockup first so you can see it before committing.\n\nInteresting?\n\nHarry\nStaticSwift — staticswift.co.uk` },
];

function updateOutreachStats() {
  const g = id => document.getElementById(id);
  if (!g('os-total')) return;
  g('os-total').textContent = prospects.length;
  g('os-new').textContent = prospects.filter(p => p.status === 'new').length;
  g('os-sent').textContent = prospects.filter(p => p.status === 'sent').length;
  g('os-replied').textContent = prospects.filter(p => p.status === 'replied').length;
  g('os-converted').textContent = prospects.filter(p => p.status === 'converted').length;
}

function renderProspects() {
  updateOutreachStats();
  const filter = document.getElementById('outreach-filter')?.value || 'all';
  const search = (document.getElementById('outreach-search')?.value || '').toLowerCase();
  let list = [...prospects];
  if (filter !== 'all') list = list.filter(p => p.status === filter);
  if (search) list = list.filter(p => ((p.bizname||'')+(p.name||'')+(p.email||'')+(p.location||'')+(p.type||'')).toLowerCase().includes(search));
  const el = document.getElementById('prospect-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px;text-align:center">No prospects.<br><br>Import your CSV, add one above, or use the Google prospecting tools.</div>';
    return;
  }
  el.innerHTML = list.map(p => {
    const idx = prospects.indexOf(p);
    const isSelected = idx === selectedProspectIdx;
    const statusColors = { new:'#8890a8', sent:'#00C8E0', replied:'#fbbf24', converted:'#22c55e', dead:'#f87171' };
    const col = statusColors[p.status] || '#8890a8';
    return `<div onclick="openProspect(${idx})" style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:${isSelected?'var(--surface2)':'transparent'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:2px">
        <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${escapeHTML(p.bizname||'')}</span>
        <span style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase;white-space:nowrap">${p.status}</span>
      </div>
      <div style="font-size:11px;color:var(--muted)">${escapeHTML(p.type||'')} ${p.location?'· '+escapeHTML(p.location):''}</div>
      <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(p.email||'No email')}</div>
    </div>`;
  }).join('');
}

function fillTemplate(text, p) {
  const name = p.name || p.bizname || 'there';
  const firstName = name.split(' ')[0];
  return text
    .replace(/{business}/g, p.bizname || 'your business')
    .replace(/{name}/g, firstName)
    .replace(/{type}/g, (p.type||'local business').toLowerCase())
    .replace(/{location}/g, p.location || 'your area');
}

function openProspect(idx) {
  selectedProspectIdx = idx;
  renderProspects();
  const p = prospects[idx];
  const pane = document.getElementById('prospect-detail-pane');
  let defaultTpl = 0;
  if (p.status === 'sent') defaultTpl = 3;
  else if (p.notes && p.notes.toLowerCase().includes('facebook')) defaultTpl = 2;
  else if (p.notes && (p.notes.toLowerCase().includes('outdated') || p.notes.toLowerCase().includes('wix'))) defaultTpl = 1;
  else if (p.type && ['Plumber','Electrician','Builder / Roofer'].includes(p.type)) defaultTpl = 4;
  const tpl = OUTREACH_TEMPLATES[defaultTpl];
  const filledSubject = fillTemplate(tpl.subject, p);
  const filledBody = fillTemplate(tpl.body, p);
  const statusColors = { new:'#8890a8', sent:'#00C8E0', replied:'#fbbf24', converted:'#22c55e', dead:'#f87171' };

  // Google-powered research toolbar (NEW)
  const q = encodeURIComponent(`${p.bizname||''} ${p.location||''}`.trim());
  const qType = encodeURIComponent(`${p.type||''} ${p.location||''}`.trim());
  const toolbar = `
    <div class="prospect-toolbar">
      <a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener" class="prospect-tool">🔍 Google</a>
      <a href="https://www.google.com/maps/search/${q}" target="_blank" rel="noopener" class="prospect-tool">📍 Maps</a>
      <a href="https://www.google.com/search?q=${q}+facebook" target="_blank" rel="noopener" class="prospect-tool">📘 Facebook</a>
      <a href="https://www.google.com/search?q=${q}+instagram" target="_blank" rel="noopener" class="prospect-tool">📷 Instagram</a>
      <a href="https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.bizname||'')}" target="_blank" rel="noopener" class="prospect-tool">💼 LinkedIn</a>
      <a href="https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(p.bizname||'')}" target="_blank" rel="noopener" class="prospect-tool">🏢 Companies House</a>
      <a href="https://www.google.com/search?q=${q}+reviews" target="_blank" rel="noopener" class="prospect-tool">⭐ Reviews</a>
      <a href="https://www.google.com/search?q=site%3A${q}+contact" target="_blank" rel="noopener" class="prospect-tool">✉ Find Email</a>
    </div>`;

  pane.innerHTML = `
    <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="min-width:0">
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">${escapeHTML(p.bizname||'')}</div>
        <div style="font-size:13px;color:var(--muted)">${[p.type,p.location,p.name].filter(Boolean).map(escapeHTML).join(' · ')}</div>
        ${p.phone ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">📞 <a href="tel:'+escapeHTML(p.phone)+'" style="color:var(--cyan)">'+escapeHTML(p.phone)+'</a></div>' : ''}
        ${p.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:4px;font-style:italic;white-space:pre-wrap">'+escapeHTML(p.notes)+'</div>' : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        <select onchange="updateProspectStatus(${idx},this.value)" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:7px;font-size:12px">
          <option value="">Status...</option>
          <option value="new" ${p.status==='new'?'selected':''}>New</option>
          <option value="sent" ${p.status==='sent'?'selected':''}>Sent</option>
          <option value="replied" ${p.status==='replied'?'selected':''}>Replied</option>
          <option value="converted" ${p.status==='converted'?'selected':''}>Converted</option>
          <option value="dead" ${p.status==='dead'?'selected':''}>Dead</option>
        </select>
        <button onclick="convertToOrder(${idx})" style="background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3);padding:6px 12px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">→ Order</button>
        <button onclick="deleteProspect(${idx})" style="background:transparent;color:var(--red);border:1px solid rgba(239,68,68,.3);padding:6px 10px;border-radius:7px;font-size:12px;cursor:pointer">✕</button>
      </div>
    </div>
    ${toolbar}
    ${(p.emailHistory||[]).length > 0 ? `<div style="padding:12px 22px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.15)">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Email history</div>
      ${(p.emailHistory||[]).map(h=>'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">'+(h.direction==='inbound'?'↩':'✓')+' '+escapeHTML(h.template||'')+' — '+new Date(h.sentAt).toLocaleDateString("en-GB")+' '+new Date(h.sentAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+'</div>').join('')}
    </div>` : ''}
    <div style="padding:18px 22px;display:flex;flex-direction:column;gap:12px;flex:1">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Template</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${OUTREACH_TEMPLATES.map((t,i)=>'<button onclick="applyTemplate('+i+','+idx+')" id="tpl-btn-'+i+'" style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid '+(i===defaultTpl?'var(--cyan)':'var(--border)')+';background:'+(i===defaultTpl?'rgba(0,200,224,.1)':'transparent')+';color:'+(i===defaultTpl?'var(--cyan)':'var(--muted)')+'">'+escapeHTML(t.name)+'</button>').join('')}
        </div>
      </div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">To</label>
        <input id="compose-to" value="${escapeHTML(p.email||'')}" placeholder="email@example.com" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-size:13px;width:100%;outline:none;box-sizing:border-box">
      </div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Subject</label>
        <input id="compose-subject" value="${escapeHTML(filledSubject)}" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-size:13px;width:100%;outline:none;box-sizing:border-box">
      </div>
      <div style="flex:1"><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Message</label>
        <textarea id="compose-body" style="width:100%;min-height:220px;background:var(--dark3);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text);outline:none;resize:vertical;font-family:'DM Sans',sans-serif;line-height:1.7;box-sizing:border-box">${escapeHTML(filledBody)}</textarea>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button onclick="sendProspectEmail(${idx})" style="background:var(--cyan);color:#07090f;font-weight:700;font-size:14px;padding:11px 28px;border-radius:8px;border:none;cursor:pointer">Send Email ✈</button>
        <button onclick="scheduleFollowUp(${idx})" class="btn-ghost" style="font-size:13px;padding:10px 18px">⏰ Schedule follow-up</button>
        <span id="outreach-send-status" style="font-size:13px"></span>
      </div>
    </div>`;
}

function applyTemplate(tplIdx, prospectIdx) {
  const p = prospects[prospectIdx];
  const tpl = OUTREACH_TEMPLATES[tplIdx];
  const subEl = document.getElementById('compose-subject');
  const bodyEl = document.getElementById('compose-body');
  if (subEl) subEl.value = fillTemplate(tpl.subject, p);
  if (bodyEl) bodyEl.value = fillTemplate(tpl.body, p);
  OUTREACH_TEMPLATES.forEach((_,i) => {
    const btn = document.getElementById('tpl-btn-'+i);
    if (!btn) return;
    btn.style.borderColor = i===tplIdx ? 'var(--cyan)' : 'var(--border)';
    btn.style.background = i===tplIdx ? 'rgba(0,200,224,.1)' : 'transparent';
    btn.style.color = i===tplIdx ? 'var(--cyan)' : 'var(--muted)';
  });
}

async function sendProspectEmail(idx) {
  const p = prospects[idx];
  const toEl = document.getElementById('compose-to');
  const subEl = document.getElementById('compose-subject');
  const bodyEl = document.getElementById('compose-body');
  const status = document.getElementById('outreach-send-status');
  if (!toEl || !status) return;
  const to = toEl.value.trim();
  const subject = subEl ? subEl.value.trim() : '';
  const body = bodyEl ? bodyEl.value.trim() : '';
  if (!to) { status.style.color='var(--red)'; status.textContent='Add an email address first'; return; }
  if (!body) { status.style.color='var(--red)'; status.textContent='Write a message first'; return; }
  status.style.color='var(--muted)'; status.textContent='Sending...';
  try {
    const r = await fetch('/.netlify/functions/send-reply', {
      method:'POST', headers:{'Content-Type':'application/json','x-admin-password':ADMIN_PW},
      body:JSON.stringify({ to, subject: subject || 'Hello', body, fromMailbox:'hello' })
    });
    const d = await r.json();
    if (d.ok) {
      status.style.color='var(--green)'; status.textContent='✓ Sent to '+to;
      prospects[idx].status='sent'; prospects[idx].lastContacted=new Date().toISOString(); prospects[idx].email=to;
      if (!Array.isArray(prospects[idx].emailHistory)) prospects[idx].emailHistory=[];
      prospects[idx].emailHistory.push({ template:subject, sentAt:new Date().toISOString(), to });
      saveProspects(); renderProspects();
      setTimeout(() => openProspect(idx), 1000);
    } else { status.style.color='var(--red)'; status.textContent='Error: '+(d.error||'unknown'); }
  } catch(e) { status.style.color='var(--red)'; status.textContent='Network error'; }
}

function scheduleFollowUp(idx) {
  const days = parseInt(prompt('Follow up in how many days?', '3'), 10);
  if (!days || days < 1) return;
  const followUpAt = new Date(Date.now() + days * 86400000).toISOString();
  prospects[idx].followUpAt = followUpAt;
  saveProspects();
  renderProspects();
  const status = document.getElementById('outreach-send-status');
  if (status) { status.style.color='var(--cyan)'; status.textContent='⏰ Follow-up scheduled for ' + new Date(followUpAt).toLocaleDateString('en-GB'); }
}

function showAddProspectModal() {
  const m = document.getElementById('add-prospect-modal');
  if (m) { m.style.display='flex'; setTimeout(()=>document.getElementById('pr-bizname')?.focus(),100); }
}
function hideAddProspectModal() { const m=document.getElementById('add-prospect-modal'); if(m) m.style.display='none'; }

function addProspect() {
  const bizname = document.getElementById('pr-bizname').value.trim();
  const msg = document.getElementById('pr-msg');
  if (!bizname) { msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Business name required.'; return; }
  prospects.unshift({ bizname, name:document.getElementById('pr-name').value.trim(), email:document.getElementById('pr-email').value.trim(), type:document.getElementById('pr-type').value, location:document.getElementById('pr-location').value.trim(), phone:document.getElementById('pr-phone').value.trim(), notes:document.getElementById('pr-notes').value.trim(), status:'new', addedAt:new Date().toISOString() });
  saveProspects();
  ['pr-bizname','pr-name','pr-email','pr-location','pr-phone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('pr-notes').value='';
  msg.style.display='block'; msg.style.color='var(--green)'; msg.textContent='Added!';
  setTimeout(()=>{ msg.style.display='none'; hideAddProspectModal(); renderProspects(); openProspect(0); }, 800);
}

function updateProspectStatus(idx, status) {
  if (!status) return; prospects[idx].status=status; prospects[idx].statusUpdated=new Date().toISOString();
  saveProspects(); renderProspects(); if(selectedProspectIdx===idx) openProspect(idx);
}
function deleteProspect(idx) {
  if (!confirm('Remove '+prospects[idx].bizname+'?')) return;
  prospects.splice(idx,1); selectedProspectIdx=null; saveProspects(); renderProspects();
  const pane=document.getElementById('prospect-detail-pane');
  if(pane) pane.innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;padding:40px;text-align:center"><div><div style="font-size:32px;margin-bottom:12px">✉</div><div>Select a prospect</div></div></div>';
}
function saveProspects() { localStorage.setItem('ss_prospects', JSON.stringify(prospects)); }

async function sendBatchOutreach() {
  const unsent = prospects.filter(p => p.status === 'new' && p.email);
  if (!unsent.length) { alert('No unsent prospects with an email address.\n\nAdd prospects and make sure each has an email set.'); return; }

  const preview = unsent.slice(0, 5).map(p => {
    const tplIdx = smartTemplatePick(p);
    return '• ' + p.bizname + ' → ' + OUTREACH_TEMPLATES[tplIdx].name;
  }).join('\n') + (unsent.length > 5 ? '\n... and ' + (unsent.length - 5) + ' more' : '');

  if (!confirm('Send personalised emails to ' + unsent.length + ' prospects?\n\nEach gets the best-fit template automatically:\n\n' + preview + '\n\nProceed?')) return;

  let sent = 0, failed = 0;
  for (const p of unsent) {
    const tplIdx = smartTemplatePick(p);
    const tpl = OUTREACH_TEMPLATES[tplIdx];
    try {
      const r = await fetch('/.netlify/functions/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ to: p.email, subject: fillTemplate(tpl.subject, p), body: fillTemplate(tpl.body, p), fromMailbox: 'hello' })
      });
      const d = await r.json();
      const i = prospects.indexOf(p);
      if (d.ok && i >= 0) {
        prospects[i].status = 'sent';
        prospects[i].lastContacted = new Date().toISOString();
        prospects[i].lastTemplate = tpl.name;
        if (!Array.isArray(prospects[i].emailHistory)) prospects[i].emailHistory = [];
        prospects[i].emailHistory.push({ template: tpl.name, sentAt: new Date().toISOString(), to: p.email });
        sent++;
      } else { failed++; }
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 1400));
  }
  saveProspects();
  renderProspects();
  alert('Batch complete.\n✓ Sent: ' + sent + '\n✗ Failed: ' + failed);
}

function smartTemplatePick(p) {
  const notes = (p.notes || '').toLowerCase();
  const status = p.status || 'new';
  if (status === 'sent') return 3;
  if (notes.includes('facebook') || notes.includes('fb only') || notes.includes('no website')) return 2;
  if (notes.includes('outdated') || notes.includes('wix') || notes.includes('old site') || notes.includes('basic site')) return 1;
  if (p.type && ['Plumber','Electrician','Builder / Roofer','Landscaper / Gardener'].includes(p.type)) return 4;
  return 0;
}
function convertToOrder(idx) {
  const p=prospects[idx];
  if (!confirm('Move '+p.bizname+' to Pipeline as a new order?')) return;
  showPage('new-order',document.querySelector('[data-page="new-order"]'));
  ['no-bizname','no-name','no-email','no-location'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.value=[p.bizname,p.name,p.email,p.location][i]||'';});
  const src=document.getElementById('no-source'); if(src) src.value='Cold outreach';
  prospects[idx].status='converted'; saveProspects();
}
function showNewProspect() { showAddProspectModal(); }

function importProspectsCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    if (!lines.length) return;
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const bizIdx = headers.findIndex(h => h.includes('business'));
    const nameIdx = headers.findIndex(h => h.includes('contact') || h === 'name');
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const typeIdx = headers.findIndex(h => h.includes('type'));
    const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('town') || h.includes('city'));
    const notesIdx = headers.findIndex(h => h.includes('notes') || h.includes('signal'));
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || lines[i].split(',');
      const clean = cols.map(c => (c || '').replace(/^"|"$/g,'').trim());
      const bizname = bizIdx >= 0 ? clean[bizIdx] : clean[0];
      const email = emailIdx >= 0 ? clean[emailIdx] : '';
      if (!bizname || bizname.toLowerCase() === 'business name') continue;
      if (prospects.find(p => p.bizname === bizname && p.email === email)) continue;
      prospects.push({
        bizname,
        name: nameIdx >= 0 ? clean[nameIdx] : '',
        email: email || '',
        type: typeIdx >= 0 ? clean[typeIdx] : '',
        location: locationIdx >= 0 ? clean[locationIdx] : '',
        notes: notesIdx >= 0 ? clean[notesIdx] : '',
        status: 'new',
        addedAt: new Date().toISOString(),
        source: 'csv-import'
      });
      added++;
    }
    saveProspects();
    renderProspects();
    alert('Imported ' + added + ' prospects. Duplicates skipped.');
  };
  reader.readAsText(file);
  input.value = '';
}

function exportProspectsCSV() {
  const headers = ['Business Name','Contact Name','Email','Phone','Location','Type','Status','Notes','Last Contacted'];
  const rows = prospects.map(p => [
    p.bizname, p.name || '', p.email || '', p.phone || '', p.location || '',
    p.type || '', p.status || 'new', p.notes || '', p.lastContacted || ''
  ].map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'staticswift_prospects.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// GOOGLE PROSPECTING DORKS  (NEW)
// ==========================================
const NICHES = ['barber','plumber','electrician','builder','roofer','cleaner','photographer','personal trainer','beauty salon','cafe','restaurant','dentist','solicitor','accountant','gardener','locksmith','removals','tutor','painter decorator','dog groomer','tattoo studio','optician','vet','florist','tiler','joiner','scaffolder','therapist','pub','food truck','wedding planner','driving instructor','music teacher','yoga studio','gym','mobile hairdresser','window cleaner','dj','retail','pest control'];
const UK_TOWNS = ['Edinburgh','Glasgow','Manchester','Birmingham','Leeds','Liverpool','Sheffield','Bristol','Newcastle','Nottingham','Cardiff','Belfast','Plymouth','Stoke-on-Trent','Wolverhampton','Derby','Swansea','Sunderland','Brighton','Norwich','Coventry','Oxford','Cambridge','Reading','Watford','Bournemouth','York','Bath','Aberdeen','Dundee','Inverness','Stirling','Perth','Falkirk','Livingston','Dunfermline','Kilmarnock','Paisley','Galashiels','Hawick'];

function renderDorkPicker() {
  const niche = document.getElementById('dork-niche')?.value || 'plumber';
  const town = document.getElementById('dork-town')?.value || 'Edinburgh';
  const n = encodeURIComponent(niche);
  const t = encodeURIComponent(town);
  const dorks = [
    { lbl: 'Facebook-only businesses (no website)', q: `site:facebook.com "${niche}" "${town}" -instagram` },
    { lbl: 'Instagram-only businesses',           q: `site:instagram.com "${niche}" "${town}"` },
    { lbl: 'Wix sites (replaceable)',             q: `site:wixsite.com "${niche}" "${town}"` },
    { lbl: 'Free directory listings only',        q: `(site:freeindex.co.uk OR site:yell.com) "${niche}" "${town}"` },
    { lbl: 'Outdated 2018-2020 sites',            q: `"${niche}" "${town}" "copyright 2018" OR "© 2019" OR "© 2020"` },
    { lbl: 'Local with weak SEO',                 q: `"${niche}" "${town}" -site:facebook.com -site:yell.com inurl:.co.uk` },
    { lbl: 'Google Maps listings',                q: null, url: `https://www.google.com/maps/search/${n}+in+${t}` },
    { lbl: 'Yell.com listings',                   q: null, url: `https://www.yell.com/ucs/UcsSearchAction.do?keywords=${n}&location=${t}` },
    { lbl: 'Companies House',                     q: null, url: `https://find-and-update.company-information.service.gov.uk/search?q=${n}+${t}` },
    { lbl: 'Yelp UK',                             q: null, url: `https://www.yelp.co.uk/search?find_desc=${n}&find_loc=${t}` },
  ];
  const el = document.getElementById('dork-grid');
  if (!el) return;
  el.innerHTML = dorks.map(d => {
    const url = d.url || ('https://www.google.com/search?q=' + encodeURIComponent(d.q));
    return `<div class="dork-card">
      <div class="dork-lbl">${escapeHTML(d.lbl)}</div>
      <div class="dork-q">${escapeHTML(d.q || d.url)}</div>
      <a class="dork-go" href="${url}" target="_blank" rel="noopener">Open ↗</a>
    </div>`;
  }).join('');
}

// ==========================================
// UK BACKLINK DIRECTORIES  (NEW)
// Trusted UK business directories where you can submit StaticSwift
// for free or low cost. These add citation backlinks that lift local SEO.
// ==========================================
const UK_DIRECTORIES = [
  { name:'FreeIndex',         url:'https://www.freeindex.co.uk/add.aspx',                       cost:'Free',   dr:'High' },
  { name:'Yell.com',          url:'https://www.yell.com/free-listing.html',                     cost:'Free',   dr:'Very high' },
  { name:'Cylex UK',          url:'https://www.cylex-uk.co.uk/add-company.html',                cost:'Free',   dr:'Medium' },
  { name:'Scoot',             url:'https://www.scoot.co.uk/',                                   cost:'Free',   dr:'Medium' },
  { name:'Hotfrog UK',        url:'https://www.hotfrog.co.uk/AddCompany.aspx',                  cost:'Free',   dr:'Medium' },
  { name:'Brownbook',         url:'https://www.brownbook.net/',                                 cost:'Free',   dr:'Medium' },
  { name:'192.com',           url:'https://www.192.com/businesses/',                            cost:'Free',   dr:'High' },
  { name:'ThomsonLocal',      url:'https://www.thomsonlocal.com/business-directory-submission', cost:'Free',   dr:'Medium' },
  { name:'TouchLocal',        url:'https://www.touchlocal.com/',                                cost:'Free',   dr:'Low' },
  { name:'UK Small Business Directory', url:'https://www.uksmallbusinessdirectory.co.uk/', cost:'Free', dr:'Low' },
  { name:'Misterwhat',        url:'https://www.misterwhat.co.uk/',                              cost:'Free',   dr:'Low' },
  { name:'AllInLondon',       url:'https://www.allinlondon.co.uk/business-listings.php',        cost:'Free',   dr:'Medium' },
  { name:'Approved Business', url:'https://www.approvedbusiness.co.uk/',                        cost:'Free',   dr:'Low' },
  { name:'Trustpilot',        url:'https://business.trustpilot.com/signup',                     cost:'Free',   dr:'Very high' },
  { name:'Google Business Profile', url:'https://www.google.com/business/',                     cost:'Free',   dr:'Critical' },
  { name:'Bing Places',       url:'https://www.bingplaces.com/',                                cost:'Free',   dr:'Critical' },
  { name:'Yelp UK',           url:'https://biz.yelp.co.uk/',                                    cost:'Free',   dr:'High' },
  { name:'Foursquare',        url:'https://foursquare.com/business/',                           cost:'Free',   dr:'High' },
  { name:'Crunchbase',        url:'https://www.crunchbase.com/',                                cost:'Free',   dr:'Very high' },
  { name:'LinkedIn Company',  url:'https://www.linkedin.com/company/setup/new/',                cost:'Free',   dr:'Very high' },
  { name:'Clutch',            url:'https://clutch.co/get-listed',                               cost:'Free',   dr:'Very high' },
  { name:'GoodFirms',         url:'https://www.goodfirms.co/sign-up',                           cost:'Free',   dr:'High' },
  { name:'DesignRush',        url:'https://www.designrush.com/',                                cost:'Free',   dr:'High' },
  { name:'TrustRadius',       url:'https://www.trustradius.com/',                               cost:'Free',   dr:'High' },
  { name:'Capterra',          url:'https://www.capterra.com/vendors/sign-up',                   cost:'Free',   dr:'Very high' },
  { name:'Product Hunt',      url:'https://www.producthunt.com/posts/new',                      cost:'Free',   dr:'Very high' },
  { name:'BetaList',          url:'https://betalist.com/submit',                                cost:'Free',   dr:'High' },
  { name:'IndieHackers',      url:'https://www.indiehackers.com/',                              cost:'Free',   dr:'High' },
];

function renderDirectories() {
  const el = document.getElementById('directory-grid');
  if (!el) return;
  const submitted = JSON.parse(localStorage.getItem('ss_directories') || '[]');
  el.innerHTML = UK_DIRECTORIES.map(d => {
    const done = submitted.includes(d.url);
    return `<div class="directory-card" style="opacity:${done?.55:1}">
      <div style="min-width:0">
        <div class="dir-name">${done?'✓ ':''}${escapeHTML(d.name)}</div>
        <div class="dir-meta">${escapeHTML(d.cost)} · DR ${escapeHTML(d.dr)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <a class="dir-go" href="${d.url}" target="_blank" rel="noopener" onclick="markDirectorySubmitted('${d.url.replace(/'/g,"\\'")}')">Submit ↗</a>
      </div>
    </div>`;
  }).join('');
}

function markDirectorySubmitted(url) {
  // Mark after a 5s delay (user might just be browsing). Manual undo via localStorage clear.
  setTimeout(() => {
    const cur = JSON.parse(localStorage.getItem('ss_directories') || '[]');
    if (!cur.includes(url)) {
      cur.push(url);
      localStorage.setItem('ss_directories', JSON.stringify(cur));
      renderDirectories();
    }
  }, 5000);
}

// ==========================================
// SEO CHECKLIST
// ==========================================
const SEO_ITEMS = [
  { done: false, title: 'Submit site to Google Search Console', detail: 'Go to search.google.com/search-console → Add property → Enter https://staticswift.co.uk → Verify ownership using the HTML file method (download file, upload to site root, then verify).', url: 'https://search.google.com/search-console' },
  { done: false, title: 'Submit your sitemap', detail: 'In Search Console → Sitemaps → enter: sitemap_index.xml and click Submit. This tells Google about all your pages immediately.', url: 'https://search.google.com/search-console' },
  { done: false, title: 'Request indexing for your homepage', detail: 'In Search Console → URL Inspection → enter https://staticswift.co.uk → click "Request Indexing". Do this for your main pages too.', url: 'https://search.google.com/search-console' },
  { done: false, title: 'Set up Google Analytics', detail: 'Go to analytics.google.com → create a GA4 property → copy your Measurement ID (G-XXXXXXX) → it is already in your site code.', url: 'https://analytics.google.com' },
  { done: false, title: 'Create a Google Business Profile', detail: 'Even as an online-only business, a GBP listing boosts local SEO and credibility. Go to business.google.com → Add business → StaticSwift → Website Design → Livingston, Scotland.', url: 'https://business.google.com' },
  { done: false, title: 'Submit to 5+ UK directories', detail: 'Use the Backlink Directories panel above. Aim for FreeIndex, Yell, Cylex, Scoot, Brownbook in week one. NAP (name, address, phone) must match across all of them.', url: null },
  { done: false, title: 'Post StaticSwift on social media', detail: 'Share your site on Facebook, Instagram, and LinkedIn. These links count as signals even if they are no-follow. Tag local business groups in Edinburgh/Lothians.', url: null },
  { done: false, title: 'Connect Search Console to Analytics', detail: 'In GA4 → Admin → Product Links → Search Console Links → Link your verified Search Console property.', url: 'https://analytics.google.com' },
  { done: false, title: 'Check your site is indexed', detail: 'Search Google for: site:staticswift.co.uk — if results appear, you are indexed. If nothing shows after 8 weeks, check Search Console for crawl errors.', url: 'https://www.google.com/search?q=site:staticswift.co.uk' },
  { done: false, title: 'Add analytics env vars to Netlify', detail: 'Add: GA4_PROPERTY_ID, GSC_SITE_URL=https://staticswift.co.uk/, GOOGLE_SA_EMAIL, GOOGLE_SA_KEY. Then the Analytics tab will show live data.', url: 'https://app.netlify.com' },
];

let seoProgress = JSON.parse(localStorage.getItem('ss_seo') || '[]');

function renderSEOChecklist() {
  const el = document.getElementById('seo-checklist');
  if (!el) return;
  el.innerHTML = SEO_ITEMS.map((item, i) => {
    const done = seoProgress.includes(i);
    return `<div style="background:var(--surface);border:1px solid ${done?'rgba(34,197,94,.3)':'var(--border)'};border-radius:12px;padding:18px 20px;display:flex;gap:16px;align-items:flex-start">
      <button onclick="toggleSEO(${i})" style="flex-shrink:0;width:22px;height:22px;border-radius:50%;border:2px solid ${done?'#22c55e':'var(--border)'};background:${done?'#22c55e':'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:1px">
        ${done?'<span style="color:#07090f;font-size:12px;font-weight:900">✓</span>':''}
      </button>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:${done?'var(--muted)':'var(--text)'};${done?'text-decoration:line-through':''}">${escapeHTML(item.title)}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.6">${escapeHTML(item.detail)}</div>
        ${item.url?`<a href="${item.url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan);margin-top:8px;display:inline-block">Open → ${escapeHTML(item.url.replace('https://',''))}</a>`:''}
      </div>
    </div>`;
  }).join('');
  const pct = Math.round((seoProgress.length / SEO_ITEMS.length) * 100);
  const existing = document.getElementById('seo-progress');
  if (existing) existing.remove();
  const prog = document.createElement('div');
  prog.id = 'seo-progress';
  prog.style.cssText = 'margin-bottom:20px';
  prog.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="font-weight:700">Progress</span><span style="color:var(--muted)">${seoProgress.length} of ${SEO_ITEMS.length} complete</span></div>
    <div style="background:var(--surface);border-radius:8px;height:8px;overflow:hidden"><div style="background:var(--cyan);height:100%;width:${pct}%;border-radius:8px;transition:width .4s"></div></div>`;
  el.parentElement.insertBefore(prog, el);
}

function toggleSEO(idx) {
  const i = seoProgress.indexOf(idx);
  if (i >= 0) seoProgress.splice(i, 1); else seoProgress.push(idx);
  localStorage.setItem('ss_seo', JSON.stringify(seoProgress));
  renderSEOChecklist();
}

// ==========================================
// LIVE VISITORS WIDGET — self-hosted analytics (no GA needed)
// ==========================================
let selfAnalyticsCache = null;
async function loadVisitorWidget() {
  const widget = document.getElementById('live-widget');
  if (!widget) return;
  try {
    const r = await fetch('/.netlify/functions/analytics-self?days=30', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    if (!r.ok) { widget.style.display = 'none'; return; }
    const d = await r.json();
    if (!d.ok) { widget.style.display = 'none'; return; }
    selfAnalyticsCache = d;
    widget.style.display = 'block';
    document.getElementById('lv-sessions').textContent = (d.overview.sessions || 0).toLocaleString();
    document.getElementById('lv-users').textContent = (d.overview.visitors || 0).toLocaleString();
    document.getElementById('lv-pageviews').textContent = (d.overview.pageviews || 0).toLocaleString();
    document.getElementById('lv-bounce').textContent = (d.overview.bounceRate || 0) + '%';
    const live = document.getElementById('lv-live');
    if (live) live.textContent = (d.overview.live || 0);
    const todayEl = document.getElementById('lv-today');
    if (todayEl) todayEl.textContent = (d.overview.today || 0);
    const topEl = document.getElementById('lv-top-page');
    if (topEl && d.topPages && d.topPages.length) {
      topEl.textContent = d.topPages[0].path + ' (' + d.topPages[0].views.toLocaleString() + ' views)';
    } else if (topEl) {
      topEl.textContent = '—';
    }
    // Sparkline (last 7 days)
    const spark = document.getElementById('lv-spark');
    if (spark && d.series && d.series.length) {
      drawSparkline(spark, d.series.slice(-14).map(s => s.views));
    }
  } catch {
    widget.style.display = 'none';
  }
}

function drawSparkline(svg, values) {
  if (!values || !values.length) { svg.innerHTML = ''; return; }
  const max = Math.max(1, ...values);
  const w = svg.clientWidth || 320;
  const h = svg.clientHeight || 36;
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ' L ' + w + ',' + h + ' L 0,' + h + ' Z';
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `<defs><linearGradient id="lvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00C8E0" stop-opacity=".5"/><stop offset="1" stop-color="#00C8E0" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#lvg)"></path>
    <path d="${path}" fill="none" stroke="#00C8E0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>`;
}

// Renders the full Analytics tab from self-hosted data
async function loadSelfAnalytics() {
  const status = document.getElementById('analytics-status');
  if (status) status.textContent = 'Loading…';
  try {
    const r = await fetch('/.netlify/functions/analytics-self?days=30', {
      headers: { 'x-admin-password': ADMIN_PW }
    });
    const d = await r.json();
    if (!d.ok) {
      if (status) status.textContent = 'No analytics yet — visit your site to record traffic';
      return;
    }
    selfAnalyticsCache = d;
    // Top numbers
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setT('sa-pageviews', d.overview.pageviews.toLocaleString());
    setT('sa-visitors', d.overview.visitors.toLocaleString());
    setT('sa-sessions', d.overview.sessions.toLocaleString());
    setT('sa-duration', Math.floor(d.overview.avgDuration/60) + 'm ' + (d.overview.avgDuration%60) + 's');
    setT('sa-bounce', d.overview.bounceRate + '%');
    setT('sa-live', d.overview.live);
    setT('sa-today', d.overview.today);
    setT('sa-forms', d.overview.formSubmits);
    setT('sa-ctas', d.overview.ctaClicks);

    // Series chart
    const chart = document.getElementById('sa-chart');
    if (chart && d.series) drawSeriesChart(chart, d.series);

    // Top pages
    const pagesEl = document.getElementById('sa-pages');
    if (pagesEl) {
      pagesEl.innerHTML = d.topPages.length
        ? d.topPages.map(p => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(p.path)}</span><span class="sa-row-r">${p.views.toLocaleString()} <span style="color:var(--dim)">(${p.visitors})</span></span></div>`).join('')
        : '<div class="empty">No data yet</div>';
    }

    // Referrers
    const refsEl = document.getElementById('sa-refs');
    if (refsEl) {
      refsEl.innerHTML = d.topReferrers.length
        ? d.topReferrers.map(r => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(r.host)}</span><span class="sa-row-r">${r.count.toLocaleString()}</span></div>`).join('')
        : '<div class="empty">No referrers yet — most traffic is direct</div>';
    }

    // Countries
    const cEl = document.getElementById('sa-countries');
    if (cEl) {
      cEl.innerHTML = d.countries.length
        ? d.countries.map(c => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(c.name)}</span><span class="sa-row-r">${c.count.toLocaleString()}</span></div>`).join('')
        : '<div class="empty">No country data yet</div>';
    }

    // Devices
    const dvEl = document.getElementById('sa-devices');
    if (dvEl) {
      const total = d.devices.reduce((s,x)=>s+x.count,0) || 1;
      dvEl.innerHTML = d.devices.map(x => {
        const pct = Math.round(x.count/total*100);
        return `<div class="sa-row"><span class="sa-row-l">${escapeHTML(x.name)} <span style="color:var(--dim);font-size:11px">${pct}%</span></span><span class="sa-row-r">${x.count.toLocaleString()}</span></div>
        <div style="height:3px;background:var(--dark3);border-radius:2px;margin:2px 0 8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--cyan);border-radius:2px"></div></div>`;
      }).join('');
    }

    // Browsers
    const bEl = document.getElementById('sa-browsers');
    if (bEl) {
      bEl.innerHTML = d.browsers.length
        ? d.browsers.map(b => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(b.name)}</span><span class="sa-row-r">${b.count.toLocaleString()}</span></div>`).join('')
        : '<div class="empty">No data yet</div>';
    }

    if (status) status.textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) + ' · ' + d.rangeDays + 'd';
  } catch (err) {
    if (status) status.textContent = 'Error: ' + err.message;
  }
}

function drawSeriesChart(svg, series) {
  const w = svg.clientWidth || 720;
  const h = svg.clientHeight || 180;
  const pad = 30;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const max = Math.max(1, ...series.map(s => s.views));
  const step = innerW / Math.max(1, series.length - 1);
  const pts = series.map((s, i) => [pad + i * step, pad + (innerH - (s.views / max) * innerH)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${pad+innerW},${pad+innerH} L ${pad},${pad+innerH} Z`;
  const ticks = [0, 0.5, 1].map(t => pad + innerH - t * innerH);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
    <defs><linearGradient id="csg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00C8E0" stop-opacity=".35"/><stop offset="1" stop-color="#00C8E0" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(y => `<line x1="${pad}" x2="${w-pad}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`).join('')}
    <path d="${area}" fill="url(#csg)"></path>
    <path d="${path}" fill="none" stroke="#00C8E0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    ${pts.map((p,i) => i === pts.length-1 ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#00C8E0"/>` : '').join('')}
  `;
}

// ==========================================
// COMMAND PALETTE (Cmd+K)  (NEW)
// ==========================================
function initCommandPalette() {
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCmdK();
    }
    if (e.key === 'Escape') closeCmdK();
  });
  const overlay = document.getElementById('cmdk-overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeCmdK(); });
  const input = document.getElementById('cmdk-input');
  if (input) input.addEventListener('input', renderCmdK);
}

function openCmdK() {
  const overlay = document.getElementById('cmdk-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  const input = document.getElementById('cmdk-input');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
  renderCmdK();
}
function closeCmdK() {
  const overlay = document.getElementById('cmdk-overlay');
  if (overlay) overlay.classList.remove('open');
}

function renderCmdK() {
  const q = (document.getElementById('cmdk-input')?.value || '').toLowerCase();
  const items = [
    { lbl:'Dashboard',     kind:'nav',  go:()=>showPageByName('dashboard') },
    { lbl:'Pipeline',      kind:'nav',  go:()=>showPageByName('pipeline') },
    { lbl:'New Order',     kind:'nav',  go:()=>showPageByName('new-order') },
    { lbl:'Revenue',       kind:'nav',  go:()=>showPageByName('revenue') },
    { lbl:'Analytics',     kind:'nav',  go:()=>{showPageByName('analytics');loadAnalytics();} },
    { lbl:'Inbox',         kind:'nav',  go:()=>{showPageByName('inbox');loadInbox();} },
    { lbl:'Tickets',       kind:'nav',  go:()=>{showPageByName('tickets');loadTickets();} },
    { lbl:'Outreach',      kind:'nav',  go:()=>showPageByName('outreach') },
    { lbl:'SEO Setup',     kind:'nav',  go:()=>showPageByName('seo') },
    { lbl:'Backlinks',     kind:'nav',  go:()=>showPageByName('backlinks') },
    { lbl:'Refresh data',  kind:'cmd',  go:()=>refreshData() },
    { lbl:'Export to Excel', kind:'cmd', go:()=>exportData() },
    { lbl:'Ping sitemaps', kind:'cmd',  go:()=>pingSitemaps() },
    { lbl:'Test submission', kind:'cmd', go:()=>testSubmission() },
    { lbl:'Sign out',      kind:'cmd',  go:()=>logout() },
    ...allClients.slice(0, 25).map(c => ({
      lbl: '🧑 ' + (c.business_name || c.name || c.clientId),
      kind: 'client',
      go: () => { showPageByName('pipeline'); openClient(c.clientId); }
    })),
  ];
  const filtered = q ? items.filter(it => it.lbl.toLowerCase().includes(q)) : items;
  const el = document.getElementById('cmdk-results');
  if (!el) return;
  el.innerHTML = filtered.slice(0, 30).map((it, i) =>
    `<div class="cmdk-item" data-i="${i}">
      <span>${escapeHTML(it.lbl)}</span>
      <span class="cmdk-kind">${it.kind}</span>
    </div>`).join('');
  el.querySelectorAll('.cmdk-item').forEach((node, i) => {
    node.addEventListener('click', () => { closeCmdK(); filtered[i].go(); });
  });
}

function showPageByName(name) {
  const btn = document.querySelector('[data-page="' + name + '"]');
  showPage(name, btn);
}

// ==========================================
// GLOBAL SEARCH (topbar)
// ==========================================
function initGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;
  input.addEventListener('focus', openCmdK);
  input.addEventListener('click', openCmdK);
}

// ==========================================
// PAGE SWITCHING — preserves original behavior
// ==========================================
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'analytics') { loadSelfAnalytics(); loadAnalytics(); }
  if (id === 'outreach') { renderProspects(); renderDorkPicker(); }
  if (id === 'seo') renderSEOChecklist();
  if (id === 'backlinks') renderDirectories();
}

// ==========================================
// BOOTSTRAP — outreach/seo render on DOMContentLoaded
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  renderProspects();
  renderSEOChecklist();
  renderDorkPicker();
  renderDirectories();
  // Wire dork picker selects
  const dn = document.getElementById('dork-niche');
  const dt = document.getElementById('dork-town');
  if (dn) dn.addEventListener('change', renderDorkPicker);
  if (dt) dt.addEventListener('change', renderDorkPicker);
});
