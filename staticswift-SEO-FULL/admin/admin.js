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

  // Server-side check only. The password never appears in shipped JS;
  // the function validates against the ADMIN_PASSWORD env var.
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
  // Re-validate the cached password before trusting it. If ADMIN_PASSWORD was
  // rotated in Netlify the old cached value would otherwise load the app shell
  // and then 401 every single call ("check ADMIN_PASSWORD/deploy"). Verify
  // once; if it is stale, clear it and drop back to the login screen.
  ADMIN_PW = savedPw;
  fetch('/.netlify/functions/get-clients', { headers: { 'x-admin-password': savedPw } })
    .then(r => {
      if (r.ok) { showApp(); initApp(); }
      else { sessionStorage.removeItem('ss_pw'); ADMIN_PW = ''; const e = document.getElementById('login-err'); if (e) e.style.display = 'block'; }
    })
    .catch(() => { /* network down: let them try the login form */ });
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
    const raw = await r.json();
    // CRITICAL: soft-deleted records (stage='deleted' OR deletedAt set) must
    // NEVER appear in the admin UI. Previously the delete fallback wrote
    // stage='deleted' to the bin but the UI didn't filter — so deleted clients
    // reappeared on every refresh, which felt like "delete isn't working".
    // We also schedule a background purge for any soft-deleted records the
    // server hasn't garbage-collected yet, so they really disappear.
    const list = Array.isArray(raw) ? raw : [];
    const visible = list.filter(c => c && c.stage !== 'deleted' && !c.deletedAt);
    const stillSoftDeleted = list.filter(c => c && (c.stage === 'deleted' || c.deletedAt));
    if (stillSoftDeleted.length) {
      console.warn('[fetchClients] purging', stillSoftDeleted.length, 'soft-deleted records server-side');
      // Fire-and-forget hard-deletes for the leftovers.
      stillSoftDeleted.forEach(c => {
        fetch('/.netlify/functions/delete-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
          body: JSON.stringify({ clientId: c.clientId }),
        }).catch(() => {});
      });
    }
    allClients = visible;
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
  } catch (err) {
    console.error('[initApp] fetchClients failed — rendering empty state:', err);
    allClients = Array.isArray(allClients) ? allClients : [];
    showOfflineBanner('Could not load clients from server. Some pages will be empty until you click Refresh.');
  }
  // Render all pages regardless of fetch outcome — otherwise users see
  // permanent "Loading..." placeholders when the backend is unreachable.
  try { renderDashboard(); } catch (e) { console.error('renderDashboard:', e); }
  try { loadDashWorkforce(); } catch (e) { console.error('loadDashWorkforce:', e); }
  try { renderPipeline(); } catch (e) { console.error('renderPipeline:', e); }
  try { renderRevenue(); } catch (e) { console.error('renderRevenue:', e); }
  try { renderPrompts(); } catch (e) { console.error('renderPrompts:', e); }
  try { initCommandPalette(); } catch (e) { console.error('initCommandPalette:', e); }
  try { initGlobalSearch(); } catch (e) { console.error('initGlobalSearch:', e); }
  setInterval(() => {
    dashAnalyticsCache = null;
    renderDashTraffic();
  }, 60_000);
}

function showOfflineBanner(msg) {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#07090f;padding:10px 20px;font-size:13px;font-weight:600;text-align:center';
  banner.textContent = '⚠ ' + msg;
  document.body.prepend(banner);
}

async function refreshData() {
  const btn = document.querySelector('.refresh-btn');
  if (btn) btn.textContent = '↻ Refreshing...';
  try {
    await fetchClients();
    const banner = document.getElementById('offline-banner');
    if (banner) banner.remove();
    dashAnalyticsCache = null;
    dashGscCache = null;
    renderDashboard();
    renderPipeline();
    renderRevenue();
    if (currentClientId) {
      const fresh = allClients.find(c => c.clientId === currentClientId);
      if (fresh) openClient(currentClientId);
    }
  } catch(e) { console.error('refreshData error:', e.message); }
  if (btn) btn.textContent = '↻ Refresh';
}

// ==========================================
// DASHBOARD — focused on daily decisions
// ==========================================
let funnelRange = 7;
let dashAnalyticsCache = null;
let dashGscCache = null;

function renderDashboard() {
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const last30 = now - 30 * 86400000;

  // Revenue tile (last 30 days)
  const paidLast30 = allClients.filter(c => c.paid && c.paidAt && new Date(c.paidAt).getTime() >= last30);
  const invoicedLast30 = allClients.filter(c =>
    (c.invoiceSentAt && new Date(c.invoiceSentAt).getTime() >= last30) ||
    (c.paid && c.paidAt && new Date(c.paidAt).getTime() >= last30)
  );
  const collected = paidLast30.reduce((s, c) => s + (c.amount || (c.package === 'advanced' ? 299 : 149)), 0);
  const invoicedSum = invoicedLast30.reduce((s, c) => s + (c.amount || (c.package === 'advanced' ? 299 : 149)), 0);
  const outstanding = allClients.filter(c => c.stage === 'invoice-sent' && !c.paid)
    .reduce((s, c) => s + (c.amount || (c.package === 'advanced' ? 299 : 149)), 0);

  setText('rev-collected', '£' + collected);
  setText('rev-invoiced', '£' + invoicedSum);
  setText('rev-outstanding', '£' + outstanding);

  // Hosting MRR-style estimate: count of clients with hosting_addon === 'yes' x £29
  const hostingCount = allClients.filter(c => c.hosting_addon === 'yes' && c.paid).length;
  setText('rev-mrr', hostingCount + ' on hosting · ~£' + (hostingCount * 29) + '/mo recurring');

  // Topbar month total
  const paidMonth = allClients.filter(c => c.paid && c.paidAt && new Date(c.paidAt).getTime() >= monthStart)
    .reduce((s, c) => s + (c.amount || 149), 0);
  setText('month-revenue', '£' + paidMonth + ' this month');
  setText('dash-meta', allClients.length + ' clients · ' + paidMonth + ' GBP this month');

  // Sidebar badge
  const newCountEl = document.getElementById('nav-count-pipeline');
  if (newCountEl) {
    const newLeads = allClients.filter(c => c.stage === 'new-lead').length;
    if (newLeads > 0) { newCountEl.textContent = newLeads; newCountEl.classList.add('has-count'); }
    else newCountEl.classList.remove('has-count');
  }

  // Urgent list
  renderUrgent();

  // Today's leads
  renderTodaysLeads();

  // Funnel
  renderFunnel(funnelRange);

  // Reply queue (uses any cached inbox)
  renderReplyQueue();

  // GSC + traffic panels (lazy fetch)
  renderDashTraffic();
  renderGscMovers();
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function renderUrgent() {
  const list = document.getElementById('urgent-list');
  if (!list) return;
  const ts = Date.now();
  const urgents = [];
  allClients.forEach(c => {
    const bn = c.business_name || c.name || 'Client';
    if (c.stage === 'preview-sent' && c.previewSentAt) {
      const h = (ts - new Date(c.previewSentAt).getTime()) / 3600000;
      if (h >= 48) urgents.push({ label: bn + ' — preview, no response', age: Math.round(h) + 'h', id: c.clientId, sort: h });
    }
    if (c.stage === 'invoice-sent' && !c.paid && c.invoiceSentAt) {
      const d = (ts - new Date(c.invoiceSentAt).getTime()) / 86400000;
      if (d >= 3) urgents.push({ label: bn + ' — invoice unpaid', age: Math.round(d) + 'd', id: c.clientId, sort: d * 24 });
    }
    if (c.stage === 'new-lead' && c.createdAt) {
      const h = (ts - new Date(c.createdAt).getTime()) / 3600000;
      if (h >= 24) urgents.push({ label: bn + ' — lead not replied', age: Math.round(h) + 'h', id: c.clientId, sort: h });
    }
    if (c.changeRequest && !c.changeRequestRepliedAt) {
      urgents.push({ label: bn + ' — change request', age: 'open', id: c.clientId, sort: 9999 });
    }
  });
  urgents.sort((a, b) => b.sort - a.sort);
  setText('urgent-count', urgents.length);
  list.innerHTML = urgents.length
    ? urgents.slice(0, 6).map(u =>
        `<div class="urg-row" onclick="openClient('${u.id}')">
          <span class="urg-lbl">${escapeHTML(u.label)}</span>
          <span class="urg-age">${escapeHTML(u.age)}</span>
        </div>`).join('')
    : '<div class="dash-empty">All caught up.</div>';
}

function renderTodaysLeads() {
  const list = document.getElementById('todays-leads');
  if (!list) return;
  const since = Date.now() - 24 * 3600 * 1000;
  const leads = allClients
    .filter(c => c.createdAt && new Date(c.createdAt).getTime() >= since)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  setText('leads-count', leads.length);
  if (!leads.length) {
    list.innerHTML = '<div class="dash-empty">No new leads in the last 24 hours.</div>';
    return;
  }
  list.innerHTML = leads.slice(0, 8).map(c => {
    const biz = escapeHTML(c.business_name || c.name || '—');
    const meta = escapeHTML([c.business_type, c.location].filter(Boolean).join(' · ') || (c.delivery_email || ''));
    const replied = c.firstReplyAt ? '<span class="lead-btn" style="background:rgba(34,197,94,.1);color:var(--green);border-color:rgba(34,197,94,.25);cursor:default">Replied ✓</span>' :
      `<button class="lead-btn" onclick="event.stopPropagation();sendFirstReply('${c.clientId}',this)">Send first reply</button>`;
    return `<div class="lead-row" onclick="openClient('${c.clientId}')" style="cursor:pointer">
      <div class="lead-main">
        <div class="lead-biz">${biz}</div>
        <div class="lead-meta">${meta}</div>
      </div>
      <span class="lead-time">${timeAgo(c.createdAt)}</span>
      ${replied}
    </div>`;
  }).join('');
}

function renderFunnel(range) {
  const body = document.getElementById('funnel-body');
  if (!body) return;
  const since = Date.now() - range * 86400000;
  const visits = dashAnalyticsCache?.series
    ? dashAnalyticsCache.series.slice(-range).reduce((s, d) => s + (d.views || 0), 0)
    : null;
  const formSubmits = dashAnalyticsCache?.overview?.formSubmits ?? null;
  // Form views = CTA clicks if available (proxy), else null
  const formViews = dashAnalyticsCache?.overview?.ctaClicks ?? null;
  const intakesInRange = allClients.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= since && c.source === 'intake-form').length;
  const paidInRange = allClients.filter(c => c.paid && c.paidAt && new Date(c.paidAt).getTime() >= since).length;

  const steps = [
    { lbl: 'Visits', val: visits, hint: range + 'd page views' },
    { lbl: 'Form views', val: formViews, hint: 'CTA clicks on intake' },
    { lbl: 'Form submits', val: Math.max(formSubmits ?? 0, intakesInRange), hint: 'Leads received' },
    { lbl: 'Paid clients', val: paidInRange, hint: range + 'd' },
  ];
  const top = Math.max(1, ...steps.map(s => s.val || 0));
  body.innerHTML = steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].val : null;
    const pct = (prev && prev > 0 && s.val != null) ? ((s.val / prev) * 100).toFixed(1) + '% from prev' : (i === 0 ? s.hint : '—');
    const barH = s.val != null ? Math.max(8, Math.round((s.val / top) * 100)) : 8;
    return `<div class="funnel-step">
      <div class="fbar" style="height:${barH}%"></div>
      <div class="fcontent">
        <div class="fnum">${s.val == null ? '—' : Number(s.val).toLocaleString()}</div>
        <div class="flbl">${s.lbl}</div>
        <div class="fpct">${pct}</div>
      </div>
    </div>`;
  }).join('');
}

function renderReplyQueue() {
  const list = document.getElementById('reply-queue');
  if (!list) return;
  const items = [];
  const ts = Date.now();
  // Inbox emails (unread proxy — incoming emails, sorted by age)
  if (Array.isArray(inboxEmails) && inboxEmails.length) {
    inboxEmails.slice(0, 30).forEach(e => {
      const ageH = (ts - new Date(e.date).getTime()) / 3600000;
      items.push({
        kind: 'inbox',
        from: e.from || '—',
        subj: e.subject || '(no subject)',
        ageH,
        click: () => { showPage('inbox', document.querySelector('[data-page="inbox"]')); loadInbox(); }
      });
    });
  }
  // Portal messages waiting reply
  allClients.forEach(c => {
    if (Array.isArray(c.portalMessages)) {
      const last = c.portalMessages[c.portalMessages.length - 1];
      if (last && last.from === 'client') {
        const ageH = (ts - new Date(last.sentAt).getTime()) / 3600000;
        items.push({
          kind: 'portal',
          from: (c.name || c.business_name || 'Client') + ' (portal)',
          subj: (last.notes || last.text || '').slice(0, 80),
          ageH,
          click: () => openClient(c.clientId)
        });
      }
    }
    if (c.changeRequest && !c.changeRequestRepliedAt) {
      const ageH = c.changeRequestAt ? (ts - new Date(c.changeRequestAt).getTime()) / 3600000 : 999;
      items.push({
        kind: 'change',
        from: (c.business_name || c.name) + ' (change request)',
        subj: c.changeRequest.slice(0, 80),
        ageH,
        click: () => openClient(c.clientId)
      });
    }
  });
  items.sort((a, b) => b.ageH - a.ageH);
  setText('reply-count', items.length);
  if (!items.length) {
    list.innerHTML = '<div class="dash-empty">Nothing waiting for a reply. Click Refresh on the inbox tab to pull mail.</div>';
    return;
  }
  list.innerHTML = items.slice(0, 8).map((it, idx) => {
    const cls = it.ageH > 48 ? 'late' : it.ageH > 24 ? 'warn' : 'fresh';
    const ageLbl = it.ageH < 1 ? Math.round(it.ageH * 60) + 'm' :
                   it.ageH < 24 ? Math.round(it.ageH) + 'h' :
                   Math.round(it.ageH / 24) + 'd';
    return `<div class="reply-row" data-rqi="${idx}">
      <div class="r-main">
        <div class="r-from">${escapeHTML(it.from)}</div>
        <div class="r-subj">${escapeHTML(it.subj)}</div>
      </div>
      <span class="r-age ${cls}">${ageLbl}</span>
    </div>`;
  }).join('');
  // Attach handlers
  list.querySelectorAll('.reply-row').forEach(node => {
    const i = parseInt(node.dataset.rqi, 10);
    node.addEventListener('click', () => items[i].click());
  });
}

// Dashboard workforce strip — surfaces the staff so the dashboard is a true
// one-stop shop. Reuses the same workforce-status endpoint as the tab.
async function loadDashWorkforce() {
  try {
    const r = await fetch('/.netlify/functions/workforce-status', { headers: { 'x-admin-password': ADMIN_PW } });
    if (!r.ok) return;
    const d = await r.json();
    const pend = (d.queue && d.queue.counts && d.queue.counts.pending) || 0;
    const pe = document.getElementById('wfx-pending');
    if (pe) { pe.textContent = pend; pe.classList.toggle('zero', pend === 0); }
    const se = document.getElementById('wfx-sent'); if (se) se.textContent = (d.queue && d.queue.sentToday) || 0;
    const nb = document.getElementById('nav-count-queue'); if (nb) nb.textContent = pend ? pend : '';
    const shifts = d.shifts || {};
    const se2 = document.getElementById('wfx-shifts');
    if (se2) se2.innerHTML = ['morning', 'midday', 'evening'].map(function (k) {
      const s = shifts[k] || {}; const cls = s.running ? 'live' : s.stale ? 'stale' : 'ok';
      return '<span class="wfx-sdot ' + cls + '">' + k[0] + '</span>';
    }).join('');
    const last = (d.activity || [])[0];
    const le = document.getElementById('wfx-last');
    if (le) le.textContent = last ? (last.role + ': ' + last.action) : 'The studio is idle.';
  } catch (_) {}
}

function renderDashTraffic() {
  const box = document.getElementById('dash-traffic');
  if (!box) return;
  if (!dashAnalyticsCache) {
    fetch('/.netlify/functions/analytics-self?days=30', { headers: { 'x-admin-password': ADMIN_PW } })
      .then(r => r.json())
      .then(d => { if (d.ok) { dashAnalyticsCache = d; renderDashTraffic(); renderFunnel(funnelRange); } })
      .catch(() => { box.innerHTML = '<div class="dash-empty">Traffic data unavailable.</div>'; });
    return;
  }
  const ov = dashAnalyticsCache.overview || {};
  setText('live-count', (ov.live || 0) + ' live');
  const topPage = (dashAnalyticsCache.topPages && dashAnalyticsCache.topPages[0]) || null;
  box.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
      <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800">${(ov.today || 0).toLocaleString()}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Today</div></div>
      <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800">${(ov.pageviews || 0).toLocaleString()}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">30d views</div></div>
      <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800">${(ov.visitors || 0).toLocaleString()}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Visitors</div></div>
    </div>
    <svg id="dash-spark" style="width:100%;height:48px;display:block"></svg>
    <div style="margin-top:10px;font-size:12px;color:var(--muted)"><strong style="color:var(--text)">Top page:</strong> ${topPage ? escapeHTML(topPage.path) + ' (' + topPage.views + ')' : '—'}</div>
  `;
  const spark = document.getElementById('dash-spark');
  if (spark && dashAnalyticsCache.series) drawSparkline(spark, dashAnalyticsCache.series.slice(-14).map(s => s.views));
}

function renderGscMovers() {
  const box = document.getElementById('gsc-movers');
  if (!box) return;
  if (!dashGscCache) {
    fetch('/.netlify/functions/search-console-data', { headers: { 'x-admin-password': ADMIN_PW } })
      .then(r => r.json())
      .then(d => {
        if (d.unavailable) {
          box.innerHTML = '<div class="dash-empty">Search Console not connected. <a href="#" onclick="showPage(\'analytics\',document.querySelector(\'[data-page=&quot;analytics&quot;]\'));return false">Set up →</a></div>';
          return;
        }
        dashGscCache = d;
        renderGscMovers();
      })
      .catch(() => { box.innerHTML = '<div class="dash-empty">Search Console unavailable.</div>'; });
    return;
  }
  const queries = dashGscCache.topQueries || [];
  setText('gsc-count', queries.length);
  if (!queries.length) {
    box.innerHTML = '<div class="dash-empty">No query data yet — new sites take 4–16 weeks to populate.</div>';
    return;
  }
  const site = 'https://staticswift.co.uk/';
  box.innerHTML = queries.slice(0, 10).map(q => {
    const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(q.query + ' site:staticswift.co.uk');
    return `<div class="gsc-row">
      <a href="${searchUrl}" target="_blank" rel="noopener" title="Open in Google">${escapeHTML(q.query)}</a>
      <span class="gsc-impr">${(q.impressions || 0).toLocaleString()} impr</span>
      <span class="gsc-pos">#${q.position}</span>
    </div>`;
  }).join('');
}

// Wire funnel toggle
document.addEventListener('click', e => {
  const btn = e.target.closest('#funnel-toggle button');
  if (!btn) return;
  document.querySelectorAll('#funnel-toggle button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  funnelRange = parseInt(btn.dataset.range, 10) || 7;
  renderFunnel(funnelRange);
});

// ==========================================
// DASHBOARD ACTIONS
// ==========================================
async function sendFirstReply(clientId, btn) {
  const c = allClients.find(x => x.clientId === clientId);
  if (!c) return;
  const firstName = (c.name || 'there').split(' ')[0];
  const biz = c.business_name || 'your business';
  const body = `Hi ${firstName},\n\nThanks for getting in touch about ${biz} — I'm Harry from StaticSwift. I've reviewed your brief and I'll start work on your preview today. You'll see a link within 24 hours (please check your junk folder).\n\nAnything you want me to know before I start, just reply here.\n\nThanks,\nHarry`;
  const subject = `Your StaticSwift order — ${biz}`;
  if (!confirm(`Send first reply to ${c.delivery_email}?`)) return;
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  try {
    const r = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ clientId, emailType: 'custom', customSubject: subject, customBody: body })
    });
    const d = await r.json();
    if (d.ok) {
      await updateClient(clientId, { firstReplyAt: new Date().toISOString() });
      const idx = allClients.findIndex(x => x.clientId === clientId);
      if (idx >= 0) allClients[idx].firstReplyAt = new Date().toISOString();
      renderTodaysLeads();
    } else {
      alert('Failed: ' + (d.error || 'unknown'));
      if (btn) { btn.textContent = 'Send first reply'; btn.disabled = false; }
    }
  } catch (err) {
    alert('Network error: ' + err.message);
    if (btn) { btn.textContent = 'Send first reply'; btn.disabled = false; }
  }
}

// ─── INVOICE MODAL ─────────────────────────────────────────────
// A single, in-place modal that takes a client record and:
//   1. Shows exactly what's about to be billed (package, hosting, total).
//   2. Has the delivery email PRE-FILLED and editable in case it's wrong.
//   3. Has ONE primary button — "Send invoice now" — that posts directly to
//      send-email with emailType='invoice'. No tab dance, no auth handoff,
//      no popup blockers. Works first time, every time.
//   4. Has a secondary "Customise first" button that does open the full
//      generator, for the rare case the user needs to add a line item or
//      change pricing.
function ssShowInvoiceModal(c) {
  // Two modes:
  //   - WITH a client (c is the record): everything pre-filled, one-click send.
  //   - WITHOUT a client (c = null): blank mode for ad-hoc / referral billing.
  //     The user types recipient + amount manually; send still works.
  const isBlank = !c;
  if (!isBlank && !c.clientId) {
    console.warn('[invoice modal] client missing clientId, falling back to blank mode:', c);
    c = null;
  }

  // Remove an old one if it's already up (re-click resets it cleanly)
  const existing = document.getElementById('ss-invoice-modal');
  if (existing) existing.remove();

  const adv = !isBlank && c.package === 'advanced';
  const hosting = !isBlank && c.hosting_addon === 'yes';
  const base = adv ? 299 : 149;
  const hostingAmt = hosting ? 29 : 0;
  const total = base + hostingAmt;
  const email = (!isBlank && c.delivery_email) || '';
  const bizName = !isBlank ? (c.business_name || c.name || 'Client') : 'New invoice';
  const clientName = !isBlank ? (c.name || c.business_name || '') : '';

  const wrap = document.createElement('div');
  wrap.id = 'ss-invoice-modal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"DM Sans",system-ui,sans-serif;animation:ssfadein .25s';
  wrap.innerHTML = `
    <style>
      @keyframes ssfadein{from{opacity:0}to{opacity:1}}
      @keyframes ssslidein{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      #ssim-box{background:linear-gradient(180deg,#0f1320,#0a0d16);border:1px solid rgba(255,255,255,.1);border-radius:18px;max-width:520px;width:100%;padding:0;color:#f0f2f8;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden;animation:ssslidein .35s cubic-bezier(.19,1,.22,1)}
      #ssim-head{padding:22px 26px 18px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between}
      #ssim-title{font-size:18px;font-weight:600;letter-spacing:-.01em;color:#fff}
      #ssim-eyebrow{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#00c6ff;margin-bottom:4px}
      #ssim-close{background:rgba(255,255,255,.06);width:32px;height:32px;border-radius:8px;color:#aaa;font-size:18px;cursor:pointer;border:0;display:grid;place-items:center}
      #ssim-close:hover{background:rgba(255,255,255,.12);color:#fff}
      #ssim-body{padding:22px 26px}
      .ssim-rows{display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,.06);border-radius:12px;overflow:hidden;margin-bottom:18px}
      .ssim-row{display:flex;justify-content:space-between;padding:14px 16px;background:#0d1018;font-size:14px}
      .ssim-row .l{color:#8890a8}
      .ssim-row .r{color:#f0f2f8;font-variant-numeric:tabular-nums;font-weight:500}
      .ssim-row.total{background:rgba(0,198,255,.08);font-weight:700}
      .ssim-row.total .l,.ssim-row.total .r{color:#7de8ff;font-size:16px}
      .ssim-field{margin-bottom:18px}
      .ssim-field label{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8890a8;margin-bottom:8px}
      .ssim-field input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#f0f2f8;font-family:inherit;font-size:14px;padding:11px 14px;border-radius:10px;outline:none;transition:all .2s}
      .ssim-field input:focus{border-color:#00c6ff;background:rgba(0,198,255,.06);box-shadow:0 0 0 3px rgba(0,198,255,.14)}
      .ssim-notice{padding:12px 14px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.22);border-radius:10px;font-size:12.5px;color:#22c55e;margin-bottom:18px;line-height:1.55}
      #ssim-foot{padding:18px 26px 22px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:10px;flex-wrap:wrap}
      #ssim-foot button{flex:1;padding:14px;border-radius:100px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;border:0;transition:all .25s;min-width:140px}
      .ssim-primary{background:linear-gradient(135deg,#7de8ff,#00c6ff);color:#0a0a0a;box-shadow:0 8px 24px rgba(0,168,216,.4)}
      .ssim-primary:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(0,168,216,.55)}
      .ssim-primary:disabled{opacity:.5;cursor:wait;transform:none}
      .ssim-secondary{background:rgba(255,255,255,.06);color:#f0f2f8;border:1px solid rgba(255,255,255,.12)}
      .ssim-secondary:hover{background:rgba(255,255,255,.1)}
      #ssim-status{padding:0 26px 18px;font-size:13px;display:none}
      #ssim-status.err{color:#f87171;display:block}
      #ssim-status.ok{color:#22c55e;display:block}
    </style>
    <div id="ssim-box" role="dialog" aria-modal="true" aria-labelledby="ssim-title">
      <div id="ssim-head">
        <div>
          <div id="ssim-eyebrow">£ Invoice</div>
          <div id="ssim-title">${isBlank ? 'Create &amp; send invoice' : 'Send invoice to ' + escapeHTML(bizName)}</div>
        </div>
        <button id="ssim-close" aria-label="Close">✕</button>
      </div>
      <div id="ssim-body">
        ${isBlank ? `
        <!-- Blank mode: user picks package + types recipient details by hand -->
        <div class="ssim-field">
          <label for="ssim-toName">Client / business name</label>
          <input type="text" id="ssim-toName" placeholder="Acme Plumbing" autocomplete="organization">
        </div>
        <div class="ssim-field">
          <label for="ssim-pkg">Package</label>
          <select id="ssim-pkg" style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#f0f2f8;font-family:inherit;font-size:14px;padding:11px 14px;border-radius:10px;outline:none">
            <option value="starter">Starter — £149</option>
            <option value="advanced">Advanced — £299</option>
            <option value="custom">Custom amount</option>
          </select>
        </div>
        <div class="ssim-field" id="ssim-customWrap" style="display:none">
          <label for="ssim-customAmt">Custom amount (£)</label>
          <input type="number" id="ssim-customAmt" min="0" step="1" placeholder="149" value="149">
        </div>
        <label style="display:flex;align-items:center;gap:8px;color:#8890a8;font-size:13px;margin-bottom:18px;cursor:pointer">
          <input type="checkbox" id="ssim-hosting" style="accent-color:#00c6ff"> Include hosting upload (+£29)
        </label>
        ` : `
        <div class="ssim-rows">
          <div class="ssim-row"><span class="l">${adv ? 'Advanced' : 'Starter'} Website Design</span><span class="r">£${base}</span></div>
          ${hosting ? `<div class="ssim-row"><span class="l">Hosting upload service</span><span class="r">£29</span></div>` : ''}
          <div class="ssim-row total"><span class="l">Total due</span><span class="r">£${total}</span></div>
        </div>
        `}
        <div class="ssim-field">
          <label for="ssim-email">Send to ${isBlank ? '' : '(auto-filled from client record)'}</label>
          <input type="email" id="ssim-email" value="${escapeHTML(email)}" autocomplete="email" placeholder="client@example.com">
        </div>
        <div class="ssim-notice">
          ✓ Includes bank transfer details, polished email template${isBlank ? '' : ', and auto-progresses the client to <strong>Invoice Sent</strong> stage'}.
        </div>
      </div>
      <div id="ssim-status"></div>
      <div id="ssim-foot">
        ${isBlank ? '' : '<button class="ssim-secondary" id="ssim-customise">Customise line items</button>'}
        <button class="ssim-primary" id="ssim-send">Send invoice now →</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // Close handlers
  const close = () => wrap.remove();
  wrap.querySelector('#ssim-close').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  // Blank mode: show/hide custom-amount field when "Custom" selected
  if (isBlank) {
    const pkgSel = wrap.querySelector('#ssim-pkg');
    const customWrap = wrap.querySelector('#ssim-customWrap');
    pkgSel.addEventListener('change', () => {
      customWrap.style.display = pkgSel.value === 'custom' ? '' : 'none';
    });
  }

  // "Customise line items" → opens the full /invoice/ generator pre-filled
  const customBtn = wrap.querySelector('#ssim-customise');
  if (customBtn) {
    customBtn.addEventListener('click', () => {
      const qs = new URLSearchParams();
      qs.set('clientId', c.clientId);
      if (c.business_name) qs.set('client_name', c.business_name);
      if (c.name) qs.set('client_contact', c.name);
      const liveEmail = wrap.querySelector('#ssim-email').value.trim() || c.delivery_email || '';
      if (liveEmail) qs.set('client_email', liveEmail);
      if (c.address || c.business_address) qs.set('client_addr', c.address || c.business_address);
      if (c.package) qs.set('package', c.package);
      if (c.hosting_addon) qs.set('hosting', c.hosting_addon);
      try { localStorage.setItem('ss_pw_handoff', JSON.stringify({ pw: ADMIN_PW, t: Date.now() })); } catch (e) {}
      const hash = ADMIN_PW ? ('#pw=' + encodeURIComponent(ADMIN_PW)) : '';
      const url = '/invoice/?' + qs.toString() + hash;
      const w = window.open(url, '_blank');
      if (!w) window.location.href = url;
      close();
    });
  }

  // "Send invoice now" — single in-place POST. Works for client AND blank.
  wrap.querySelector('#ssim-send').addEventListener('click', async () => {
    const btn = wrap.querySelector('#ssim-send');
    const status = wrap.querySelector('#ssim-status');
    const emailVal = wrap.querySelector('#ssim-email').value.trim();
    status.className = '';
    status.textContent = '';
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      status.className = 'err';
      status.textContent = 'Enter a valid email address.';
      return;
    }
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = 'Sending…';

    try {
      if (isBlank) {
        // Build a polished invoice HTML inline (we're not posting clientId,
        // so send-email's 'generated-invoice' path takes over — that path
        // accepts invoiceHtml + toEmail with no client lookup required).
        const pkgVal = wrap.querySelector('#ssim-pkg').value;
        const hostingOn = wrap.querySelector('#ssim-hosting').checked;
        let lineAmt = 149, lineDesc = 'Starter Website Design';
        if (pkgVal === 'advanced') { lineAmt = 299; lineDesc = 'Advanced Website Design'; }
        else if (pkgVal === 'custom') { lineAmt = parseFloat(wrap.querySelector('#ssim-customAmt').value) || 0; lineDesc = 'Website Design'; }
        const totalAmt = lineAmt + (hostingOn ? 29 : 0);
        const toName = wrap.querySelector('#ssim-toName').value.trim() || 'Customer';
        const invNumStr = 'SS-' + new Date().getFullYear() + '-' + String(Math.floor(Date.now()/1000) % 10000).padStart(4,'0');
        const invoiceHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1ea"><tr><td align="center" style="padding:32px 14px"><table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.06)"><tr><td style="padding:30px 36px 8px"><div style="font-size:20px;font-weight:800">StaticSwift</div><div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#b08a3e;margin-top:18px">Invoice ${invNumStr}</div><h1 style="font-family:Georgia,serif;font-size:24px;line-height:1.2;margin:8px 0 14px;font-weight:500">Hi ${escapeHTML(toName.split(/\s+/)[0])},</h1><p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 18px">Invoice attached. Bank transfer (or card on request) and we're sorted.</p></td></tr><tr><td style="padding:0 36px 12px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px"><tr style="background:#faf8f2"><td style="padding:12px 14px;border:1px solid #ece6d6">${escapeHTML(lineDesc)}</td><td style="padding:12px 14px;border:1px solid #ece6d6;text-align:right">£${lineAmt}</td></tr>${hostingOn ? `<tr><td style="padding:12px 14px;border:1px solid #ece6d6">Hosting upload service</td><td style="padding:12px 14px;border:1px solid #ece6d6;text-align:right">£29</td></tr>` : ''}<tr style="background:#0a0a0a;color:#fff;font-weight:700"><td style="padding:14px;border:1px solid #0a0a0a">Total due</td><td style="padding:14px;border:1px solid #0a0a0a;text-align:right;font-size:18px">£${totalAmt}</td></tr></table></td></tr><tr><td style="padding:18px 36px 26px"><div style="background:#faf8f2;border:1px solid #ece6d6;border-radius:10px;padding:18px 20px;font-size:13.5px;line-height:1.7"><strong>Bank transfer</strong><br>Beneficiary: Harry Yule<br>Sort code: 04-00-75<br>Account: 98518224<br>Reference: ${invNumStr}<br>Bank: Revolut Ltd</div></td></tr><tr><td style="padding:20px 36px 30px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999">Harry &middot; StaticSwift &middot; <a href="https://staticswift.co.uk" style="color:#b08a3e;text-decoration:none">staticswift.co.uk</a></td></tr></table></td></tr></table></body></html>`;
        const r = await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
          body: JSON.stringify({
            emailType: 'generated-invoice',
            toEmail: emailVal, toName,
            subject: 'Invoice ' + invNumStr + ' — StaticSwift — £' + totalAmt.toFixed(2),
            invoiceHtml, invoiceNumber: invNumStr, amount: totalAmt, currency: 'GBP',
          }),
        });
        const d = await r.json();
        if (!r.ok || (d && d.error)) throw new Error(d.error || ('HTTP ' + r.status));
        status.className = 'ok';
        status.textContent = '✓ Sent. ' + invNumStr + ' — £' + totalAmt + ' to ' + emailVal;
        btn.innerHTML = '✓ Sent';
        setTimeout(close, 1500);
        return;
      }

      // Client mode — if the user edited the email, persist it.
      if (emailVal !== c.delivery_email) {
        try { await updateClient(c.clientId, { delivery_email: emailVal }); c.delivery_email = emailVal; } catch (e) {}
      }
      const r = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ clientId: c.clientId, emailType: 'invoice' }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status));
      status.className = 'ok';
      status.textContent = '✓ Sent. ' + (d.invoiceNumber ? d.invoiceNumber + ' — ' : '') + 'pipeline updated.';
      btn.innerHTML = '✓ Sent';
      await refreshData();
      setTimeout(() => { openClient(c.clientId); close(); }, 1100);
    } catch (err) {
      status.className = 'err';
      status.textContent = 'Send failed: ' + (err.message || 'unknown error');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // Autofocus the email field so user can hit Enter to send if it's already right
  setTimeout(() => {
    const inp = wrap.querySelector('#ssim-email');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }, 40);

  // Enter-to-send while focused on the email field
  wrap.querySelector('#ssim-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); wrap.querySelector('#ssim-send').click(); }
  });
}

// ─── UNIFIED INVOICE ENTRY POINTS ─────────────────────────────
// All three invoice buttons (Send Invoice on panel, £ Invoice from
// client at top, £ Blank invoice at top) now use the SAME in-place
// modal flow. No popups, no new tabs, no auth handoff dance, no
// chance of a popup blocker eating the click.
//
// Three entry points:
//   panelAction('invoice')    →  ssShowInvoiceModal(c)         (existing client)
//   quickInvoice()            →  ssShowInvoiceClientPicker()   (pick then modal)
//   openBlankInvoice()        →  ssShowInvoiceModal(null)      (blank mode)

// Open the full /invoice/ generator. clientCtx may be null (blank) or a client object.
function openInvoiceGenerator(clientCtx) {
  const qs = new URLSearchParams();
  if (clientCtx && clientCtx.clientId) {
    qs.set('clientId', clientCtx.clientId);
    if (clientCtx.business_name) qs.set('client_name', clientCtx.business_name);
    if (clientCtx.name) qs.set('client_contact', clientCtx.name);
    if (clientCtx.delivery_email) qs.set('client_email', clientCtx.delivery_email);
    if (clientCtx.address || clientCtx.business_address) qs.set('client_addr', clientCtx.address || clientCtx.business_address);
    if (clientCtx.package) qs.set('package', clientCtx.package);
    if (clientCtx.hosting_addon) qs.set('hosting', clientCtx.hosting_addon);
  }
  try { localStorage.setItem('ss_pw_handoff', JSON.stringify({ pw: ADMIN_PW, t: Date.now() })); } catch (e) {}
  const hash = ADMIN_PW ? ('#pw=' + encodeURIComponent(ADMIN_PW)) : '';
  const url = '/invoice/' + (qs.toString() ? '?' + qs.toString() : '') + hash;
  const w = window.open(url, '_blank');
  if (!w) window.location.href = url;
}

function openBlankInvoice() {
  openInvoiceGenerator(null);
}

function quickInvoice() {
  const unpaid = allClients.filter(c => !c.paid && !['archived', 'complete'].includes(c.stage));
  if (!unpaid.length) {
    openInvoiceGenerator(null);
    return;
  }
  ssShowInvoiceClientPicker(unpaid);
}

// In-place client picker — replaces the old window.prompt() that
// users found clunky. Shows up to 20 unpaid clients with their
// totals, click to launch the invoice modal pre-filled.
function ssShowInvoiceClientPicker(clients) {
  const existing = document.getElementById('ss-picker-modal');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'ss-picker-modal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"DM Sans",system-ui,sans-serif';

  const rows = clients.slice(0, 30).map(c => {
    const adv = c.package === 'advanced';
    const hosting = c.hosting_addon === 'yes';
    const total = (adv ? 299 : 149) + (hosting ? 29 : 0);
    return `
      <button class="ssp-row" data-id="${escapeAttr(c.clientId)}">
        <div class="ssp-row-l">
          <div class="ssp-biz">${escapeHTML(c.business_name || c.name || 'Untitled')}</div>
          <div class="ssp-meta">${escapeHTML(c.name || '')} · ${escapeHTML(c.delivery_email || 'no email')}</div>
        </div>
        <div class="ssp-row-r">
          <span class="ssp-pkg">${adv ? 'Advanced' : 'Starter'}${hosting ? ' + Host' : ''}</span>
          <span class="ssp-amt">£${total}</span>
        </div>
      </button>`;
  }).join('');

  wrap.innerHTML = `
    <style>
      #ssp-box{background:linear-gradient(180deg,#0f1320,#0a0d16);border:1px solid rgba(255,255,255,.1);border-radius:18px;max-width:560px;width:100%;color:#f0f2f8;box-shadow:0 30px 80px rgba(0,0,0,.6);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;animation:ssppop .35s cubic-bezier(.19,1,.22,1)}
      @keyframes ssppop{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      #ssp-head{padding:22px 26px 18px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between}
      #ssp-eyebrow{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#00c6ff;margin-bottom:4px}
      #ssp-title{font-size:18px;font-weight:600;color:#fff}
      #ssp-close{background:rgba(255,255,255,.06);width:32px;height:32px;border-radius:8px;color:#aaa;font-size:18px;cursor:pointer;border:0;display:grid;place-items:center}
      #ssp-close:hover{background:rgba(255,255,255,.12);color:#fff}
      #ssp-body{padding:14px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
      .ssp-row{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#0d1018;border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:13px 16px;text-align:left;cursor:pointer;color:inherit;font-family:inherit;transition:all .2s}
      .ssp-row:hover{border-color:rgba(0,198,255,.3);background:rgba(0,198,255,.05);transform:translateX(2px)}
      .ssp-row-l{flex:1;min-width:0}
      .ssp-biz{font-size:14px;font-weight:600;color:#fff;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ssp-meta{font-size:11.5px;color:#8890a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ssp-row-r{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
      .ssp-pkg{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7de8ff}
      .ssp-amt{font-size:15px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums}
      #ssp-foot{padding:14px 18px 18px;border-top:1px solid rgba(255,255,255,.06);text-align:center}
      .ssp-blank{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#f0f2f8;padding:9px 18px;border-radius:100px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s}
      .ssp-blank:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2)}
    </style>
    <div id="ssp-box" role="dialog" aria-modal="true">
      <div id="ssp-head">
        <div>
          <div id="ssp-eyebrow">£ Invoice</div>
          <div id="ssp-title">Pick a client to invoice</div>
        </div>
        <button id="ssp-close" aria-label="Close">✕</button>
      </div>
      <div id="ssp-body">${rows || '<div style="padding:40px;text-align:center;color:#8890a8">No unpaid clients.</div>'}</div>
      <div id="ssp-foot">
        <button class="ssp-blank" id="ssp-blank">+ Or create a blank invoice instead</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.querySelector('#ssp-close').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  wrap.querySelectorAll('.ssp-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = allClients.find(x => x.clientId === id);
      close();
      if (c) {
        currentClientId = id;
        openInvoiceGenerator(c);
      }
    });
  });
  wrap.querySelector('#ssp-blank').addEventListener('click', () => {
    close();
    openInvoiceGenerator(null);
  });
}

function escapeAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function quickBroadcast() {
  const subject = prompt('Broadcast subject:');
  if (!subject) return;
  const body = prompt('Message body (plain text). Will be sent to all paid clients with email.');
  if (!body) return;
  const recipients = allClients.filter(c => c.paid && c.delivery_email);
  if (!recipients.length) { alert('No paid clients to email.'); return; }
  if (!confirm('Send to ' + recipients.length + ' paid clients?')) return;
  let sent = 0, failed = 0;
  Promise.all(recipients.map(c =>
    fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ clientId: c.clientId, emailType: 'custom', customSubject: subject, customBody: body })
    }).then(r => r.json()).then(d => { if (d.ok) sent++; else failed++; }).catch(() => { failed++; })
  )).then(() => alert('Broadcast complete. Sent: ' + sent + ', failed: ' + failed));
}

function exportLeadsCSV() {
  if (!allClients.length) { alert('No clients to export.'); return; }
  const rows = [['Business','Name','Email','Phone','Type','Location','Source','Package','Stage','Amount','Paid','CreatedAt']];
  allClients.forEach(c => {
    rows.push([
      c.business_name || '', c.name || '', c.delivery_email || '', c.phone || '',
      c.business_type || '', c.location || '', c.source || '',
      c.package || '', c.stage || '',
      c.amount || (c.package === 'advanced' ? 299 : 149),
      c.paid ? 'yes' : 'no',
      c.createdAt || ''
    ]);
  });
  const csv = rows.map(r => r.map(v => {
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? '"' + s + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'staticswift-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
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
    // Pull live portal stats (unread messages, last activity, asset count) into
    // the panel so you can see at-a-glance whether the customer has actually
    // visited their portal — high signal for "should I follow up?"
    const unread = c.portalUnread || 0;
    const assetCount = Array.isArray(c.clientAssets) ? c.clientAssets.length : 0;
    const activityCount = Array.isArray(c.portalActivity) ? c.portalActivity.length : 0;
    const lastClientAt = c.portalLastClientAt ? new Date(c.portalLastClientAt).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : 'never';
    document.getElementById('panel-portal').innerHTML =
      '<div style="margin-bottom:10px;padding:10px 12px;background:rgba(0,200,224,.06);border:1px solid rgba(0,200,224,.18);border-radius:8px;font-size:12px;color:var(--text);display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        '<div><span style="color:var(--muted)">Last client visit:</span> <strong>' + escapeHTML(lastClientAt) + '</strong></div>' +
        '<div><span style="color:var(--muted)">Activity events:</span> <strong>' + activityCount + '</strong></div>' +
        '<div><span style="color:var(--muted)">Unread messages:</span> <strong style="' + (unread ? 'color:#fbbf24' : '') + '">' + unread + '</strong></div>' +
        '<div><span style="color:var(--muted)">Files uploaded:</span> <strong>' + assetCount + '</strong></div>' +
      '</div>' +
      '<a href="' + portalUrl + '" target="_blank" style="color:var(--cyan);font-weight:600;font-size:13px;word-break:break-all;display:block;margin-bottom:8px">↗ View this customer’s portal (live)</a>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="copy-btn" id="copy-portal-btn">Copy Link</button>' +
      '<button class="copy-btn" onclick="panelAction(\'portal-link\')" style="background:var(--cyan);color:#07090f;border-color:var(--cyan)">Send / Resend</button>' +
      '</div>';
    const cpb = document.getElementById('copy-portal-btn');
    if (cpb) cpb.addEventListener('click', function() {
      navigator.clipboard.writeText(portalUrl);
      this.textContent = 'Copied!';
      setTimeout(() => this.textContent = 'Copy Link', 2000);
    });

    // ── Messages thread + unread badge ───────────────────────────
    const msgs = Array.isArray(c.portalMessages) ? c.portalMessages : [];
    const msgsEl = document.getElementById('panel-messages');
    const msgsSec = document.getElementById('panel-messages-section');
    const unreadBadge = document.getElementById('panel-unread-badge');
    if (unreadBadge) {
      if (c.portalUnread && c.portalUnread > 0) {
        unreadBadge.style.display = 'inline-block';
        unreadBadge.textContent = c.portalUnread + ' unread';
      } else {
        unreadBadge.style.display = 'none';
      }
    }
    if (msgs.length > 0 || c.changeRequest) {
      msgsSec.style.display = 'block';
      let html = '';
      if (c.changeRequest) {
        html += '<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:13px"><div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:4px;text-transform:uppercase">⚠ Change Request ' + (c.changeRequestAt ? '· ' + new Date(c.changeRequestAt).toLocaleDateString('en-GB') : '') + '</div>' + escapeHTML(c.changeRequest || '') + '</div>';
      }
      html += msgs.map(m => '<div style="background:' + (m.from === 'client' ? 'rgba(0,200,224,.08);border:1px solid rgba(0,200,224,.15)' : 'rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)') + ';border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px"><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;text-transform:uppercase">' + (m.from === 'client' ? escapeHTML(c.name || 'Client') : 'You') + ' · ' + new Date(m.sentAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) + (m.signature ? ' · <span style="color:var(--green)">signed: ' + escapeHTML(m.signature) + '</span>' : '') + (m.type === 'approve' ? ' · <span style="color:var(--green)">✓ APPROVED</span>' : '') + '</div>' + escapeHTML(m.notes || m.text || '').replace(/\n/g, '<br>') + '</div>').join('');
      msgsEl.innerHTML = html;
      msgsEl.scrollTop = msgsEl.scrollHeight;
    } else {
      msgsSec.style.display = 'none';
    }

    // ── Portal activity audit trail ──────────────────────────────
    const activity = Array.isArray(c.portalActivity) ? c.portalActivity.slice().reverse() : [];
    const actSec = document.getElementById('panel-activity-section');
    const actEl = document.getElementById('panel-activity');
    const actCount = document.getElementById('panel-activity-count');
    if (activity.length > 0 && actSec) {
      actSec.style.display = 'block';
      if (actCount) actCount.textContent = '(' + activity.length + ')';
      const iconFor = (t) => ({
        approve: '✓', changes: '✎', message: '💬',
        reaction: '✨', addon: '£', asset: '📎',
      })[t] || '·';
      actEl.innerHTML = activity.slice(0, 50).map(a =>
        '<div style="display:grid;grid-template-columns:20px 1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<span style="color:var(--cyan);text-align:center">' + iconFor(a.type) + '</span>' +
        '<span style="color:var(--text)">' + escapeHTML(a.summary || a.type) + (a.signature ? ' <em style="color:var(--green)">— "' + escapeHTML(a.signature) + '"</em>' : '') + '</span>' +
        '<span style="color:var(--muted);font-size:11px;white-space:nowrap">' + new Date(a.at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) + '</span>' +
        '</div>'
      ).join('');
    } else if (actSec) {
      actSec.style.display = 'none';
    }

    // ── Preview reactions ────────────────────────────────────────
    const reactions = c.previewReactions || {};
    const rxSec = document.getElementById('panel-reactions-section');
    const rxEl = document.getElementById('panel-reactions');
    const rxTotal = Object.values(reactions).reduce((s, n) => s + (parseInt(n) || 0), 0);
    if (rxTotal > 0 && rxSec) {
      rxSec.style.display = 'block';
      const labels = { love: '🔥 Love it', hmm: '🤔 Hmm', nice: '✨ Nice touches', issues: '❌ Issues' };
      rxEl.innerHTML = Object.entries(reactions)
        .filter(([_, n]) => n > 0)
        .map(([k, n]) =>
          '<span style="background:' + (k === 'issues' ? 'rgba(248,113,113,.1);color:var(--red)' : 'rgba(0,200,224,.1);color:var(--cyan)') + ';border:1px solid currentColor;border-radius:100px;padding:5px 12px;font-weight:600">' +
            escapeHTML(labels[k] || k) + ' · ' + n +
          '</span>'
        ).join('');
    } else if (rxSec) {
      rxSec.style.display = 'none';
    }

    // ── Annotated preview pins ────────────────────────────────────
    // Each is a real coordinate pin the client dropped on the preview.
    // Show them numbered with location, mode, and a "resolve" link so
    // the admin can mark them done after addressing.
    const annots = Array.isArray(c.previewAnnotations) ? c.previewAnnotations : [];
    const anSec = document.getElementById('panel-annotations-section');
    const anEl = document.getElementById('panel-annotations');
    const anCount = document.getElementById('panel-annotations-count');
    if (annots.length > 0 && anSec) {
      anSec.style.display = 'block';
      const unresolved = annots.filter(a => !a.resolved).length;
      if (anCount) anCount.textContent = '(' + annots.length + (unresolved ? ' · ' + unresolved + ' open' : '') + ')';
      anEl.innerHTML = annots.map((a, i) => {
        const when = new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return (
          '<div style="display:flex;gap:10px;padding:10px 12px;background:' +
            (a.resolved ? 'rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.18)' : 'var(--dark3);border:1px solid var(--border)') +
            ';border-radius:8px">' +
            '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:' +
              (a.resolved ? 'var(--green)' : '#ff5f57') +
              ';color:#fff;font-weight:800;font-size:11px;display:grid;place-items:center">' + (i + 1) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="color:var(--text);line-height:1.5;margin-bottom:4px">' + escapeHTML(a.comment || '') + '</div>' +
              '<div style="color:var(--muted);font-size:11px">' +
                escapeHTML(a.mode || 'desktop') + ' · ' + Number(a.x || 0).toFixed(0) + '%, ' + Number(a.y || 0).toFixed(0) + '% · ' + when +
              '</div>' +
            '</div>' +
            (a.resolved
              ? '<span style="color:var(--green);font-size:11px;font-weight:600;align-self:center">✓ Resolved</span>'
              : '<button onclick="resolveAnnotation(\'' + c.clientId + '\',' + i + ')" style="background:rgba(34,197,94,.1);color:var(--green);border:1px solid rgba(34,197,94,.3);padding:5px 11px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;align-self:center">Mark resolved</button>'
            ) +
          '</div>'
        );
      }).join('');
    } else if (anSec) {
      anSec.style.display = 'none';
    }

    // ── Client assets (brand kit uploads) ────────────────────────
    const assets = Array.isArray(c.clientAssets) ? c.clientAssets : [];
    const aSec = document.getElementById('panel-assets-section');
    const aEl = document.getElementById('panel-assets');
    const aCount = document.getElementById('panel-assets-count');
    if (assets.length > 0 && aSec) {
      aSec.style.display = 'block';
      if (aCount) aCount.textContent = '(' + assets.length + ')';
      aEl.innerHTML = assets.slice().reverse().map(a => {
        const sizeStr = a.bytes ? (a.bytes > 1024 * 1024 ? (a.bytes / 1024 / 1024).toFixed(1) + ' MB' : (a.bytes / 1024).toFixed(1) + ' KB') : '';
        const link = a.fileId ? '/.netlify/functions/serve-preview?id=' + encodeURIComponent(a.fileId) : '#';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--dark3);border:1px solid var(--border);border-radius:8px">' +
          '<span style="color:var(--cyan)">📎</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHTML(a.name) + '">' + escapeHTML(a.name) + '</span>' +
          '<span style="color:var(--muted);font-size:11px">' + sizeStr + '</span>' +
          (a.fileId ? '<a href="' + link + '" target="_blank" style="color:var(--cyan);font-size:11px;font-weight:600;text-decoration:none">↓</a>' : '') +
          '</div>';
      }).join('');
    } else if (aSec) {
      aSec.style.display = 'none';
    }

    // ── Add-on interest (sales surface) ──────────────────────────
    const addons = Array.isArray(c.addonInterest) ? c.addonInterest : [];
    const adSec = document.getElementById('panel-addons-section');
    const adEl = document.getElementById('panel-addons');
    if (addons.length > 0 && adSec) {
      adSec.style.display = 'block';
      adEl.innerHTML = addons.slice().reverse().slice(0, 10).map(a =>
        '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;background:rgba(176,138,62,.06);border:1px solid rgba(176,138,62,.2);border-radius:8px;font-size:12px">' +
          '<span style="color:var(--gold)">💰 ' + escapeHTML(a.key || '?') + '</span>' +
          '<span style="color:var(--muted);font-size:11px">' + new Date(a.at).toLocaleDateString('en-GB') + '</span>' +
        '</div>'
      ).join('');
    } else if (adSec) {
      adSec.style.display = 'none';
    }

  } else {
    document.getElementById('panel-portal-section').style.display = 'block';
    document.getElementById('panel-portal').innerHTML =
      '<p style="font-size:13px;color:var(--muted);margin-bottom:10px">No portal generated yet.</p>' +
      '<button class="copy-btn" style="background:var(--cyan);color:#07090f;border-color:var(--cyan)" onclick="panelAction(\'portal-link\')">Generate &amp; Send Portal Link</button>';
    document.getElementById('panel-messages-section').style.display = 'none';
    // Hide the new sections too — they only make sense once a portal exists.
    ['panel-activity-section', 'panel-reactions-section', 'panel-annotations-section', 'panel-assets-section', 'panel-addons-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // When the admin opens a client panel, clear their portalUnread counter —
  // they've now "seen" it. Best-effort; never blocks the UI.
  if (c.portalUnread && c.portalUnread > 0) {
    try { updateClient(c.clientId, { portalUnread: 0 }); c.portalUnread = 0; } catch (e) {}
  }
  document.getElementById('client-panel').classList.add('open');
}

function closePanel() { document.getElementById('client-panel').classList.remove('open'); currentClientId = null; }
function closePanelBg(e) { if (e.target.id === 'client-panel') closePanel(); }

// Mark a preview annotation as resolved — visible immediately in the panel
// AND on the customer's portal next time they refresh (gives them a clear
// signal "Harry has actioned this comment").
async function resolveAnnotation(clientId, idx) {
  const c = allClients.find(x => x.clientId === clientId);
  if (!c || !Array.isArray(c.previewAnnotations) || !c.previewAnnotations[idx]) return;
  c.previewAnnotations[idx] = { ...c.previewAnnotations[idx], resolved: true, resolvedAt: new Date().toISOString() };
  try {
    await updateClient(clientId, { previewAnnotations: c.previewAnnotations });
    openClient(clientId); // re-render
  } catch (err) {
    alert('Could not resolve: ' + err.message);
  }
}

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
  if (!currentClientId) {
    console.warn('[panelAction] no currentClientId — open a client first');
    alert('Open a client first, then try this action.');
    return;
  }
  const c = allClients.find(x => x.clientId === currentClientId);
  if (!c) {
    console.warn('[panelAction] currentClientId not in allClients:', currentClientId);
    alert('Could not find that client. Refresh the page and try again.');
    return;
  }
  // Null-guard the status message element — if the panel HTML hasn't
  // rendered yet (rare but possible during re-init), we don't want
  // `msg.style.display = ...` to TypeError and abort the whole action.
  const msg = document.getElementById('panel-action-msg');
  if (msg) msg.style.display = 'none';

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
    // ── INVOICE FLOW — rebuilt to be foolproof ──────────────────
    // Old flow: open /invoice/ in a new tab, hope sessionStorage transfers,
    // hope the user clicks Send. Too many failure points.
    //
    // New flow: a single in-place confirm modal that shows the auto-calculated
    // invoice (package + hosting + total + email it lands at) and sends it via
    // the existing send-email function in ONE CLICK. If the user wants to
    // customise (different items, a refund, etc.), there's a second button
    // that opens the full /invoice/ generator pre-filled.
    //
    // Wrap in try/catch so a bad theme override or stylesheet conflict
    // can't kill the click silently. Any thrown error becomes a visible
    // alert + console trace.
    try {
      openInvoiceGenerator(c);
    } catch (err) {
      console.error('[invoice] open generator threw:', err);
      alert('Invoice generator could not open: ' + (err && err.message ? err.message : 'unknown error'));
    }
    return;
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
  if (type === 'delete') {
    // ─── DELETE — rebuilt to be honest and reliable ─────────────
    // The old path silently fell back to a "soft delete" (stage=deleted)
    // when the server returned 401, which felt like delete worked — until
    // the next refresh, when the record reappeared because the UI never
    // filtered out soft-deleted entries.
    //
    // New flow:
    //   1. Confirm + type DELETE.
    //   2. Hard-delete server-side.
    //   3. On 401 → tell the user the password is wrong, prompt for it,
    //      retry the hard-delete with the new password. Then save it for
    //      future requests.
    //   4. On any other error → surface the exact error message; never
    //      pretend success. The UI doesn't clear until the server confirms.
    const label = c.business_name || c.name || 'this client';
    if (!confirm('PERMANENTLY DELETE ' + label + '?\n\nClient, brief, prompt, notes, files and portal access — all gone. Cannot be undone.')) return;
    const typed = prompt('To confirm, type DELETE exactly:');
    if (typed !== 'DELETE') {
      msg.style.display = 'block'; msg.style.color = 'var(--amber)';
      msg.textContent = 'Delete cancelled — confirmation did not match.';
      return;
    }
    msg.style.display = 'block'; msg.style.color = 'var(--muted)';
    msg.textContent = 'Deleting…';

    const idToDelete = currentClientId;

    async function tryDelete(password) {
      try {
        const r = await fetch('/.netlify/functions/delete-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify({ clientId: idToDelete }),
        });
        const body = await r.text();
        return { status: r.status, ok: r.ok, body };
      } catch (err) {
        return { status: 0, ok: false, body: err.message, networkError: true };
      }
    }

    let result = await tryDelete(ADMIN_PW);

    // 401 → almost certainly a stale / wrong sessionStorage password.
    // Prompt for the real one, retry, save it on success.
    if (result.status === 401) {
      const pw = prompt('Admin password mismatch — the server rejected your stored password.\n\nEnter the correct admin password to finish deleting:');
      if (!pw) {
        msg.style.color = 'var(--amber)';
        msg.textContent = 'Delete cancelled — no password provided. The client is NOT deleted.';
        return;
      }
      result = await tryDelete(pw);
      if (result.ok) {
        // Save for future use so this doesn't happen again
        ADMIN_PW = pw;
        try { sessionStorage.setItem('ss_pw', pw); } catch (_) {}
      }
    }

    if (!result.ok) {
      msg.style.color = 'var(--red)';
      msg.textContent = 'Delete FAILED — ' + (result.networkError
        ? ('network error: ' + result.body)
        : ('HTTP ' + result.status + ' · ' + (result.body || '').slice(0, 200)))
        + '. The client is still in the database. Retry, or check the function logs.';
      return;
    }

    // Real success: server confirmed the record is gone.
    allClients = allClients.filter(x => x.clientId !== idToDelete);
    saveClientsLocally(allClients);
    closePanel();
    await refreshData();
    msg.style.color = 'var(--green)';
    msg.textContent = '✓ Permanently deleted.';
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
// REVENUE + BILLING (consolidated)
// ==========================================
// Pricing constants — single source of truth for fallback amounts.
const REV_BASE_STARTER = 499;
const REV_BASE_PRO     = 999;
const REV_MONTHLY      = 49;
const REV_BUNDLE_DISC  = 100;
function isProPackage(pkg){ return pkg === 'advanced' || pkg === 'pro'; }
function isManagedSubscriber(c){ return c && (c.subscription === 'managed' || c.stage === 'live'); }
function thisCycleKey(){ const d = new Date(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0'); }

function renderRevenue() {
  // ── Section: collapsed-state persistence ─────────────────────────
  // <details> remembers itself across SPA tab switches via sessionStorage.
  document.querySelectorAll('#page-revenue .rev-section').forEach(d => {
    if (d._wired) return;
    const k = 'ss_rev_open_' + d.id;
    const stored = sessionStorage.getItem(k);
    if (stored === '0') d.removeAttribute('open');
    else if (stored === '1') d.setAttribute('open','');
    d.addEventListener('toggle', () => sessionStorage.setItem(k, d.open ? '1' : '0'));
    d._wired = true;
  });

  // ── One-time build revenue (legacy view with updated price defaults) ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const paid = allClients.filter(c => c.paid && c.paidAt);
  const sum = (from, to) => paid
    .filter(c => { const t = new Date(c.paidAt).getTime(); return t >= from && (!to || t < to); })
    .reduce((s,c) => s + (c.amount || (isProPackage(c.package) ? REV_BASE_PRO : REV_BASE_STARTER)), 0);

  document.getElementById('rev-today').textContent    = '£' + sum(todayStart).toLocaleString('en-GB');
  document.getElementById('rev-week').textContent     = '£' + sum(weekStart).toLocaleString('en-GB');
  document.getElementById('rev-month').textContent    = '£' + sum(monthStart).toLocaleString('en-GB');
  document.getElementById('rev-alltime').textContent  = '£' + sum(0).toLocaleString('en-GB');
  document.getElementById('rev-starter').textContent  = allClients.filter(c => !isProPackage(c.package)).length;
  document.getElementById('rev-advanced').textContent = allClients.filter(c =>  isProPackage(c.package)).length;
  document.getElementById('rev-onetime-meta').textContent = paid.length + ' paid · ' + allClients.length + ' total';

  // ── All build orders table (collapsed by default) ─────────────────
  const tbody = document.getElementById('revenue-tbody');
  if (!allClients.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No clients yet.</td></tr>';
  } else {
    tbody.innerHTML = allClients.map(c => {
      const fallback = isProPackage(c.package) ? REV_BASE_PRO : REV_BASE_STARTER;
      const amount = c.amount || fallback;
      const statusColor = c.paid ? 'var(--green)' : c.stage === 'invoice-sent' ? 'var(--signal)' : 'var(--ink-mid)';
      const statusLabel = c.paid ? 'Paid' : c.stage === 'invoice-sent' ? 'Invoice Sent' : STAGE_LABELS[c.stage] || c.stage;
      return `<tr class="sub-tbl-row">
        <td><strong>${escapeHTML(c.business_name || '—')}</strong><br><span style="font-size:12px;color:var(--ink-mid)">${escapeHTML(c.delivery_email || '')}</span></td>
        <td style="color:var(--ink-mid)">${isProPackage(c.package) ? 'Pro' : 'Starter'}</td>
        <td style="font-family:var(--mono);font-weight:600">£${amount.toLocaleString('en-GB')}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--ink-mid)">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}</td>
        <td><span style="font-size:12px;font-weight:600;color:${statusColor}">${statusLabel}</span></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('rev-revtable-meta').textContent = allClients.length + ' rows';

  // ── Monthly Subscriptions section ────────────────────────────────
  renderRevenueSubscriptions();
}

/* Mirrors /admin/billing.html logic but inline into the SPA so Harry doesn't
   need to flip between pages. Per-row Send-invoice / Mark-paid call the same
   /cron-monthly-invoices + /update-client endpoints. */
function renderRevenueSubscriptions() {
  const cycle = thisCycleKey();
  const live = allClients.filter(isManagedSubscriber);
  const decorated = live.map(c => {
    const log = Array.isArray(c.monthlyInvoices) ? c.monthlyInvoices : [];
    const sorted = log.slice().sort((a,b) => new Date(b.issuedAt) - new Date(a.issuedAt));
    const latest = sorted[0] || null;
    const thisCycleInv = log.find(e => e.cycleKey === cycle) || null;
    const status = !thisCycleInv ? 'none' : (thisCycleInv.paidAt ? 'paid' : 'pending');
    const overdue = log.find(e => !e.paidAt && e.dueAt && new Date(e.dueAt).getTime() < Date.now()) || null;
    const totalBilled = log.reduce((s,e) => s + Number(e.amount||0), 0);
    return { c, latest, thisCycleInv, status, overdue, totalBilled };
  });

  // KPIs
  document.getElementById('sub-kpi-live').textContent = live.length;
  document.getElementById('sub-kpi-mrr').textContent  = '£' + (live.length * REV_MONTHLY).toLocaleString('en-GB');
  const dueThis = decorated.filter(d => d.status !== 'paid');
  document.getElementById('sub-kpi-due').textContent  = dueThis.length;
  document.getElementById('sub-kpi-due-sub').textContent = dueThis.length ? '£' + (dueThis.length * REV_MONTHLY) + ' to invoice' : 'All sent for ' + cycle;
  const overdues = decorated.filter(d => d.overdue);
  document.getElementById('sub-kpi-overdue').textContent = overdues.length;
  document.getElementById('rev-subs-meta').textContent = live.length + ' live · ' + cycle;
  document.getElementById('rev-cycle-pill').textContent = 'Cycle ' + cycle;

  // Outstanding-now table
  const outBody = document.getElementById('sub-out-tbody');
  const outstanding = decorated.filter(d => d.status !== 'paid');
  outstanding.sort((a,b) => (b.overdue?1:0) - (a.overdue?1:0));
  document.getElementById('rev-out-meta').textContent = outstanding.length + ' clients · ' + cycle;
  if (!outstanding.length){
    outBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">All invoiced and paid for ' + cycle + '. Nothing to do.</td></tr>';
  } else {
    outBody.innerHTML = outstanding.map(d => {
      const c = d.c;
      const biz = escapeHTML(c.business_name || c.name || c.clientId || '—');
      const loc = c.location ? '<br><span style="font-size:11px;color:var(--ink-mid)">' + escapeHTML(c.location) + '</span>' : '';
      let tag, amount, action;
      if (d.status === 'none'){
        tag = '<span class="sub-tag sub-tag-none">Not invoiced</span>'; amount = '£' + REV_MONTHLY.toFixed(2);
        action = '<button class="sub-row-act" type="button" onclick="subSendInvoice(\'' + escapeHTML(c.clientId) + '\', this)">Send invoice</button>';
      } else if (d.overdue){
        tag = '<span class="sub-tag sub-tag-due">' + escapeHTML(d.overdue.invoiceNumber || '—') + ' · overdue</span>';
        amount = '£' + Number(d.overdue.amount || REV_MONTHLY).toFixed(2);
        action = '<button class="sub-row-act" type="button" onclick="subMarkPaid(\'' + escapeHTML(c.clientId) + '\', this)">Mark paid</button>';
      } else {
        tag = '<span class="sub-tag sub-tag-pending">' + escapeHTML(d.thisCycleInv.invoiceNumber || '—') + ' · pending</span>';
        amount = '£' + Number(d.thisCycleInv.amount || REV_MONTHLY).toFixed(2);
        action = '<button class="sub-row-act" type="button" onclick="subMarkPaid(\'' + escapeHTML(c.clientId) + '\', this)">Mark paid</button>';
      }
      return '<tr class="sub-tbl-row"><td><strong>' + biz + '</strong>' + loc + '</td><td>' + tag + '</td><td style="font-family:var(--mono);font-size:12px;color:var(--ink-mid)">' + (d.thisCycleInv ? new Date(d.thisCycleInv.issuedAt).toLocaleDateString('en-GB') : '—') + '</td><td style="text-align:right;font-family:var(--mono)">' + amount + '</td><td style="text-align:right">' + action + '</td></tr>';
    }).join('');
  }

  // All-subscribers table
  const allBody = document.getElementById('sub-all-tbody');
  document.getElementById('rev-allsubs-meta').textContent = live.length + ' live · £' + (live.length * REV_MONTHLY) + ' MRR';
  if (!live.length){
    allBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No live subscribers yet. First Managed Plan signup will show here.</td></tr>';
  } else {
    const ordered = decorated.slice().sort((a,b) => new Date(b.c.liveAt || b.c.createdAt) - new Date(a.c.liveAt || a.c.createdAt));
    allBody.innerHTML = ordered.map(d => {
      const c = d.c;
      const biz = escapeHTML(c.business_name || c.name || c.clientId || '—');
      const since = c.liveAt || c.createdAt ? new Date(c.liveAt || c.createdAt).toLocaleDateString('en-GB') : '—';
      const lastPaid = (() => {
        const log = Array.isArray(c.monthlyInvoices) ? c.monthlyInvoices : [];
        const paid = log.filter(e => e.paidAt).sort((a,b) => new Date(b.paidAt) - new Date(a.paidAt))[0];
        return paid ? new Date(paid.paidAt).toLocaleDateString('en-GB') : '—';
      })();
      let lastTag;
      if (!d.latest) lastTag = '<span class="sub-tag sub-tag-none">None yet</span>';
      else if (d.latest.paidAt) lastTag = '<span class="sub-tag sub-tag-paid">' + escapeHTML(d.latest.invoiceNumber || '—') + ' · paid</span>';
      else lastTag = '<span class="sub-tag sub-tag-pending">' + escapeHTML(d.latest.invoiceNumber || '—') + ' · sent</span>';
      return '<tr class="sub-tbl-row">'
        + '<td><strong>' + biz + '</strong>' + (c.location ? '<br><span style="font-size:11px;color:var(--ink-mid)">' + escapeHTML(c.location) + '</span>' : '') + '</td>'
        + '<td style="font-family:var(--mono);font-size:12px;color:var(--ink-mid)">' + since + '</td>'
        + '<td>' + lastTag + '</td>'
        + '<td style="font-family:var(--mono);font-size:12px;color:var(--ink-mid)">' + lastPaid + '</td>'
        + '<td style="text-align:right;font-family:var(--mono)">£' + d.totalBilled.toFixed(2) + '</td>'
        + '<td style="text-align:right"><button class="sub-row-act alt" type="button" onclick="subSendInvoice(\'' + escapeHTML(c.clientId) + '\', this)">Send invoice</button></td>'
        + '</tr>';
    }).join('');
  }
}

/* ── Action handlers — match billing.html behaviour exactly so the two
      surfaces stay in sync. Both end-points re-use the admin password
      already established for this SPA session. */
async function subApi(path, opts){
  opts = opts || {};
  // Reuse the SPA's global admin password (the same one fetchClients() uses).
  const headers = Object.assign({ 'x-admin-password': (typeof ADMIN_PW === 'string' ? ADMIN_PW : '') }, opts.headers || {});
  if (opts.body && typeof opts.body !== 'string'){
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(path, Object.assign({}, opts, { headers }));
}
async function subSendInvoice(clientId, btn){
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    const r = await subApi('/.netlify/functions/cron-monthly-invoices', { method:'POST', body:{ clientId } });
    const j = await r.json();
    if (j.ok){ showToast('Invoice sent.'); await fetchClients(); renderRevenue(); return; }
    throw new Error(j.error || 'send failed');
  } catch (err){
    btn.disabled = false; btn.textContent = orig;
    showToast(err.message || 'Send failed', true);
  }
}
async function subMarkPaid(clientId, btn){
  const c = allClients.find(x => x.clientId === clientId);
  if (!c) return;
  const log = Array.isArray(c.monthlyInvoices) ? c.monthlyInvoices.slice() : [];
  const idx = log.findIndex(x => !x.paidAt);
  if (idx === -1){ showToast('No unpaid invoice on file.', true); return; }
  log[idx] = Object.assign({}, log[idx], { paidAt: new Date().toISOString() });
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    const r = await subApi('/.netlify/functions/update-client', { method:'POST', body:{ clientId, updates:{ monthlyInvoices: log } } });
    if (r.ok){ showToast('Marked paid.'); await fetchClients(); renderRevenue(); return; }
    throw new Error('Update failed');
  } catch (err){
    btn.disabled = false; btn.textContent = orig;
    showToast(err.message || 'Mark-paid failed', true);
  }
}
async function subSendAllDue(){
  if (!confirm('Send a monthly invoice to every live subscriber who hasn\'t had one this cycle?')) return;
  try {
    const r = await subApi('/.netlify/functions/cron-monthly-invoices', { method:'POST', body:{} });
    const j = await r.json();
    if (j.ok){
      const ok = (j.results||[]).filter(x => x.ok).length;
      showToast(ok + ' invoice' + (ok===1?'':'s') + ' sent.');
      await fetchClients(); renderRevenue();
    } else { throw new Error(j.error || 'send failed'); }
  } catch (err){ showToast(err.message || 'Send-all failed', true); }
}

/* Lightweight toast — reuses existing admin styles where possible */
function showToast(msg, isErr){
  let t = document.getElementById('ss-admin-toast');
  if (!t){
    t = document.createElement('div'); t.id = 'ss-admin-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(120%);background:var(--ink);color:var(--paper);padding:14px 22px;border-radius:100px;font:500 14px/1.4 var(--sans, system-ui);box-shadow:0 16px 40px -16px rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.22,1,.36,1),background .2s;z-index:9999';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = isErr ? 'var(--signal)' : 'var(--ink)';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(120%)'; }, 3200);
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
    renderReplyQueue();
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
      body: JSON.stringify({ to, subject: subject || '(no subject)', body, fromMailbox, mode: 'reply' })
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
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.html') && !lower.endsWith('.htm') && !lower.endsWith('.zip')) {
    alert('Please select a .html or .zip file.');
    input.value = '';
    return;
  }
  if (!currentClientId) { alert('No client selected.'); input.value = ''; return; }

  // Netlify Lambda body limit ≈ 6 MB; base64 inflates by ~33% — keep raw under 4 MB
  const MAX_RAW = 4 * 1024 * 1024;
  if (file.size > MAX_RAW) {
    alert('File is ' + (file.size / 1024 / 1024).toFixed(1) + ' MB — too big for direct upload (4 MB max).\n\nReduce inline base64 images or split the build, then try again.');
    input.value = '';
    return;
  }

  const statusEl = document.getElementById(fileType + '-upload-status');
  const dropEl = document.getElementById(fileType + '-drop');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = 'Reading ' + (file.size / 1024).toFixed(0) + ' KB…';
  dropEl.style.borderColor = 'var(--cyan)';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

    statusEl.textContent = 'Uploading to blob store…';

    const r = await fetch('/.netlify/functions/upload-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ clientId: currentClientId, fileType, htmlBase64: base64, filename: file.name })
    });
    let data;
    try { data = await r.json(); }
    catch { throw new Error('Server returned ' + r.status + ' (non-JSON). Check function logs.'); }
    if (!r.ok || !data.ok) throw new Error(data?.error || ('Upload failed: HTTP ' + r.status));

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
      body:JSON.stringify({ to, subject: subject || '(no subject)', body, fromMailbox, mode: 'reply' })
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

    // Top sections (NEW)
    const secEl = document.getElementById('sa-sections');
    if (secEl && d.topSections) {
      secEl.innerHTML = d.topSections.length
        ? d.topSections.map(s => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(s.name)}</span><span class="sa-row-r">${s.count.toLocaleString()}</span></div>`).join('')
        : '<div class="empty">No section data yet — tracker only logs new visits</div>';
    }
    // Top CTAs (NEW)
    const ctaEl = document.getElementById('sa-ctas-list');
    if (ctaEl && d.topCtas) {
      ctaEl.innerHTML = d.topCtas.length
        ? d.topCtas.map(c => `<div class="sa-row"><span class="sa-row-l">${escapeHTML(c.label)}</span><span class="sa-row-r">${c.count.toLocaleString()}</span></div>`).join('')
        : '<div class="empty">No CTA clicks yet</div>';
    }
    // Conversion funnel (NEW)
    const funnelEl = document.getElementById('sa-funnel');
    if (funnelEl && d.funnel) {
      const top = d.funnel[0]?.count || 1;
      funnelEl.innerHTML = d.funnel.map((f, i) => {
        const pct = top > 0 ? Math.round((f.count / top) * 100) : 0;
        const prevCount = i > 0 ? d.funnel[i - 1].count : null;
        const stepPct = prevCount && prevCount > 0 ? Math.round((f.count / prevCount) * 100) + '%' : '';
        return `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;font-size:12px">
              <span style="color:var(--text);font-weight:600">${escapeHTML(f.label)}</span>
              <span style="color:var(--cyan);font-family:'DM Mono',monospace">${f.count} ${stepPct ? '· ' + stepPct : ''}</span>
            </div>
            <div style="height:8px;background:var(--dark3);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--cyan),#00a8c0);transition:width .5s"></div>
            </div>
          </div>`;
      }).join('');
    }
    // Recent visitor journeys (NEW)
    const jEl = document.getElementById('sa-journeys');
    if (jEl && d.recentJourneys) {
      jEl.innerHTML = d.recentJourneys.length
        ? d.recentJourneys.map(j => {
          const time = new Date(j.lastSeen).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const steps = (j.steps || []).map(s => {
            const label = (s.evt || '').replace(/^view:|^click:|^conversion:|^field:|^scroll:|^submit:/, '');
            const icon = (s.evt || '').startsWith('view:') ? '👁'
              : (s.evt || '').startsWith('click:') ? '🖱'
              : (s.evt || '').startsWith('conversion:') ? '🎯'
              : (s.evt || '').startsWith('field:') ? '✎'
              : (s.evt || '').startsWith('scroll:') ? '⇣'
              : (s.evt || '').startsWith('submit:') ? '✓'
              : '·';
            return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:var(--surface2);border-radius:5px;font-size:10px;color:var(--muted);font-family:'DM Mono',monospace">${icon} ${escapeHTML(label.slice(0, 20))}</span>`;
          }).join(' ');
          return `
            <div style="padding:11px 14px;border-bottom:1px solid var(--border);font-size:11px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-family:'DM Mono',monospace;color:${j.converted ? 'var(--green)' : 'var(--text)'};font-weight:700">${j.converted ? '🎯 ' : ''}${escapeHTML(j.sid)}</span>
                <span style="color:var(--dim);font-family:'DM Mono',monospace">${escapeHTML(j.country)} · ${escapeHTML(j.ref)} · ${time}</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">${steps || '<span style="color:var(--dim)">no steps</span>'}</div>
            </div>`;
        }).join('')
        : '<div class="empty">No visitor journeys yet — deploy the tracker + wait for traffic</div>';
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
  if (id === 'seo') { renderSEOChecklist(); renderSearchTeam(); }
  if (id === 'backlinks') renderDirectories();
  if (id === 'workforce') { loadWorkforce(); startWorkforcePoll(); } else { stopWorkforcePoll(); }
}

/* ================================================================
   THE WORKFORCE — org chart, live activity, approval queue, all
   inline. One endpoint (workforce-status) feeds everything; the
   queue actions reuse queue-action. Auto-refreshes every 15s while
   the tab is open.
   ================================================================ */
let _wfPoll = null, _wfTick = null, _wfOrgData = null, _wfFeedData = null, _wfLive = null, _wfTeam = null;
// Two clocks: a 5s NETWORK refresh (pulls fresh state) and a 1s LOCAL tick
// that just re-renders the "ago" timers and live/working dots from the last
// data, with no request, so the board ticks second by second without hammering
// the backend.
function startWorkforcePoll() {
  stopWorkforcePoll();
  _wfPoll = setInterval(loadWorkforce, 5000);
  _wfTick = setInterval(function () { if (_wfOrgData) renderWfOrg(_wfOrgData); if (_wfFeedData) renderWfFeed(_wfFeedData); if (_wfLive) { renderWfBrief(_wfLive); renderWfTeams(_wfLive); } }, 1000);
}
function stopWorkforcePoll() { if (_wfPoll) { clearInterval(_wfPoll); _wfPoll = null; } if (_wfTick) { clearInterval(_wfTick); _wfTick = null; } }
function wfHdr() { return { 'x-admin-password': (typeof ADMIN_PW !== 'undefined' && ADMIN_PW) || sessionStorage.getItem('ss_pw') || '', 'Content-Type': 'application/json' }; }
function wfEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function wfAgo(iso) { if (!iso) return 'never'; var s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return Math.round(s) + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; }

let _wfOrgFallback = null;
async function wfOrgFallback() {
  if (_wfOrgFallback) return _wfOrgFallback;
  try {
    const r = await fetch('/data/org.json');
    const d = await r.json();
    _wfOrgFallback = d.departments.map(function (x) { return { dept: x.dept, roles: x.roles.map(function (r) { return { name: r, last: null }; }) }; });
  } catch (_) { _wfOrgFallback = []; }
  return _wfOrgFallback;
}

function wfBanner(msg, kind) {
  let el = document.getElementById('wf-banner');
  if (!el) {
    el = document.createElement('div'); el.id = 'wf-banner';
    el.style.cssText = 'margin:0 0 16px;padding:12px 16px;border-radius:10px;font-size:13px;line-height:1.5';
    const wrap = document.querySelector('.wf-wrap'); if (wrap) wrap.insertBefore(el, wrap.children[1] || null);
  }
  if (!msg) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.background = kind === 'ok' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.12)';
  el.style.border = '1px solid ' + (kind === 'ok' ? 'var(--green)' : 'var(--amber)');
  el.style.color = 'var(--text)';
  el.innerHTML = msg;
}

async function loadWorkforce() {
  // Always render the full org first, so the tab is never blank.
  const fallback = await wfOrgFallback();
  let live = null;
  try {
    const r = await fetch('/.netlify/functions/workforce-status', { headers: wfHdr() });
    if (r.ok) live = await r.json();
    else if (r.status === 401) wfBanner('Signed-in session is missing the admin password. Sign out and back in.', 'warn');
  } catch (_) { /* network/not-deployed */ }

  if (!live) {
    // Backend not reachable yet (most often: functions not deployed, or
    // AGENT_TOKEN/Blobs not configured). Show the full org so Harry still has
    // visibility, with a clear, honest banner on what unlocks the live data.
    renderWfOrg(fallback);
    renderWfShifts({});
    renderWfQueue({ pending: [] });
    renderWfFeed([]);
    renderWfKill({ global: false });
    _wfLive = null; renderWfBrief(null);
    renderBlitzState();
    loadWfCreatives();
    wfBanner('<b>Org chart and creatives are live below. Live activity, shifts and the approval queue need the backend deployed.</b><br>Push the latest commits so the new functions go live, set <code>AGENT_TOKEN</code> in Netlify, then run <code>bash agents/install-autostart.sh</code> once. After that this fills in by itself.', 'warn');
    return;
  }

  wfBanner('', 'ok');
  _wfLive = live;
  renderWfSetup(live.env);
  renderWfTeams(live);
  renderBlitzState();
  loadWfCreatives();
  renderWfShifts(live.shifts || {});
  renderWfQueue(live.queue || {});
  renderWfOrg((live.org && live.org.length) ? live.org : fallback);
  renderWfFeed(live.activity || []);
  renderWfBrief(live);
  renderWfKill(live.queue && live.queue.kill || { global: false });
  const pend = (live.queue && live.queue.counts && live.queue.counts.pending) || 0;
  const nb = document.getElementById('nav-count-queue'); if (nb) nb.textContent = pend ? pend : '';
  const qc = document.getElementById('wf-q-count'); if (qc) qc.textContent = pend ? '· ' + pend + ' pending' : '· clear';
}

// Setup health strip: only shows when a critical env var is missing, so Harry
// can see at a glance why the board/brief/sends might be quiet. When all the
// must-haves are set, it stays hidden.
function renderWfSetup(env) {
  const el = document.getElementById('wf-setup'); if (!el) return;
  if (!env) { el.style.display = 'none'; return; }
  const checks = [
    ['agentToken', 'AGENT_TOKEN', 'the live board and brief stay empty (agents cannot log what they do)', true],
    ['smtp', 'SMTP_PASS', 'approved outreach cannot actually send', true],
    ['supportSmtp', 'SUPPORT_SMTP_PASS', 'the reply loop cannot read your inbox', true],
    ['netlifyToken', 'NETLIFY_AUTH_TOKEN', 'live preview links will not publish', true],
    ['openai', 'OPENAI_API_KEY', 'reply classification falls back to rules (optional)', false],
  ];
  const missing = checks.filter(c => !env[c[0]]);
  const blocking = missing.filter(c => c[3]);
  if (!missing.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = '<div class="wf-setupbar">' +
    '<div class="hd">⚙ Setup needed · ' + blocking.length + ' setting' + (blocking.length === 1 ? '' : 's') + ' stop the team working. Add in Netlify → Project configuration → Environment variables, then redeploy.</div>' +
    missing.map(function (c) {
      return '<div class="row ' + (c[3] ? 'block' : 'opt') + '"><code>' + c[1] + '</code><span>' + (c[3] ? 'Missing — ' : 'Optional — ') + wfEsc(c[2]) + '</span></div>';
    }).join('') + '</div>';
}

function renderWfShifts(shifts) {
  const order = ['morning', 'midday', 'evening'];
  document.getElementById('wf-shifts').innerHTML = order.map(function (k) {
    const s = shifts[k] || {};
    const cls = s.running ? 'live' : s.stale ? 'stale' : 'ok';
    const state = s.running ? 'Running now' : s.stale ? 'Not run recently' : 'Idle, healthy';
    return '<div class="wf-shift"><div class="nm"><span class="wf-dot ' + cls + '"></span>' + k + ' shift</div>' +
      '<div class="meta">' + state + '<br>Last: ' + wfAgo(s.last) + (s.lastExit != null ? ' · exit ' + s.lastExit : '') + '</div></div>';
  }).join('');
}

function renderWfKill(kill) {
  const on = !kill.global;
  document.getElementById('wf-killbar').innerHTML = 'Auto-sending: ' +
    '<button class="' + (on ? '' : 'off') + '" onclick="wfToggleKill(' + (on ? 'true' : 'false') + ')">' +
    (on ? 'LIVE — tap to stop everything' : 'STOPPED — tap to resume') + '</button>';
}
async function wfToggleKill(stop) {
  await fetch('/.netlify/functions/queue-action', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ action: stop ? 'kill' : 'unkill', category: 'global' }) });
  loadWorkforce();
}

function renderWfQueue(q) {
  const items = q.pending || [];
  const el = document.getElementById('wf-queue');
  if (!items.length) { el.innerHTML = '<div class="wf-empty">Nothing waiting. The staff are clear.</div>'; return; }
  const blitzN = items.filter(function (i) { return i.meta && i.meta.blitz; }).length;
  const bar = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
    '<button class="wf-go" style="flex:1" onclick="wfApproveAll(' + (blitzN ? 'true' : 'false') + ')">' + (blitzN ? '🔥 Approve &amp; send all ' + blitzN + ' blitz emails' : 'Approve &amp; send all ' + items.length) + '</button></div>';
  el.innerHTML = bar + items.map(function (it) {
    var hotTag = (it.meta && it.meta.hot) ? '<span style="color:#c0341f;font-weight:700">🔥 HOT LEAD</span> · ' : (it.meta && it.meta.segment ? '<span style="color:#9a6b16">' + wfEsc(it.meta.segment) + '</span> · ' : '');
    return '<div class="item" data-id="' + it.id + '">' +
      '<div class="cat"><span>' + hotTag + wfEsc(it.category) + (it.to ? ' · ' + wfEsc(it.to) : '') + '</span><span>' + wfAgo(it.createdAt) + '</span></div>' +
      '<div class="subj">' + wfEsc(it.subject || '(no subject)') + '</div>' +
      '<div class="body" id="wf-b-' + it.id + '">' + wfEsc(it.editedBody || it.body) + '</div>' +
      '<div class="acts">' +
        '<button class="wf-ap" onclick="wfAct(\'' + it.id + '\',\'approve\')">Approve</button>' +
        '<button class="wf-ed" onclick="wfEdit(\'' + it.id + '\')">Edit</button>' +
        '<button class="wf-rj" onclick="wfAct(\'' + it.id + '\',\'reject\')">Reject</button>' +
      '</div></div>';
  }).join('');
}
async function wfApproveAll(blitzOnly) {
  if (!confirm('Approve and send these emails now? They go out within the daily cap, every one carries a one-click unsubscribe.')) return;
  wfToast('Approving and sending...');
  try {
    const r = await fetch('/.netlify/functions/queue-action', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ action: 'approve-batch', blitz: !!blitzOnly }) });
    const d = await r.json().catch(function () { return {}; });
    const sent = d.dispatched && d.dispatched.sent;
    wfToast(r.ok ? ('Approved ' + (d.approved || 0) + (sent != null ? ', sent ' + sent + ' now (rest within the cap)' : '. Sending within the daily cap.')) : 'Could not approve (check deploy/password).');
  } catch (_) { wfToast('Could not reach the queue.'); }
  setTimeout(loadWorkforce, 1200);
}
async function wfAct(id, action, editedBody) {
  await fetch('/.netlify/functions/queue-action', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ action: action, id: id, editedBody: editedBody }) });
  loadWorkforce();
}
function wfEdit(id) {
  const b = document.getElementById('wf-b-' + id);
  if (b.getAttribute('contenteditable') === 'true') { wfAct(id, 'edit', b.innerText); return; }
  b.setAttribute('contenteditable', 'true'); b.focus();
  const btn = b.closest('.item').querySelector('.wf-ed'); if (btn) btn.textContent = 'Save & approve';
}

// Live tiers (since the role last logged anything):
//   working now  < 3 min   green, pulsing  - on a task right now
//   active       < 30 min  amber           - worked very recently this session
//   idle         else      grey            - off shift / waiting
function wfState(r) {
  if (!r.last || !r.last.at) return 'idle';
  const s = (Date.now() - Date.parse(r.last.at)) / 1000;
  if (s < 360) return 'work';   // heartbeat re-logs every 2 min; 6-min window keeps desks green through a blitz
  if (s < 3600) return 'recent';
  return 'idle';
}
function renderWfOrg(org) {
  _wfOrgData = org;
  let working = 0, totalRoles = 0;
  const html = org.map(function (d) {
    let wn = 0, rn = 0;
    const roles = d.roles.map(function (r) {
      totalRoles++;
      const st = wfState(r);
      if (st === 'work') { wn++; working++; } else if (st === 'recent') rn++;
      const task = r.last ? wfEsc(r.last.action) : 'waiting for the next shift';
      const when = r.last ? wfAgo(r.last.at) : '';
      return '<div class="wf-role st-' + st + '"><span class="wf-rdot"></span>' +
        '<span class="r">' + wfEsc(r.name) + '</span>' +
        '<span class="a"><span class="task">' + task + '</span>' + (when ? '<span class="when">' + when + '</span>' : '') + '</span></div>';
    }).join('');
    const tag = wn ? ' <span class="wf-tag work">' + wn + ' working now</span>'
      : rn ? ' <span class="wf-tag recent">' + rn + ' active</span>'
      : ' <span class="wf-tag idle">' + d.roles.length + ' on standby</span>';
    return '<div class="wf-dept"><div class="wf-dept-name">' + wfEsc(d.dept) + tag + '</div><div class="wf-roles">' + roles + '</div></div>';
  }).join('');
  document.getElementById('wf-org').innerHTML = html;
  const hdr = document.getElementById('wf-org-head');
  if (hdr) hdr.innerHTML = working
    ? '<span class="wf-livedot"></span><b>' + working + '</b> of ' + totalRoles + ' staff working right now'
    : '<span class="wf-livedot off"></span>' + totalRoles + ' staff on standby · hit Blitz to put everyone to work';
}

// Search-team panel on the SEO page: the strike list (winnable queries
// ranking 4-15) from Search Console, plus what the Search team improved.
async function renderSearchTeam() {
  const strike = document.getElementById('st-strike'); if (!strike) return;
  try {
    const r = await fetch('/.netlify/functions/search-console-data', { headers: { 'x-admin-password': ADMIN_PW } });
    const d = await r.json();
    const data = d.data || d;
    const qs = (data && data.topQueries) || [];
    if (d.unavailable || !qs.length) {
      strike.innerHTML = '<div class="st-empty">Search Console not connected yet, or no query data on this new domain. Connect the GSC API (one-time) and the strike list fills automatically as Google starts showing positions.</div>';
      document.getElementById('st-strike-n').textContent = '';
      return;
    }
    const list = qs.filter(function (q) { const p = parseFloat(q.position); return p >= 4 && p <= 15; })
      .sort(function (a, b) { return (b.impressions || 0) - (a.impressions || 0); }).slice(0, 12);
    document.getElementById('st-strike-n').textContent = list.length ? '· ' + list.length : '';
    if (!list.length) { strike.innerHTML = '<div class="st-empty">No queries in the 4-15 band yet. As impressions grow, winnable queries appear here.</div>'; return; }
    strike.innerHTML = list.map(function (q) {
      return '<div class="st-row"><span class="q">' + escapeHTML(q.query) + '</span><span class="imp">' + (q.impressions || 0) + ' impr</span><span class="pos">#' + q.position + '</span></div>';
    }).join('');
  } catch (_) {
    strike.innerHTML = '<div class="st-empty">Could not reach Search Console. It needs the GSC API connected and the latest deploy.</div>';
  }
  // What the Search team did: pull recent Search-dept activity.
  try {
    const r = await fetch('/.netlify/functions/agent-log', { headers: { 'x-admin-password': ADMIN_PW } });
    if (r.ok) {
      const d = await r.json();
      const work = (d.activity || []).filter(function (a) { return /search|seo|strike|index|page/i.test((a.role || '') + (a.dept || '') + (a.action || '')); }).slice(0, 10);
      const el = document.getElementById('st-work');
      if (work.length) el.innerHTML = work.map(function (a) { return '<div class="st-row"><span class="q">' + escapeHTML(a.action) + '</span><span class="imp">' + wfAgo(a.at) + '</span></div>'; }).join('');
    }
  } catch (_) {}
}

async function loadWfCreatives() {
  const box = document.getElementById('wf-creatives'); if (!box) return;
  let items = [];
  // Static manifest (committed creatives, always available).
  try { const r = await fetch('/admin/creatives/manifest.json?t=' + Date.now()); if (r.ok) { const d = await r.json(); items = (d.creatives || []).map(function (c) { return { id: c.id, kind: c.kind, hook: c.hook, url: '/admin/' + c.file, by: c.by }; }); } } catch (_) {}
  // Agent-made creatives from the Blobs store (if the function is deployed).
  try { const r = await fetch('/.netlify/functions/creatives-list', { headers: wfHdr() }); if (r.ok) { const d = await r.json(); (d.creatives || []).forEach(function (c) { items.unshift({ id: c.id, kind: c.kind || 'New', hook: c.hook || '', url: c.url, by: c.by || 'Ad Creative Designer' }); }); } } catch (_) {}
  const cc = document.getElementById('wf-cr-count'); if (cc) cc.textContent = items.length ? '· ' + items.length : '';
  if (!items.length) { box.innerHTML = '<div class="wf-empty">No creatives yet. The design team adds them on each evening shift.</div>'; return; }
  box.innerHTML = items.map(function (c) {
    return '<a class="wf-cr" href="' + c.url + '" download title="Download ' + wfEsc(c.id) + '">' +
      '<img class="thumb" src="' + c.url + '" alt="" loading="lazy">' +
      '<div class="meta"><div class="k">' + wfEsc(c.kind) + '</div><div class="h">' + wfEsc(c.hook) + '</div><div class="dl">Download &#8595;</div></div></a>';
  }).join('');
}

function wfToast(msg) {
  let t = document.getElementById('wf-toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600);
}
async function wfStartEveryone() {
  if (!confirm('WAR ROOM: put the WHOLE company on it at full effort for the next 2 hours. Every desk works in a loop, every few minutes, until you hit Stop or the time runs out. Sales, SEO, site fixes, analytics, creative, all hands. Everything still lands in your approval queue.')) return;
  wfToast('War room ON. The whole company is going flat out...');
  try {
    // 1. Turn on the sustained 2-hour war-room mode (the Mac loops it).
    await fetch('/.netlify/functions/blitz-mode', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ action: 'start', hours: 2 }) });
    // 2. Fire the first wave instantly so Harry sees movement now.
    const r = await fetch('/.netlify/functions/trigger-shift', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ shift: 'blitz' }) });
    const d = await r.json().catch(function () { return {}; });
    wfToast(r.ok ? ('WAR ROOM LIVE for 2h: scavenged ' + (d.scavenged || 0) + ', found ' + (d.enriched || 0) + ' contacts, drafted ' + (d.drafted || 0) + '. The team keeps going every few minutes until you Stop.') : 'Could not trigger (check ADMIN_PASSWORD/deploy).');
  } catch (_) { wfToast('Could not reach the war-room endpoint. Push + set ADMIN_PASSWORD.'); }
  setTimeout(loadWorkforce, 1500);
  setTimeout(loadWorkforce, 4500);
}
async function wfStopBlitz() {
  wfToast('Standing the team down...');
  try { await fetch('/.netlify/functions/blitz-mode', { method: 'POST', headers: wfHdr(), body: JSON.stringify({ action: 'stop' }) }); wfToast('War room off. Drafts already made stay in your queue.'); }
  catch (_) { wfToast('Could not reach the endpoint.'); }
  setTimeout(loadWorkforce, 1000);
}
async function renderBlitzState() {
  const el = document.getElementById('wf-blitzbar'); if (!el) return;
  let m = {};
  try { const r = await fetch('/.netlify/functions/blitz-mode', { headers: wfHdr() }); if (r.ok) m = await r.json(); } catch (_) {}
  const go = document.querySelector('.wf-go');
  if (m && m.active) {
    el.style.display = 'block';
    el.innerHTML = '<div class="wf-warroom">⚔️ WAR ROOM ACTIVE · whole company working flat out · <b>' + (m.minsLeft || 0) + ' min left</b> <button onclick="wfStopBlitz()">■ Stop</button></div>';
    if (go) { go.textContent = '⚔️ War room running…'; go.disabled = true; go.style.opacity = '.6'; }
  } else {
    el.style.display = 'none'; el.innerHTML = '';
    if (go) { go.textContent = '🔥 Blitz · all hands for 2 hours'; go.disabled = false; go.style.opacity = '1'; }
  }
}
async function wfSendBrief() {
  wfToast('Building your brief...');
  try {
    const r = await fetch('/.netlify/functions/send-brief', { method: 'POST', headers: wfHdr() });
    wfToast(r.ok ? 'Brief sent to your inbox.' : 'Could not send the brief (check SMTP/deploy).');
  } catch (_) { wfToast('Could not reach send-brief. Push the latest commits.'); }
}

// The live brief: a rolling, self-updating boardroom summary composed from the
// data we already hold (org + queue + feed). Re-rendered every second by the
// ticker and refreshed every 5s by the poll, so it is genuinely live.
function renderWfBrief(live) {
  const el = document.getElementById('wf-brief'); if (!el) return;
  const lt = document.getElementById('wf-brief-live');
  if (!live) {
    if (lt) lt.innerHTML = '';
    el.innerHTML = '<div class="wf-empty">The live brief fills in once the backend is deployed and a shift or blitz has run.</div>';
    return;
  }
  if (lt) lt.innerHTML = '<span class="wf-livedot"></span>updating live';
  const org = live.org || [];
  const feed = live.activity || [];
  const q = live.queue || {};
  const counts = q.counts || {};
  let working = 0, total = 0;
  org.forEach(function (d) { d.roles.forEach(function (r) { total++; if (r.last && (Date.now() - Date.parse(r.last.at)) < 180000) working++; }); });
  const pending = counts.pending || 0;
  const sentToday = q.sentToday || 0;
  const hot = (q.pending || []).filter(function (i) { return i.meta && i.meta.hot; }).length;

  // Headline KPI strip.
  const kpis = [
    ['🟢', working, working === 1 ? 'staff working now' : 'staff working now'],
    ['✉', pending, 'waiting for your approval'],
    ['✓', sentToday, 'sent today'],
    ['🔥', hot, hot === 1 ? 'hot lead in the queue' : 'hot leads in the queue'],
  ].map(function (k) { return '<div class="wf-kpi"><span class="ic">' + k[0] + '</span><b>' + k[1] + '</b><span class="lb">' + k[2] + '</span></div>'; }).join('');

  // What needs Harry, right now.
  let action;
  if (pending > 0) action = '<button class="wf-go" style="padding:10px 18px" onclick="wfApproveAll(' + (hot ? 'true' : 'false') + ')">Approve &amp; send ' + pending + ' now &rarr;</button>';
  else action = '<span class="wf-allclear">Queue clear · the team is finding and drafting the next wave</span>';

  // Live "right now" lines from the feed (ticking timestamps).
  const lines = feed.slice(0, 6).map(function (a) {
    return '<div class="wf-brief-line"><span class="t">' + wfAgo(a.at) + '</span><span><b>' + wfEsc(a.role) + '</b> ' + wfEsc(a.action) + '</span></div>';
  }).join('') || '<div class="wf-empty">Hit Blitz to put the whole company to work.</div>';

  el.innerHTML =
    '<div class="wf-kpis">' + kpis + '</div>' +
    '<div class="wf-brief-action">' + action + '</div>' +
    '<div class="wf-brief-lines"><div class="hd">Happening right now</div>' + lines + '</div>';
}

// ── Teams: a tab per department, each with its people, live work, and a
// derived issues/resolve list Harry can copy and send to be fixed. ──────────
function deriveTeamIssues(live) {
  const env = live.env || {};
  const q = live.queue || {};
  const counts = q.counts || {};
  const kill = q.kill || {};
  const issues = [];
  // Env gaps (the usual reason the team looks asleep).
  if (!env.agentToken) issues.push({ team: 'All', sev: 'block', issue: 'Activity logging is offline, so the board cannot show what anyone is doing.', resolve: 'Set AGENT_TOKEN in Netlify env vars, then redeploy.' });
  if (!env.smtp) issues.push({ team: 'Operations & Finance', sev: 'block', issue: 'Approved emails cannot be sent.', resolve: 'Set SMTP_PASS in Netlify env vars.' });
  if (!env.supportSmtp) issues.push({ team: 'Customer Service', sev: 'block', issue: 'The reply loop cannot read the inbox, so inbound replies are not handled.', resolve: 'Set SUPPORT_SMTP_PASS in Netlify env vars.' });
  if (!env.netlifyToken) issues.push({ team: 'Business Development', sev: 'warn', issue: 'Live preview links will not publish, so cold emails fall back to the plain pitch.', resolve: 'Set NETLIFY_AUTH_TOKEN in Netlify env vars.' });
  if (!env.openai) issues.push({ team: 'Customer Service', sev: 'info', issue: 'Reply classification is using the rule engine (no AI).', resolve: 'Optional: set OPENAI_API_KEY for sharper triage.' });
  // Operational signals.
  if (kill.global) issues.push({ team: 'Operations & Finance', sev: 'block', issue: 'Auto-sending is stopped (kill switch on).', resolve: 'Tap the auto-sending switch at the top of the Workforce tab to resume.' });
  if (counts.failed) issues.push({ team: 'Operations & Finance', sev: 'warn', issue: counts.failed + ' email(s) failed to send.', resolve: 'Usually an SMTP credential or a bad address; check the dispatcher logs.' });
  return issues;
}
function wfCopyIssues() {
  const live = _wfLive; if (!live) return;
  const issues = deriveTeamIssues(live);
  if (!issues.length) { wfToast('No open issues to copy. Every team is clear.'); return; }
  const txt = 'StaticSwift workforce issues (' + new Date().toLocaleString('en-GB') + '):\n\n' +
    issues.map(function (i, n) { return (n + 1) + '. [' + i.team + '] ' + i.issue + '\n   Fix: ' + i.resolve; }).join('\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { wfToast('Copied ' + issues.length + ' issue(s). Paste them to me and I will fix them.'); }, function () { wfToast('Could not copy automatically.'); });
  } else { wfToast('Clipboard not available in this browser.'); }
}
function wfSelectTeam(dept) { _wfTeam = dept; if (_wfLive) renderWfTeams(_wfLive); }
function renderWfTeams(live) {
  const tabsEl = document.getElementById('wf-team-tabs'); const detEl = document.getElementById('wf-team-detail');
  if (!tabsEl || !detEl) return;
  const org = live.org || [];
  if (!org.length) { tabsEl.innerHTML = ''; detEl.innerHTML = '<div class="wf-empty">Teams fill in once the backend is logging activity.</div>'; return; }
  const issues = deriveTeamIssues(live);
  const lt = document.getElementById('wf-teams-live');
  if (lt) lt.innerHTML = issues.length ? ('<span style="color:#9C2615;font-weight:700">' + issues.length + ' issue' + (issues.length === 1 ? '' : 's') + ' to fix</span>') : '<span class="wf-livedot"></span>all clear';
  if (!_wfTeam || (_wfTeam !== 'All' && !org.find(function (d) { return d.dept === _wfTeam; }))) _wfTeam = org[0].dept;

  // Tabs: each dept, with a working count and an issue dot.
  const issueDepts = {}; issues.forEach(function (i) { issueDepts[i.team] = (issueDepts[i.team] || 0) + 1; });
  tabsEl.innerHTML = org.map(function (d) {
    const wn = d.roles.filter(function (r) { return wfState(r) === 'work'; }).length;
    const hasIssue = issueDepts[d.dept] || issueDepts['All'];
    return '<button class="wf-teamtab' + (_wfTeam === d.dept ? ' on' : '') + '" onclick="wfSelectTeam(\'' + d.dept.replace(/'/g, "\\'") + '\')">' +
      wfEsc(d.dept) + ' <span class="n">' + wn + '/' + d.roles.length + '</span>' + (hasIssue ? '<span class="idot"></span>' : '') + '</button>';
  }).join('');

  // Detail for the selected team.
  const dept = org.find(function (d) { return d.dept === _wfTeam; }) || org[0];
  const feed = (live.activity || []).filter(function (a) { return a.dept === dept.dept; }).slice(0, 8);
  const teamIssues = issues.filter(function (i) { return i.team === dept.dept || i.team === 'All'; });
  const members = dept.roles.map(function (r) {
    const st = wfState(r);
    return '<div class="wf-tm st-' + st + '"><span class="wf-rdot"></span><span class="nm">' + wfEsc(r.name) + '</span>' +
      '<span class="tk">' + (r.last ? wfEsc(r.last.action) + ' <span class="ago">' + wfAgo(r.last.at) + '</span>' : 'on standby') + '</span></div>';
  }).join('');
  const work = feed.length ? feed.map(function (a) { return '<div class="wf-tw"><span class="t">' + wfAgo(a.at) + '</span><span><b>' + wfEsc(a.role) + '</b> ' + wfEsc(a.action) + '</span></div>'; }).join('')
    : '<div class="wf-empty">No work logged for this team yet.</div>';
  const issuesHtml = teamIssues.length
    ? teamIssues.map(function (i) { return '<div class="wf-iss ' + i.sev + '"><div class="q">⚠ ' + wfEsc(i.issue) + '</div><div class="r">Fix: ' + wfEsc(i.resolve) + '</div></div>'; }).join('')
    : '<div class="wf-allclear">No open issues for this team.</div>';
  detEl.innerHTML =
    '<div class="wf-team-cols">' +
      '<div class="wf-tcol"><div class="hd">People</div>' + members + '</div>' +
      '<div class="wf-tcol"><div class="hd">Recent work</div>' + work + '</div>' +
      '<div class="wf-tcol"><div class="hd">Issues to resolve</div>' + issuesHtml + '</div>' +
    '</div>';
}

function renderWfFeed(feed) {
  _wfFeedData = feed;
  const el = document.getElementById('wf-feed');
  if (!feed.length) { el.innerHTML = '<div class="wf-empty">No activity logged yet. The feed fills as shifts run.</div>'; return; }
  el.innerHTML = feed.map(function (a) {
    return '<div class="row"><span class="t">' + wfAgo(a.at) + '</span><span><span class="r">' + wfEsc(a.role) + '</span> ' + wfEsc(a.action) + (a.detail ? ' <span style="color:var(--muted)">· ' + wfEsc(a.detail) + '</span>' : '') + '</span></div>';
  }).join('');
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


/* ================================================================
   PROSPECT RESEARCH & OUTREACH — site analyzer + legal templates.
   PECR-compliant. Helps you do outreach manually + at scale.
   ================================================================ */

let _lastAnalysis = null;

async function runAnalyze() {
  const urlEl = document.getElementById('analyze-url');
  const resultEl = document.getElementById('analyze-result');
  const btn = document.getElementById('analyze-btn');
  if (!urlEl || !resultEl) return;
  const url = (urlEl.value || '').trim();
  if (!url) { alert('Enter a URL to analyze.'); return; }
  btn.textContent = 'Analyzing…'; btn.disabled = true;
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:13px">Fetching site, scoring, extracting public contacts…</div>';
  try {
    const r = await fetch('/.netlify/functions/analyze-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ url })
    });
    const d = await r.json();
    if (!r.ok || !d) throw new Error(d?.error || 'Failed');
    _lastAnalysis = d;
    resultEl.innerHTML = renderAnalysis(d);
  } catch(err) {
    resultEl.innerHTML = '<div style="padding:14px;color:var(--red);font-size:13px">Analyze failed: ' + escapeHTML(err.message || 'unknown') + '</div>';
  } finally {
    btn.textContent = 'Analyze →'; btn.disabled = false;
  }
}

function renderAnalysis(d) {
  const scoreColor = d.score >= 70 ? 'var(--green)' : d.score >= 40 ? 'var(--amber)' : 'var(--red)';
  const fit = d.score < 50 ? 'Great fit — site clearly needs replacing' :
              d.score < 70 ? 'Decent fit — some real issues to mention' :
                             'Site is OK — only worth pitching with a sharp angle';
  const emails = (d.emails || []).length
    ? d.emails.map(e => '<a href="mailto:'+encodeURI(e)+'" style="color:var(--cyan)">'+escapeHTML(e)+'</a>').join('<br>')
    : '<span style="color:var(--dim)">none on this page — try /contact</span>';
  const phones = (d.phones || []).length
    ? d.phones.map(p => '<a href="tel:'+encodeURI(p.replace(/\s+/g,''))+'" style="color:var(--cyan)">'+escapeHTML(p)+'</a>').join(' · ')
    : '<span style="color:var(--dim)">none extracted</span>';
  const socials = Object.entries(d.socials || {}).map(([k,v]) => '<a href="'+encodeURI(v)+'" target="_blank" rel="noopener" style="color:var(--cyan);font-size:11px">'+k+' ↗</a>').join(' · ') || '<span style="color:var(--dim);font-size:11px">none</span>';
  const issues = (d.issues || []).length
    ? '<ul style="margin:6px 0 0 16px;font-size:12px;color:var(--muted);line-height:1.7">' + d.issues.map(i => '<li>'+escapeHTML(i)+'</li>').join('') + '</ul>'
    : '<div style="font-size:12px;color:var(--green);margin-top:4px">No major issues detected.</div>';
  return `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:14px 18px;align-items:start">
      <div style="text-align:center;padding:14px 16px;background:var(--dark);border-radius:10px;border:1px solid var(--border)">
        <div style="font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:${scoreColor};line-height:1">${d.score}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-top:4px">Site score</div>
        <div style="font-size:10px;color:${scoreColor};font-weight:700;margin-top:8px;text-transform:uppercase;letter-spacing:.06em">${d.score < 50 ? 'POOR' : d.score < 70 ? 'OK' : 'GOOD'}</div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px">${escapeHTML(d.title || d.host || 'Unknown')}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">${escapeHTML(d.host || '')} · ${escapeHTML(d.platform || 'Unknown platform')} · ${d.responseMs}ms · ${d.htmlSizeKB}KB</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Fit verdict</div>
        <div style="font-size:13px;color:var(--text);margin-bottom:12px">${escapeHTML(fit)}</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Issues found</div>
        ${issues}
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;padding-top:14px;border-top:1px solid var(--border);grid-column:1/-1">Public contact details extracted</div>
      <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;font-size:13px">
        <div><div style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Emails</div>${emails}</div>
        <div><div style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Phones</div>${phones}</div>
        <div><div style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Socials</div>${socials}</div>
      </div>
      <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border)">
        <button onclick="addProspectFromAnalysis()" class="btn-primary" style="font-size:13px">+ Add to prospects</button>
        <a href="https://pagespeed.web.dev/report?url=${encodeURIComponent(d.url)}" target="_blank" rel="noopener" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:9px 14px;border-radius:7px;font-size:12px;font-weight:600;text-decoration:none">PageSpeed ↗</a>
        <a href="https://search.google.com/test/mobile-friendly?url=${encodeURIComponent(d.url)}" target="_blank" rel="noopener" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:9px 14px;border-radius:7px;font-size:12px;font-weight:600;text-decoration:none">Mobile-friendly ↗</a>
      </div>
    </div>`;
}

function addProspectFromAnalysis() {
  if (!_lastAnalysis) return;
  const d = _lastAnalysis;
  const bizGuess = (d.title || d.host || '').split(/[|·–-]/)[0].trim().slice(0, 80) || d.host;
  const email = (d.emails || [])[0] || '';
  const phone = (d.phones || [])[0] || '';
  const issuesNote = (d.issues || []).slice(0, 3).join(' · ');
  const newProspect = {
    id: 'p-' + Date.now(),
    bizname: bizGuess,
    name: '',
    email,
    type: 'Other',
    location: '',
    phone,
    notes: 'Site score: ' + d.score + '/100 · ' + d.platform + ' · ' + issuesNote,
    website: d.url,
    siteScore: d.score,
    sitePlatform: d.platform,
    siteIssues: d.issues || [],
    status: 'new',
    addedAt: new Date().toISOString(),
  };
  prospects.unshift(newProspect);
  saveProspects();
  renderProspects();
  refreshProspectDropdown();
  alert('Added to prospects: ' + bizGuess);
}

/* ── OUTREACH TEMPLATES — PECR-compliant, merge fields, mandatory footer ── */

const SENDER_FOOTER = '\n\n—\nHarry · StaticSwift\nManchester, UK\n07502 731 799 · hello@staticswift.co.uk\n\nThis is a one-time business introduction. If you\'d rather I never contact you again, reply STOP and I\'ll remove you immediately. Sent under PECR Reg. 22(2)–(3) on a B2B basis.';

/*  TEMPLATE LIBRARY v2 — short, specific, mobile-first.
    Research-backed patterns:
      - Subject < 50 chars, lowercase first word
      - Body < 100 words preferred
      - First sentence references a real signal (not generic praise)
      - One specific CTA at the end
      - P.S. line (highest read element on cold email)
    Each template has a stable id used by analytics to track A/B reply rates.
*/
const TEMPLATES = {
  'short-curiosity': {
    label: 'Short curiosity (shortest)',
    subject: '{biz}',
    body: `Hi {nameOrThere},

Saw your site. One thing jumped out at me — {observation}.

I build fast hand-coded sites for UK trades (£149 flat, live in 24h, no payment until you love it). Happy to mock up a free preview if you're curious — no email needed, just reply "yes" and your address.

Either way, hope business is busy.

Harry

P.S. If never contacting me again sounds better, just reply STOP.`,
  },
  'specific-signal': {
    label: 'Specific signal (use site-analyzer issue)',
    subject: 'two things about {biz}',
    body: `Hi {nameOrThere},

Quick honest one — opened {website} on my phone yesterday. Two things you'd probably want to know:

{issuesBullets}

I rebuild sites like yours from scratch in 24 hours, £149 flat, no payment until you approve the preview. If you'd rather see what I make than read about it: staticswift.co.uk

If now's not the time, no worries — just reply STOP and I'll go quiet.

Harry · Manchester

P.S. Average reply time from me is under an hour during the week.`,
  },
  'cold-observation': {
    label: 'Cold — specific observation',
    subject: 'Quick thought on {biz}\'s site',
    body: `Hi {nameOrThere},

I'm Harry — I build hand-coded websites for UK small businesses out of Manchester. I came across {biz} while looking at {type} businesses in {location} and had a quick look at {website}.

Honest, one-line observation: {observation}.

If you ever want to replace it, I do flat-fee sites (£149 starter, £299 advanced) with a working preview in 24 hours — no payment until you love it. I'm not asking you to buy anything today; just wanted to put my name in your inbox in case you've been thinking about it.

If you'd rather see what I build than read about it: https://staticswift.co.uk

Cheers,
Harry`,
  },
  'cold-light': {
    subject: 'New website for {biz}?',
    body: `Hi {nameOrThere},

I'm Harry — I build websites for UK trades out of Manchester. Flat fee (£149 starter, £299 advanced), live in 24 hours, no payment until you love it.

If {biz} is due a new site — or doesn't have one yet — I'd love the chance to build you a free preview. No commitment, no card. You either love it and pay, or walk away.

https://staticswift.co.uk if you want to see what I make.

Cheers,
Harry`,
  },
  'followup-1': {
    subject: 'Re: Quick thought on {biz}\'s site',
    body: `Hi {nameOrThere},

Just bumping this in case it landed in spam. Happy to leave you alone if you'd rather — just reply STOP.

If you'd like a free preview of what a new site for {biz} could look like, send me one line about what you do and I'll have something to share within 24 hours.

Cheers,
Harry`,
  },
  'followup-2': {
    subject: 'Last note on {biz}',
    body: `Hi {nameOrThere},

Last time I'll bother you on this one. If anything changes and you'd like me to mock up a free preview for {biz}, the offer stands.

Either way — wishing you a strong rest of the year.

Cheers,
Harry`,
  },
  'post-analysis': {
    subject: '{biz}\'s site — three quick fixes (or a fresh build)',
    body: `Hi {nameOrThere},

I had a quick look at {website} and noticed:

{issuesBullets}

I build hand-coded sites that fix all three by default — £149 for a one-pager, £299 for an advanced site, live in 24 hours, no payment until you love it.

If you'd like a free preview of what a new {biz} site could look like, just hit reply with "yes please" and your business address.

If you'd rather not hear from me, reply STOP — I'll remove you immediately.

Cheers,
Harry`,
  },
  'free-preview': {
    label: 'Free preview offer (high-conversion)',
    subject: 'free mockup for {biz}?',
    body: `Hi {nameOrThere},

I'm a UK web designer and I'd genuinely like to make you a free mockup of what {biz}'s website could look like — no commitment, no pitch.

Why I'm offering this: I'd rather show you what I make than tell you. If you like it, it's £149 to build properly. If you don't, you keep the mockup as inspiration.

Just hit reply with your address (or just "yes" — I'll grab the details from {website}).

Harry · Manchester

P.S. Turnaround is normally 24 hours.`,
  },
  'specific-cta': {
    label: 'Specific CTA (asks one question)',
    subject: 'a question about {biz}',
    body: `Hi {nameOrThere},

What's the one thing about your current site that bothers you most?

Reason: I rebuild sites for UK trades — £149, 24 hours, no payment until you love it — and I'd rather fix the thing that actually annoys you than guess.

If now's not the time, reply STOP and I'll vanish.

Harry · Manchester
07502 731 799`,
  },
  'social-proof': {
    label: 'Social proof anchor',
    subject: 'how a local barber tripled bookings',
    body: `Hi {nameOrThere},

A barber in Manchester ran a Facebook page only — no website. I built him a £149 hand-coded site over a weekend. Eight months later: triple the bookings, 4.9 on Google with 187 reviews, indexes #1 for "barber northern quarter".

That site is at staticswift.co.uk/example-fade-and-blade if you want to see it.

If a similar result for {biz} sounds useful, hit reply — I'll mock up a free preview within 24 hours.

If not, reply STOP and I'll go quiet.

Harry`,
  },
  'final-bump': {
    label: 'Final bump (last-touch)',
    subject: 'closing the loop on {biz}',
    body: `Hi {nameOrThere},

I'll close the loop on this — totally fine if it's not the right time.

Just wanted to say: if at any point you want a free preview of what a new {biz} site could look like, my offer still stands. £149 if you love it, walk away if you don't.

Hope business stays busy either way.

Harry · 07502 731 799

P.S. Reply STOP and I'll archive your details for good.`,
  },
};

/* Subject A/B variants — pick stable per-prospect so re-generations are consistent */
const SUBJECT_VARIANTS = {
  'short-curiosity': ['{biz}', 'one thing about {biz}', 'noticed {biz}'],
  'specific-signal': ['two things about {biz}', '{biz} — three quick things', 'about your site, {biz}'],
  'cold-observation': ['Quick thought on {biz}', 'About {biz}\'s site', '{biz} — could be sharper'],
  'cold-light': ['New site for {biz}?', '{biz}, quick offer', 'Would a new site help {biz}?'],
  'followup-1': ['Re: {biz}', 'bumping this one', 'just in case'],
  'followup-2': ['last note on {biz}', 'closing this out', 'final email'],
  'post-analysis': ['{biz} — three fixes', 'a real audit of {biz}', '{biz}\'s site, honestly'],
  'free-preview': ['free mockup for {biz}?', 'showing > telling', 'no-strings preview for {biz}'],
  'specific-cta': ['a question about {biz}', 'one question, {biz}', 'quick one for {nameOrThere}'],
  'social-proof': ['how a local barber tripled bookings', 'a £149 case study', '{biz} could do this too'],
  'final-bump': ['closing the loop on {biz}', 'last one, promise', 'archiving — unless?'],
};
function pickSubjectVariant(prospectId, tmplKey) {
  const variants = SUBJECT_VARIANTS[tmplKey];
  if (!variants || !variants.length) return null;
  const hash = (prospectId || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return variants[hash % variants.length];
}
function isGoodSendTimeNow() {
  const d = new Date();
  const day = d.getDay();    // 0=Sun
  const hour = d.getHours(); // local
  return [2, 3, 4].includes(day) && hour >= 9 && hour < 12;
}

function refreshProspectDropdown() {
  const sel = document.getElementById('tmpl-prospect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— pick a prospect to merge —</option>' +
    prospects.map((p, i) => '<option value="' + i + '">' + escapeHTML((p.bizname || p.name || 'Unknown') + (p.location ? ' · ' + p.location : '')) + '</option>').join('');
  if (current) sel.value = current;
}

function generateTemplate() {
  const tmplKey = document.getElementById('tmpl-pick').value;
  const idxStr = document.getElementById('tmpl-prospect').value;
  const tmpl = TEMPLATES[tmplKey];
  if (!tmpl) return;
  const idx = parseInt(idxStr, 10);
  const p = isNaN(idx) ? null : prospects[idx];

  const fields = {
    biz: p?.bizname || p?.name || '[business name]',
    nameOrThere: p?.name?.split(' ')[0] || 'there',
    type: p?.type || 'business',
    location: p?.location || 'your area',
    website: p?.website || '[their site URL]',
    observation: (p?.siteIssues && p.siteIssues[0]) || (p?.notes ? p.notes.slice(0, 120) : 'it could be sharper and load faster'),
    issuesBullets: (p?.siteIssues && p.siteIssues.length)
      ? p.siteIssues.slice(0, 3).map(i => '  • ' + i).join('\n')
      : '  • Slow load time\n  • Looks dated on mobile\n  • Not ranking on Google for your trade + town',
  };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => fields[k] ?? '');
  // A/B subject variant — picks one stable per-prospect to track reply rate by variant
  const variant = pickSubjectVariant(p?.id, tmplKey);
  const subject = fill(variant || tmpl.subject);
  if (p) p.lastSubjectVariant = variant || tmpl.subject;
  // Tracking pixel for open-rate. Only embedded when prospect has an ID.
  const trackPx = p?.id
    ? '\n\n<img src="https://staticswift.co.uk/.netlify/functions/track-open?p=' + encodeURIComponent(p.id) + '&t=' + encodeURIComponent(tmplKey) + '" width="1" height="1" alt="" style="display:block" />'
    : '';
  const body = fill(tmpl.body) + SENDER_FOOTER + trackPx;

  document.getElementById('tmpl-result').style.display = 'block';
  document.getElementById('tmpl-subject').value = subject;
  document.getElementById('tmpl-body').value = body;
  const mailto = 'mailto:' + encodeURIComponent(p?.email || '') +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  const mailLink = document.getElementById('tmpl-mailto');
  mailLink.href = mailto;
  mailLink.dataset.prospectIdx = isNaN(idx) ? '' : String(idx);
  mailLink.dataset.template = tmplKey;
}

function copyTmpl() {
  const body = document.getElementById('tmpl-body').value;
  navigator.clipboard.writeText(body).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

function markProspectSent() {
  const link = document.getElementById('tmpl-mailto');
  const idxStr = link?.dataset?.prospectIdx;
  const tmpl = link?.dataset?.template;
  if (!idxStr) { alert('Pick a prospect from the dropdown first.'); return; }
  const idx = parseInt(idxStr, 10);
  if (!prospects[idx]) return;
  prospects[idx].status = 'sent';
  prospects[idx].lastContacted = new Date().toISOString();
  if (!Array.isArray(prospects[idx].emailHistory)) prospects[idx].emailHistory = [];
  prospects[idx].emailHistory.push({ template: tmpl, sentAt: new Date().toISOString(), via: 'manual' });
  saveProspects();
  renderProspects();
  alert('Logged. Status set to "sent" with today\'s date.');
}

// Refresh prospect dropdown whenever the outreach tab is shown
const _origShowPage = window.showPage;
window.showPage = function(id, btn) {
  if (typeof _origShowPage === 'function') _origShowPage(id, btn);
  if (id === 'outreach') setTimeout(refreshProspectDropdown, 50);
};

/* ================================================================
   BATCH SITE-SCANNING AGENT
   Paste 10–200 URLs → scans in parallel (controlled concurrency)
   → scores each → auto-adds prospects whose score < 70
   → results sortable in admin
   ================================================================ */

let _batchAbort = false;
let _batchResults = [];

async function runBatchScan() {
  const ta = document.getElementById('batch-urls');
  const concEl = document.getElementById('batch-concurrency');
  const runBtn = document.getElementById('batch-run-btn');
  const stopBtn = document.getElementById('batch-stop-btn');
  const progress = document.getElementById('batch-progress');
  const resultsEl = document.getElementById('batch-results');
  if (!ta) return;

  // Normalise URL list — accept "domain.co.uk" or full URLs
  const urls = ta.value.split('\n').map(s => s.trim()).filter(Boolean)
    .map(u => /^https?:\/\//i.test(u) ? u : 'https://' + u);
  if (!urls.length) { alert('Paste some URLs to scan.'); return; }
  if (urls.length > 300) { alert('Cap is 300 URLs per batch. Split into batches.'); return; }

  const concurrency = parseInt(concEl.value, 10) || 5;
  _batchAbort = false; _batchResults = [];
  runBtn.disabled = true; runBtn.textContent = 'Scanning…';
  stopBtn.style.display = 'inline-block';
  progress.style.display = 'block';
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:13px">Scoring as results arrive…</div>';

  const total = urls.length;
  let done = 0, failed = 0, prospectsAdded = 0;
  const updateProgress = () => {
    progress.innerHTML = `<span style="color:var(--cyan)">▶</span> ${done}/${total} scanned · ${failed} failed · ${prospectsAdded} added to prospects ${_batchAbort ? '· STOPPED' : ''}`;
  };
  updateProgress();

  // Concurrency-controlled queue — simple worker pool
  const queue = urls.slice();
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => (async () => {
    while (queue.length && !_batchAbort) {
      const url = queue.shift();
      try {
        const r = await fetch('/.netlify/functions/analyze-site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
          body: JSON.stringify({ url }),
        });
        const d = await r.json();
        _batchResults.push(d);
        // Auto-add if site is poor enough to be a real prospect (and we have a contact)
        if (d.ok && d.score < 70 && ((d.emails && d.emails[0]) || (d.phones && d.phones[0]))) {
          const bizGuess = (d.title || d.host || '').split(/[|·–-]/)[0].trim().slice(0, 80) || d.host;
          const existing = prospects.find(p => p.website && p.website.includes(d.host));
          if (!existing) {
            prospects.unshift({
              id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              bizname: bizGuess,
              name: '',
              email: (d.emails || [])[0] || '',
              type: 'Other',
              location: '',
              phone: (d.phones || [])[0] || '',
              notes: 'Auto-added by batch scanner. Score ' + d.score + ' · ' + d.platform + ' · ' + ((d.issues || []).slice(0, 2).join(' · ')),
              website: d.url,
              siteScore: d.score,
              sitePlatform: d.platform,
              siteIssues: d.issues || [],
              status: 'new',
              addedAt: new Date().toISOString(),
              source: 'batch-scanner',
            });
            prospectsAdded++;
          }
        }
      } catch (err) {
        _batchResults.push({ ok: false, url, error: err.message });
        failed++;
      }
      done++;
      updateProgress();
      renderBatchResults();
    }
  })());
  await Promise.all(workers);

  if (prospectsAdded) { saveProspects(); renderProspects(); refreshProspectDropdown(); }
  runBtn.disabled = false; runBtn.textContent = 'Start scan →';
  stopBtn.style.display = 'none';
  updateProgress();
  renderBatchResults();
}

function stopBatchScan() { _batchAbort = true; }

function renderBatchResults() {
  const el = document.getElementById('batch-results');
  if (!el) return;
  // Sort: lowest score first (best prospects), then failures, then high scores
  const sorted = _batchResults.slice().sort((a, b) => {
    if (!a.ok && b.ok) return -1;
    if (a.ok && !b.ok) return 1;
    return (a.score || 100) - (b.score || 100);
  });
  el.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:760px">
        <thead><tr style="border-bottom:1px solid var(--border);text-align:left">
          <th style="padding:8px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-family:'DM Mono',monospace;width:50px">Score</th>
          <th style="padding:8px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-family:'DM Mono',monospace">Site</th>
          <th style="padding:8px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-family:'DM Mono',monospace">Platform</th>
          <th style="padding:8px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-family:'DM Mono',monospace">Contact</th>
          <th style="padding:8px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-family:'DM Mono',monospace">Issues</th>
        </tr></thead>
        <tbody>${sorted.map(rowHTML).join('')}</tbody>
      </table>
    </div>`;
}

function rowHTML(d) {
  if (!d.ok) {
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 10px;color:var(--red);font-weight:700;font-family:'DM Mono',monospace">×</td>
      <td style="padding:8px 10px;color:var(--text);font-size:11px;word-break:break-all">${escapeHTML(d.url || '?')}</td>
      <td colspan="3" style="padding:8px 10px;color:var(--red);font-size:11px">${escapeHTML(d.error || 'failed')}</td>
    </tr>`;
  }
  const color = d.score >= 70 ? 'var(--green)' : d.score >= 40 ? 'var(--amber)' : 'var(--red)';
  const contact = (d.emails && d.emails[0]) || (d.phones && d.phones[0]) || '<span style="color:var(--dim)">—</span>';
  const issues = (d.issues || []).slice(0, 2).join(' · ') || '<span style="color:var(--dim)">none</span>';
  return `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:8px 10px;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:${color}">${d.score}</td>
    <td style="padding:8px 10px;font-size:11px;word-break:break-all"><a href="${encodeURI(d.url)}" target="_blank" rel="noopener" style="color:var(--cyan)">${escapeHTML(d.host || d.url)}</a></td>
    <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${escapeHTML(d.platform || '—')}</td>
    <td style="padding:8px 10px;font-size:11px;color:var(--text)">${typeof contact === 'string' && contact.includes('@') ? '<a href="mailto:'+encodeURI(contact)+'" style="color:var(--cyan)">'+escapeHTML(contact)+'</a>' : contact}</td>
    <td style="padding:8px 10px;font-size:11px;color:var(--muted);max-width:340px">${escapeHTML(issues)}</td>
  </tr>`;
}

/* ════════════════════════════════════════════════════════════════
   ALWAYS-ON SCANNING AGENT
   - Persistent queue in localStorage (survives reload)
   - Worker polls every 30s while admin tab is open
   - Scans up to 5 URLs in parallel per tick
   - Auto-adds low-score prospects with extracted contacts
   ════════════════════════════════════════════════════════════════ */

let scanQueue = JSON.parse(localStorage.getItem('ss_scan_queue') || '[]');     // [{url, addedAt}]
let scanStats = JSON.parse(localStorage.getItem('ss_scan_stats') || '{"scanned":0,"prospectsAdded":0}');
let scanWorkerRunning = false;
let scanWorkerInterval = null;
const SCAN_CONCURRENCY = 5;
const SCAN_TICK_MS = 30_000;

function saveScanState() {
  localStorage.setItem('ss_scan_queue', JSON.stringify(scanQueue));
  localStorage.setItem('ss_scan_stats', JSON.stringify(scanStats));
}

function updateQueueStats() {
  const p = document.getElementById('queue-pending');
  const s = document.getElementById('queue-scanned');
  const a = document.getElementById('queue-prospects');
  if (p) p.textContent = scanQueue.length;
  if (s) s.textContent = scanStats.scanned || 0;
  if (a) a.textContent = scanStats.prospectsAdded || 0;
}

function setQueueStatus(msg, color) {
  const el = document.getElementById('queue-status');
  if (el) { el.textContent = msg || ''; el.style.color = color || 'var(--muted)'; }
}

async function tickScanWorker() {
  if (!scanWorkerRunning || !scanQueue.length) {
    setQueueStatus(scanWorkerRunning ? '· idle (queue empty)' : '');
    return;
  }
  const batch = scanQueue.splice(0, SCAN_CONCURRENCY);
  saveScanState();
  updateQueueStats();
  setQueueStatus('· scanning ' + batch.length + ' …', 'var(--cyan)');
  await Promise.all(batch.map(async item => {
    try {
      const r = await fetch('/.netlify/functions/analyze-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ url: item.url }),
      });
      const d = await r.json();
      scanStats.scanned = (scanStats.scanned || 0) + 1;
      if (d.ok && d.score < 70 && ((d.emails && d.emails[0]) || (d.phones && d.phones[0]))) {
        const existing = prospects.find(p => p.website && d.host && p.website.includes(d.host));
        if (!existing) {
          const bizGuess = (d.title || d.host || '').split(/[|·–-]/)[0].trim().slice(0, 80) || d.host;
          prospects.unshift({
            id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            bizname: bizGuess,
            name: '',
            email: (d.emails || [])[0] || '',
            type: 'Other',
            location: '',
            phone: (d.phones || [])[0] || '',
            notes: 'Auto-added by queue scanner. Score ' + d.score + ' · ' + d.platform + ' · ' + ((d.issues || []).slice(0, 2).join(' · ')),
            website: d.url,
            siteScore: d.score,
            sitePlatform: d.platform,
            siteIssues: d.issues || [],
            status: 'new',
            addedAt: new Date().toISOString(),
            source: 'queue-scanner',
          });
          scanStats.prospectsAdded = (scanStats.prospectsAdded || 0) + 1;
        }
      }
    } catch (e) {
      console.warn('[scan-worker]', item.url, e.message);
    }
  }));
  saveProspects();
  saveScanState();
  updateQueueStats();
  renderProspectsTable();
  setQueueStatus('· batch done', 'var(--green)');
}

function toggleScanWorker() {
  const btn = document.getElementById('queue-toggle');
  if (!scanWorkerRunning) {
    // If queue empty, prompt for URLs first — otherwise nothing visible happens
    if (!scanQueue.length) {
      const seed = confirm('Scan queue is empty. Paste URLs to start scanning?');
      if (!seed) {
        setQueueStatus('· nothing to scan — add URLs first', 'var(--amber)');
        return;
      }
      addUrlsToQueueModal();
      if (!scanQueue.length) return; // user cancelled paste
    }
    scanWorkerRunning = true;
    if (btn) { btn.textContent = '■ Stop scanner'; btn.style.background = 'var(--red)'; btn.style.color = '#fff'; }
    setQueueStatus('· running · first batch in 2s', 'var(--green)');
    // Fire first tick immediately (not after a 30s delay so user sees progress)
    setTimeout(tickScanWorker, 1500);
    scanWorkerInterval = setInterval(tickScanWorker, SCAN_TICK_MS);
  } else {
    scanWorkerRunning = false;
    if (btn) { btn.textContent = '▶ Start scanner'; btn.style.background = 'var(--green)'; btn.style.color = '#000'; }
    setQueueStatus('· stopped', 'var(--muted)');
    if (scanWorkerInterval) clearInterval(scanWorkerInterval);
  }
}

function addUrlsToQueueModal() {
  const raw = prompt('Paste URLs (one per line, with or without https://):');
  if (!raw) return;
  const urls = raw.split('\n').map(s => s.trim()).filter(Boolean)
    .map(u => /^https?:\/\//i.test(u) ? u : 'https://' + u);
  if (!urls.length) return;
  const existing = new Set(scanQueue.map(x => x.url));
  let added = 0;
  urls.forEach(u => { if (!existing.has(u)) { scanQueue.push({ url: u, addedAt: Date.now() }); added++; } });
  saveScanState();
  updateQueueStats();
  setQueueStatus('· +' + added + ' added (' + (urls.length - added) + ' dupes skipped)', 'var(--cyan)');
}

function seedQueueFromGoogle() {
  alert('Run the dork search at the top of this page, copy the URLs from the results, then click "Paste URLs" to feed them in. (Direct Google scraping is against their ToS — this manual flow keeps you compliant.)');
}

function clearScanQueue() {
  if (!scanQueue.length) return;
  if (!confirm('Clear ' + scanQueue.length + ' queued URLs?')) return;
  scanQueue = [];
  saveScanState();
  updateQueueStats();
}

/* ════════════════════════════════════════════════════════════════
   PROSPECTS COMMAND CENTER — sortable, filterable, bulk-actionable
   ════════════════════════════════════════════════════════════════ */

let prospectFilter = 'all';
let prospectSortKey = 'addedAt';
let prospectSortDir = 'desc';
let bulkSel = new Set();

function setProspectFilter(f) {
  prospectFilter = f;
  document.querySelectorAll('#filter-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderProspectsTable();
}

function sortProspects(k) {
  if (prospectSortKey === k) prospectSortDir = prospectSortDir === 'asc' ? 'desc' : 'asc';
  else { prospectSortKey = k; prospectSortDir = k === 'score' ? 'asc' : 'desc'; }
  renderProspectsTable();
}

function applyProspectFilter(list) {
  const q = (document.getElementById('outreach-search')?.value || '').toLowerCase();
  return list.filter(p => {
    if (q && !((p.bizname || '') + ' ' + (p.email || '') + ' ' + (p.location || '')).toLowerCase().includes(q)) return false;
    if (prospectFilter === 'all') return true;
    if (prospectFilter === 'new') return p.status === 'new' || !p.status;
    if (prospectFilter === 'sent') return p.status === 'sent';
    if (prospectFilter === 'replied') return p.status === 'replied';
    if (prospectFilter === 'converted') return p.status === 'converted';
    if (prospectFilter === 'dead') return p.status === 'dead';
    if (prospectFilter === 'lowscore') return (p.siteScore != null) && p.siteScore < 40;
    if (prospectFilter === 'hasemail') return !!p.email;
    return true;
  });
}

function applyProspectSort(list) {
  const k = prospectSortKey, dir = prospectSortDir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let av = a[k], bv = b[k];
    if (k === 'score') { av = a.siteScore ?? 999; bv = b.siteScore ?? 999; }
    if (k === 'platform') { av = a.sitePlatform || ''; bv = b.sitePlatform || ''; }
    if (k === 'addedAt') { av = new Date(av || 0).getTime(); bv = new Date(bv || 0).getTime(); }
    if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });
}

function renderProspectsTable() {
  const tbody = document.getElementById('prospects-tbody');
  const empty = document.getElementById('prospects-empty');
  if (!tbody) return;
  // Update stat-card numbers at top
  setT('os-total', prospects.length);
  setT('os-new', prospects.filter(p => p.status === 'new' || !p.status).length);
  setT('os-sent', prospects.filter(p => p.status === 'sent').length);
  setT('os-replied', prospects.filter(p => p.status === 'replied').length);
  setT('os-converted', prospects.filter(p => p.status === 'converted').length);
  const filtered = applyProspectSort(applyProspectFilter(prospects));
  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    refreshBulkBar();
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = filtered.map((p, i) => {
    const score = p.siteScore;
    const scoreColor = score == null ? 'var(--dim)' : score < 40 ? 'var(--red)' : score < 70 ? 'var(--amber)' : 'var(--green)';
    const statusColor = { new:'var(--cyan)', sent:'var(--amber)', replied:'var(--purple)', converted:'var(--green)', dead:'var(--dim)' }[p.status || 'new'] || 'var(--muted)';
    const checked = bulkSel.has(p.id) ? 'checked' : '';
    const verified = p.emailVerified === true ? ' <span title="MX verified" style="color:var(--green)">✓</span>' : p.emailVerified === false ? ' <span title="MX failed" style="color:var(--red)">✗</span>' : '';
    const idAttr = escapeHTML(p.id);
    return `<tr style="border-bottom:1px solid var(--border)" class="prospect-row${bulkSel.has(p.id) ? ' selected' : ''}">
      <td style="padding:10px 12px"><input type="checkbox" data-pid="${idAttr}" ${checked} onclick="toggleBulkSel('${idAttr}', this.checked)"></td>
      <td style="padding:10px 8px;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:${scoreColor}">${score ?? '—'}</td>
      <td style="padding:10px 8px">
        <div style="font-weight:600;font-size:13px;color:var(--text);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(p.bizname || p.name || 'Unknown')}</div>
        <div style="font-size:11px;color:var(--muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.website ? '<a href="'+encodeURI(p.website)+'" target="_blank" rel="noopener" style="color:var(--cyan)">'+escapeHTML(p.website.replace(/^https?:\/\//,''))+' ↗</a>' : '<span style="color:var(--dim)">no site</span>'}</div>
      </td>
      <td style="padding:10px 8px">
        <div style="font-size:12px">${p.email ? '<a href="mailto:'+encodeURI(p.email)+'" style="color:var(--cyan)">'+escapeHTML(p.email)+'</a>'+verified : '<span style="color:var(--dim)">—</span>'}</div>
        <div style="font-size:11px;color:var(--muted)">${p.phone ? '<a href="tel:'+encodeURI(p.phone.replace(/\s+/g,''))+'" style="color:var(--text)">'+escapeHTML(p.phone)+'</a>' : ''}</div>
      </td>
      <td style="padding:10px 8px;font-size:11px;color:var(--muted)">${escapeHTML(p.sitePlatform || '—')}</td>
      <td style="padding:10px 8px"><span style="display:inline-block;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,.04);color:${statusColor};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${escapeHTML(p.status || 'new')}</span></td>
      <td style="padding:10px 8px;font-size:11px;color:var(--dim);font-family:'DM Mono',monospace">${p.addedAt ? timeAgo(p.addedAt) : '—'}</td>
      <td style="padding:10px 8px;white-space:nowrap">
        <button onclick="prefillTemplateFor('${idAttr}')" title="Generate outreach template" style="background:var(--cyan);color:var(--ink);border:0;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:4px">✉ Template</button>
        <button onclick="verifyOneEmail('${idAttr}')" title="Verify email via MX lookup" style="background:var(--surface2);color:var(--purple);border:1px solid var(--border);padding:5px 9px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:4px">✓ Verify</button>
        <button onclick="deleteOneProspect('${idAttr}')" title="Delete" style="background:rgba(239,68,68,.08);color:var(--red);border:1px solid rgba(239,68,68,.2);padding:5px 9px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">×</button>
      </td>
    </tr>`;
  }).join('');
  refreshBulkBar();
}

function toggleBulkSel(id, on) {
  if (on) bulkSel.add(id); else bulkSel.delete(id);
  refreshBulkBar();
}
function toggleAllBulk(checkbox) {
  if (checkbox.checked) {
    applyProspectFilter(prospects).forEach(p => bulkSel.add(p.id));
  } else bulkSel.clear();
  renderProspectsTable();
}
function refreshBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const c = document.getElementById('bulk-count');
  if (!bar) return;
  if (bulkSel.size > 0) { bar.style.display = 'flex'; if (c) c.textContent = bulkSel.size + ' selected'; }
  else { bar.style.display = 'none'; }
}
function selectedProspects() { return prospects.filter(p => bulkSel.has(p.id)); }

function bulkSetStatus(status) {
  const ps = selectedProspects();
  if (!ps.length) return;
  if (!confirm('Set ' + ps.length + ' prospects to "' + status + '"?')) return;
  const ts = new Date().toISOString();
  ps.forEach(p => { p.status = status; p.lastUpdatedAt = ts; if (status === 'replied') p.firstReplyAt = ts; });
  saveProspects(); renderProspectsTable();
}
function bulkMarkSent() {
  const ps = selectedProspects(); if (!ps.length) return;
  const ts = new Date().toISOString();
  ps.forEach(p => {
    p.status = 'sent'; p.lastContacted = ts;
    if (!Array.isArray(p.emailHistory)) p.emailHistory = [];
    p.emailHistory.push({ template: 'bulk-mark', sentAt: ts, via: 'bulk' });
  });
  saveProspects(); renderProspectsTable();
}
function bulkDelete() {
  const ps = selectedProspects(); if (!ps.length) return;
  if (!confirm('PERMANENTLY delete ' + ps.length + ' prospects? Cannot be undone.')) return;
  prospects = prospects.filter(p => !bulkSel.has(p.id));
  bulkSel.clear(); saveProspects(); renderProspectsTable();
}
function bulkExportCSV() {
  const ps = selectedProspects().length ? selectedProspects() : applyProspectFilter(prospects);
  if (!ps.length) { alert('Nothing to export.'); return; }
  const head = ['BizName','Email','Phone','Website','Score','Platform','Status','Issues','AddedAt'];
  const rows = ps.map(p => [
    p.bizname || p.name || '',
    p.email || '',
    p.phone || '',
    p.website || '',
    p.siteScore ?? '',
    p.sitePlatform || '',
    p.status || 'new',
    (p.siteIssues || []).join(' | '),
    p.addedAt || '',
  ]);
  const csv = [head].concat(rows).map(r => r.map(v => {
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? '"' + s + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'staticswift-prospects-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function bulkGenerateTemplate() {
  const ps = selectedProspects();
  if (!ps.length) { alert('Select prospects first.'); return; }
  const tmplKey = prompt('Template key? (cold-observation / cold-light / followup-1 / followup-2 / post-analysis)', 'cold-observation');
  if (!tmplKey || !TEMPLATES[tmplKey]) { alert('Invalid template key.'); return; }
  const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => ({
    biz: p.bizname || p.name || '[business]',
    nameOrThere: p.name?.split(' ')[0] || 'there',
    type: p.type || 'business',
    location: p.location || 'your area',
    website: p.website || '[their site URL]',
    observation: (p.siteIssues && p.siteIssues[0]) || (p.notes || '').slice(0, 120) || 'it could be sharper and load faster',
    issuesBullets: (p.siteIssues && p.siteIssues.length) ? p.siteIssues.slice(0, 3).map(i => '  • ' + i).join('\n') : '  • Slow load · dated mobile · not ranking',
  })[k] ?? '');
  const out = ps.map(p => {
    const t = TEMPLATES[tmplKey];
    return `=== ${p.bizname || p.email || 'Prospect'} ===\nTO: ${p.email || '(no email)'}\nSUBJECT: ${fill(t.subject, p)}\n\n${fill(t.body, p)}${SENDER_FOOTER}\n\n`;
  }).join('\n');
  navigator.clipboard.writeText(out).then(() => alert('Copied ' + ps.length + ' templates to clipboard.\n\nOpen Gmail and paste — review each, send manually.'));
}
async function bulkVerifyEmails() {
  const ps = selectedProspects().filter(p => p.email);
  if (!ps.length) { alert('Select prospects with emails first.'); return; }
  setQueueStatus('· verifying ' + ps.length + ' emails…', 'var(--purple)');
  for (const p of ps) {
    try {
      const r = await fetch('/.netlify/functions/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ email: p.email }),
      });
      const d = await r.json();
      p.emailVerified = !!d.ok;
      p.emailVerifyDetail = d.detail || '';
    } catch (e) { p.emailVerified = false; p.emailVerifyDetail = e.message; }
  }
  saveProspects(); renderProspectsTable();
  setQueueStatus('· verify complete', 'var(--green)');
}
async function verifyOneEmail(id) {
  const p = prospects.find(x => x.id === id);
  if (!p || !p.email) return;
  try {
    const r = await fetch('/.netlify/functions/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ email: p.email }),
    });
    const d = await r.json();
    p.emailVerified = !!d.ok; p.emailVerifyDetail = d.detail || '';
    saveProspects(); renderProspectsTable();
  } catch(e) { alert('Verify failed: ' + e.message); }
}
function deleteOneProspect(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Delete ' + (p.bizname || 'prospect') + '?')) return;
  prospects = prospects.filter(x => x.id !== id);
  bulkSel.delete(id);
  saveProspects(); renderProspectsTable();
}
function prefillTemplateFor(id) {
  const idx = prospects.findIndex(p => p.id === id);
  if (idx < 0) return;
  refreshProspectDropdown();
  const sel = document.getElementById('tmpl-prospect');
  if (sel) sel.value = String(idx);
  document.getElementById('tmpl-pick').value = 'post-analysis';
  generateTemplate();
  document.getElementById('tmpl-result')?.scrollIntoView({ behavior: 'smooth' });
}

function setT(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

// Hook table render into existing renderProspects so legacy callers also refresh table
const _origRender = window.renderProspects;
window.renderProspects = function() {
  if (typeof _origRender === 'function') { try { _origRender(); } catch(e){} }
  renderProspectsTable();
};

// Init on first outreach view
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { updateQueueStats(); renderProspectsTable(); }, 500);
});

/* ════════════════════════════════════════════════════════════════
   UI PACK — saved views, keyboard nav, inline edit, activity log,
   mobile-responsive, bigger verify badges.
   ════════════════════════════════════════════════════════════════ */

/* ---- SAVED VIEWS ---- */
let savedViews = JSON.parse(localStorage.getItem('ss_saved_views') || '[]');
function saveSavedViews() { localStorage.setItem('ss_saved_views', JSON.stringify(savedViews)); }

function saveCurrentView() {
  const name = prompt('Name this view (e.g. "Wix barbers under 40 score"):');
  if (!name) return;
  const search = (document.getElementById('outreach-search')?.value || '').trim();
  savedViews.push({ id: 'sv-' + Date.now(), name, filter: prospectFilter, search, sortKey: prospectSortKey, sortDir: prospectSortDir });
  saveSavedViews();
  renderSavedViews();
}
function applySavedView(id) {
  const v = savedViews.find(x => x.id === id);
  if (!v) return;
  prospectFilter = v.filter;
  prospectSortKey = v.sortKey;
  prospectSortDir = v.sortDir;
  document.querySelectorAll('#filter-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.f === v.filter));
  const s = document.getElementById('outreach-search'); if (s) s.value = v.search || '';
  renderProspectsTable();
}
function deleteSavedView(id) {
  if (!confirm('Delete this view?')) return;
  savedViews = savedViews.filter(v => v.id !== id);
  saveSavedViews(); renderSavedViews();
}
function renderSavedViews() {
  const c = document.getElementById('saved-views-container');
  if (!c) return;
  if (!savedViews.length) { c.innerHTML = '<span style="font-size:11px;color:var(--dim)">No saved views yet — set filters then click "Save view"</span>'; return; }
  c.innerHTML = savedViews.map(v =>
    `<button onclick="applySavedView('${v.id}')" class="saved-view-pill">⭐ ${escapeHTML(v.name)}<span onclick="event.stopPropagation();deleteSavedView('${v.id}')" style="margin-left:6px;cursor:pointer;opacity:.5">×</span></button>`
  ).join('');
}

/* ---- KEYBOARD NAV ---- */
let kbdFocusedIdx = -1;
function getKbdRows() {
  return Array.from(document.querySelectorAll('#prospects-tbody tr'));
}
function highlightKbdRow() {
  const rows = getKbdRows();
  rows.forEach((r, i) => r.classList.toggle('kbd-focus', i === kbdFocusedIdx));
  const row = rows[kbdFocusedIdx];
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function getFocusedProspectId() {
  const row = getKbdRows()[kbdFocusedIdx];
  if (!row) return null;
  const cb = row.querySelector('input[type=checkbox][data-pid]');
  return cb?.dataset?.pid || null;
}

document.addEventListener('keydown', (e) => {
  // Only when outreach tab is visible and not typing in an input
  const onOutreach = document.getElementById('page-outreach')?.classList.contains('active');
  if (!onOutreach) return;
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  const rows = getKbdRows();
  if (!rows.length) return;
  const id = getFocusedProspectId();
  switch (e.key.toLowerCase()) {
    case 'j': kbdFocusedIdx = Math.min(rows.length - 1, kbdFocusedIdx + 1); highlightKbdRow(); e.preventDefault(); break;
    case 'k': kbdFocusedIdx = Math.max(0, kbdFocusedIdx - 1); highlightKbdRow(); e.preventDefault(); break;
    case 'e': if (id) { const p = prospects.find(x => x.id === id); if (p?.email) window.open('mailto:' + p.email); } break;
    case 'v': if (id) verifyOneEmail(id); break;
    case 't': if (id) prefillTemplateFor(id); break;
    case 'x': if (id) deleteOneProspect(id); break;
    case ' ': if (id) { const cb = rows[kbdFocusedIdx].querySelector('input[type=checkbox][data-pid]'); if (cb) { cb.checked = !cb.checked; toggleBulkSel(id, cb.checked); } e.preventDefault(); } break;
  }
});

/* ---- INLINE EDIT ---- */
function startInlineEdit(id, field, el) {
  const p = prospects.find(x => x.id === id); if (!p) return;
  const current = p[field] || '';
  const input = document.createElement('input');
  input.type = field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text';
  input.value = current;
  input.style.cssText = 'background:var(--dark3);border:1.5px solid var(--cyan);color:var(--text);padding:4px 6px;border-radius:4px;font-size:12px;width:100%;outline:none;font-family:inherit';
  const commit = () => {
    p[field] = input.value.trim();
    p.lastUpdatedAt = new Date().toISOString();
    saveProspects(); renderProspectsTable();
  };
  const cancel = () => { renderProspectsTable(); };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
  });
  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
  input.select();
}

/* ---- ACTIVITY LOG (per-prospect expandable row) ---- */
let expandedRowId = null;
function toggleProspectExpand(id) {
  expandedRowId = (expandedRowId === id) ? null : id;
  renderProspectsTable();
}
function renderActivityLog(p) {
  const events = [];
  if (p.addedAt) events.push({ ts: p.addedAt, icon: '+', kind: 'Added', detail: 'via ' + (p.source || 'manual') });
  if (p.siteScore != null) events.push({ ts: p.addedAt, icon: '🔍', kind: 'Site scanned', detail: 'Score ' + p.siteScore + ' · ' + (p.sitePlatform || 'unknown') });
  if (p.emailVerified === true) events.push({ ts: p.lastUpdatedAt || p.addedAt, icon: '✓', kind: 'Email verified', detail: p.emailVerifyDetail || 'MX OK' });
  if (p.emailVerified === false) events.push({ ts: p.lastUpdatedAt || p.addedAt, icon: '✗', kind: 'Email failed verify', detail: p.emailVerifyDetail || 'No MX' });
  (p.emailHistory || []).forEach(e => events.push({ ts: e.sentAt, icon: '✉', kind: 'Email sent', detail: e.template + ' · via ' + (e.via || 'mailto') }));
  (p.openHistory || []).forEach(e => events.push({ ts: e.openedAt, icon: '👁', kind: 'Email opened', detail: 'IP: ' + (e.ip || '?') }));
  if (p.firstReplyAt) events.push({ ts: p.firstReplyAt, icon: '💬', kind: 'Replied', detail: p.replyCategory || '' });
  if (p.convertedAt) events.push({ ts: p.convertedAt, icon: '🎉', kind: 'Converted to client', detail: '' });
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!events.length) return '<div style="color:var(--dim);font-size:11px;padding:14px">No activity yet.</div>';
  return '<div style="display:flex;flex-direction:column;gap:8px;padding:16px 20px;background:rgba(0,0,0,.18);border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:12px">' +
    events.map(e => `
      <div style="display:flex;align-items:flex-start;gap:10px">
        <span style="width:24px;text-align:center;font-size:14px">${e.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;color:var(--text)">${escapeHTML(e.kind)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${escapeHTML(e.detail || '')}</div>
        </div>
        <span style="font-size:10px;color:var(--dim);font-family:'DM Mono',monospace">${e.ts ? new Date(e.ts).toLocaleString('en-GB') : ''}</span>
      </div>`).join('') + '</div>';
}

/* ---- BIGGER VERIFY BADGES (override existing tiny ✓/✗) ---- */
function verifyBadgeHTML(p) {
  if (p.emailVerified === true) {
    const kind = (p.emailVerifyDetail || '').includes('Role') ? 'role' : 'personal';
    return kind === 'role'
      ? '<span class="verify-pill v-role" title="Role address — works but generic">⚠ role</span>'
      : '<span class="verify-pill v-deliverable" title="MX-verified">✓ deliverable</span>';
  }
  if (p.emailVerified === false) {
    return '<span class="verify-pill v-bad" title="' + escapeHTML(p.emailVerifyDetail || 'No MX') + '">✗ no MX</span>';
  }
  return '';
}

/* Inject saved-views bar above the table + replace renderProspectsTable with
   one that uses the bigger badges, supports inline edit, and shows activity log. */
(function injectSavedViewsBar() {
  const filterPills = document.getElementById('filter-pills');
  if (!filterPills) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'padding:8px 16px;border-bottom:1px solid var(--border);background:var(--dark2);display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  bar.innerHTML = '<button onclick="saveCurrentView()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:5px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">+ Save view</button><span id="saved-views-container" style="display:flex;flex-wrap:wrap;gap:5px"></span>';
  filterPills.closest('div[style*="padding:14px 16px"]').after(bar);
  renderSavedViews();
})();

/* Override renderProspectsTable to use the new badges + clickable expand + inline edit hooks */
const _origRenderProspectsTable = window.renderProspectsTable;
window.renderProspectsTable = function() {
  if (typeof _origRenderProspectsTable === 'function') _origRenderProspectsTable();
  // Decorate each row: replace ✓/✗ inline with pills, add expand on biz-name click
  document.querySelectorAll('#prospects-tbody tr').forEach((row, i) => {
    const cb = row.querySelector('input[type=checkbox][data-pid]');
    if (!cb) return;
    const id = cb.dataset.pid;
    const p = prospects.find(x => x.id === id);
    if (!p) return;
    // Bigger verify badge
    const emailTd = row.cells[3];
    if (emailTd && p.email) {
      const small = emailTd.querySelector('span[title]');
      if (small) small.outerHTML = verifyBadgeHTML(p);
      else if (!emailTd.innerHTML.includes('verify-pill')) {
        const link = emailTd.querySelector('a[href^="mailto"]');
        if (link) link.insertAdjacentHTML('afterend', ' ' + verifyBadgeHTML(p));
      }
    }
    // Inline edit on email cell (double-click)
    if (emailTd) emailTd.title = 'Double-click to edit';
    if (emailTd) emailTd.addEventListener('dblclick', () => {
      const inner = emailTd.querySelector('div');
      if (inner) startInlineEdit(id, 'email', inner);
    });
    // Inline edit on biz-name (double-click)
    const bizTd = row.cells[2];
    if (bizTd) {
      bizTd.title = 'Double-click name to edit · Single-click row to expand';
      bizTd.addEventListener('dblclick', (e) => {
        if (e.target.closest('a')) return; // don't capture link clicks
        const inner = bizTd.querySelector('div');
        if (inner) startInlineEdit(id, 'bizname', inner);
      });
    }
    // Single-click row to expand activity log
    row.addEventListener('click', (e) => {
      if (e.target.closest('input, button, a, td.bulk-cell')) return;
      toggleProspectExpand(id);
    });
    // Append activity-log row if expanded
    if (expandedRowId === id) {
      const log = document.createElement('tr');
      log.className = 'activity-log-row';
      log.innerHTML = '<td colspan="8" style="padding:0">' + renderActivityLog(p) + '</td>';
      row.after(log);
    }
  });
};

/* ════════════════════════════════════════════════════════════════
   SEQUENCE BUILDER — auto-queues follow-ups at +5d / +12d / +20d
   - Stores per-prospect sequence schedule
   - "Due today" tray surfaces what to send right now
   - Auto-stops sequences when status flips to replied/converted/dead
   ════════════════════════════════════════════════════════════════ */

const SEQUENCE_STEPS = [
  { day: 0,  tmpl: 'cold-observation', label: 'Cold open' },
  { day: 5,  tmpl: 'followup-1',       label: 'Follow-up 1' },
  { day: 12, tmpl: 'followup-2',       label: 'Follow-up 2 (last)' },
];

function startSequenceFor(prospectId) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  const now = Date.now();
  p.sequence = SEQUENCE_STEPS.map(step => ({
    tmpl: step.tmpl,
    label: step.label,
    dueAt: new Date(now + step.day * 86400000).toISOString(),
    sentAt: null,
  }));
  p.sequenceStartedAt = new Date().toISOString();
  saveProspects();
  renderProspectsTable();
  renderSequenceTray();
}

function stopSequenceFor(prospectId, reason) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  p.sequence = null;
  p.sequenceStoppedAt = new Date().toISOString();
  p.sequenceStopReason = reason || 'manual';
  saveProspects();
  renderSequenceTray();
}

function getDueSequenceSteps() {
  const now = Date.now();
  const due = [];
  prospects.forEach(p => {
    if (!Array.isArray(p.sequence)) return;
    // Auto-stop on terminal states
    if (['replied','converted','dead'].includes(p.status)) {
      if (!p.sequenceStoppedAt) {
        p.sequence = null;
        p.sequenceStoppedAt = new Date().toISOString();
        p.sequenceStopReason = 'status-' + p.status;
      }
      return;
    }
    p.sequence.forEach((step, i) => {
      if (!step.sentAt && new Date(step.dueAt).getTime() <= now) {
        due.push({ prospectId: p.id, stepIndex: i, step, prospect: p });
      }
    });
  });
  return due;
}

function renderSequenceTray() {
  const tray = document.getElementById('sequence-tray');
  if (!tray) return;
  const due = getDueSequenceSteps();
  if (!due.length) {
    tray.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:13px">No follow-ups due. Start a sequence on any prospect to begin.</div>';
    return;
  }
  tray.innerHTML = `
    <div style="padding:10px 14px;background:rgba(245,158,11,.08);border-bottom:1px solid var(--border);font-size:12px;font-weight:600;color:var(--amber);font-family:'DM Mono',monospace">
      ⏰ ${due.length} follow-up${due.length === 1 ? '' : 's'} due now
    </div>
    <div style="max-height:340px;overflow-y:auto">
      ${due.map(item => `
        <div style="padding:11px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;font-size:12px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--text);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(item.prospect.bizname || 'Unknown')}</div>
            <div style="font-size:11px;color:var(--muted)">${escapeHTML(item.step.label)} · due ${timeAgo(item.step.dueAt)}</div>
          </div>
          <button onclick="generateAndOpenSequenceStep('${item.prospectId}', ${item.stepIndex})" style="background:var(--cyan);color:var(--ink);border:0;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Send →</button>
          <button onclick="markSequenceStepSent('${item.prospectId}', ${item.stepIndex})" title="Mark sent (skip composer)" style="background:var(--surface2);color:var(--muted);border:1px solid var(--border);padding:6px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">✓</button>
        </div>
      `).join('')}
    </div>`;
}

function generateAndOpenSequenceStep(prospectId, stepIndex) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  const step = p.sequence[stepIndex];
  if (!step) return;
  refreshProspectDropdown();
  const idx = prospects.findIndex(x => x.id === prospectId);
  document.getElementById('tmpl-prospect').value = String(idx);
  document.getElementById('tmpl-pick').value = step.tmpl;
  generateTemplate();
  // Mark sent on the link's click to be safe
  const link = document.getElementById('tmpl-mailto');
  if (link) {
    link.addEventListener('click', () => markSequenceStepSent(prospectId, stepIndex), { once: true });
  }
  document.getElementById('tmpl-result')?.scrollIntoView({ behavior: 'smooth' });
}

function markSequenceStepSent(prospectId, stepIndex) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p || !p.sequence?.[stepIndex]) return;
  p.sequence[stepIndex].sentAt = new Date().toISOString();
  p.status = 'sent';
  p.lastContacted = new Date().toISOString();
  if (!Array.isArray(p.emailHistory)) p.emailHistory = [];
  p.emailHistory.push({ template: p.sequence[stepIndex].tmpl, sentAt: p.sequence[stepIndex].sentAt, via: 'sequence' });
  saveProspects(); renderProspectsTable(); renderSequenceTray();
}

// Tray auto-refresh every minute
setInterval(renderSequenceTray, 60000);

/* ════════════════════════════════════════════════════════════════
   EMAIL TEST — calls test-email function, shows full diagnostic
   ════════════════════════════════════════════════════════════════ */
async function runEmailTest() {
  const btn = document.getElementById('email-test-btn');
  const out = document.getElementById('email-test-result');
  if (!btn || !out) return;
  const to = prompt('Send test email to which address?', 'hello@staticswift.co.uk');
  if (!to) return;
  btn.disabled = true; btn.textContent = 'Testing…';
  out.style.display = 'block';
  out.textContent = 'Checking env vars → connecting to SMTP → sending test email…';
  out.style.color = 'var(--muted)';
  try {
    const r = await fetch('/.netlify/functions/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ to }),
    });
    const d = await r.json();
    if (d.ok) {
      out.style.color = 'var(--green)';
      out.textContent = '✓ EMAIL SENT\n\nMessageId: ' + (d.messageId || '?') + '\nResponse: ' + (d.response || '') + '\n\nCheck ' + to + ' inbox (and spam).\n\n--- ENV ---\n' + Object.entries(d.env || {}).map(([k,v]) => k + ': ' + v).join('\n');
    } else {
      out.style.color = 'var(--red)';
      let txt = '✗ FAILED at stage: ' + (d.stage || '?') + '\n\n' + (d.error || 'Unknown') + '\n\n--- ENV ---\n' + Object.entries(d.env || {}).map(([k,v]) => k + ': ' + v).join('\n');
      if (Array.isArray(d.howToFix)) txt += '\n\n--- HOW TO FIX ---\n' + d.howToFix.map((s,i) => (i+1) + '. ' + s).join('\n');
      out.textContent = txt;
    }
  } catch (err) {
    out.style.color = 'var(--red)';
    out.textContent = '✗ Network/parse error: ' + err.message + '\n\n(test-email function may not have deployed yet — push code, wait for Netlify build, then retry.)';
  } finally {
    btn.disabled = false; btn.textContent = 'Send test email';
  }
}

/* ════════════════════════════════════════════════════════════════
   NICHE-AWARE DORKS — auto-generate trade+location search queries
   ════════════════════════════════════════════════════════════════ */
function generateNicheDorks(niche, town) {
  niche = niche || 'plumber'; town = town || 'Edinburgh';
  return [
    { label: 'No website (Facebook only)', q: `"${niche}" "${town}" site:facebook.com` },
    { label: 'Outdated Wix sites',          q: `"${niche}" "${town}" site:wixsite.com -inurl:admin` },
    { label: 'Old GoDaddy builder sites',   q: `"${niche}" "${town}" inurl:godaddysites.com OR inurl:weebly.com` },
    { label: 'WordPress (often abandoned)', q: `"${niche}" "${town}" inurl:wp-content -inurl:wp-admin` },
    { label: 'Yelp / Yell listings (no own site)', q: `"${niche}" "${town}" (site:yell.com OR site:yelp.co.uk OR site:checkatrade.com)` },
    { label: 'Google Maps listings',        q: `"${niche}" "${town}"` + ' "Google Maps"' },
    { label: 'Contact pages (email finder)',q: `"${niche}" "${town}" "contact us" "@" -site:facebook.com` },
    { label: 'Mobile-broken indicators',    q: `"${niche}" "${town}" "best viewed in" OR "©20" -site:facebook.com` },
    { label: 'Sole-trader profiles',        q: `"${niche}" "${town}" "sole trader" OR "self-employed"` },
    { label: 'Companies House (limited co)',q: `"${niche}" "${town}" site:find-and-update.company-information.service.gov.uk` },
  ];
}

// Replace the existing dork renderer if it exists, otherwise add one
window.renderDorkPicker = function() {
  const grid = document.getElementById('dork-grid');
  if (!grid) return;
  const niche = document.getElementById('dork-niche')?.value || 'plumber';
  const town  = document.getElementById('dork-town')?.value || 'Edinburgh';
  const dorks = generateNicheDorks(niche, town);
  grid.innerHTML = dorks.map(d => {
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(d.q);
    return `<div class="dork-card">
      <div class="dork-lbl">${escapeHTML(d.label)}</div>
      <div class="dork-q">${escapeHTML(d.q)}</div>
      <a class="dork-go" href="${url}" target="_blank" rel="noopener">Open in Google ↗</a>
    </div>`;
  }).join('');
};
// Re-render on niche/town change
['dork-niche','dork-town'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', renderDorkPicker);
  if (el) el.addEventListener('input', renderDorkPicker);
});
setTimeout(() => { try { renderDorkPicker(); } catch(e) {} }, 200);

/* ════════════════════════════════════════════════════════════════
   SERVER-SIDE QUEUE SYNC + OPEN-RATE DISPLAY + AI REPLY CLASSIFY
   ════════════════════════════════════════════════════════════════ */

// Push local scan queue → server every time it changes, so the
// scheduled cron-scan function can pick up where the browser left off.
async function syncQueueToServer() {
  try {
    await fetch('/.netlify/functions/sync-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ scanQueue }),
    });
  } catch (e) { /* offline-tolerant */ }
}
// Wrap saveScanState so every state change syncs (debounced)
let _queueSyncT = null;
const _origSaveScan = saveScanState;
window.saveScanState = function() {
  _origSaveScan();
  clearTimeout(_queueSyncT);
  _queueSyncT = setTimeout(syncQueueToServer, 1500);
};

// Pull open counts from server every 60s and render badge in table
async function refreshOpens() {
  try {
    const r = await fetch('/.netlify/functions/get-opens', {
      headers: { 'x-admin-password': ADMIN_PW },
    });
    if (!r.ok) return;
    const d = await r.json();
    if (!d.ok) return;
    let changed = false;
    prospects.forEach(p => {
      const opens = d.opens[p.id];
      if (Array.isArray(opens) && opens.length) {
        if (!Array.isArray(p.openHistory) || p.openHistory.length !== opens.length) {
          p.openHistory = opens;
          changed = true;
        }
      }
    });
    if (changed) { saveProspects(); renderProspectsTable(); }
  } catch (e) {}
}
setInterval(refreshOpens, 60_000);
setTimeout(refreshOpens, 4000);

// Reply classifier — pasted into a prompt
async function classifyReplyFor(prospectId) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  const text = prompt('Paste the reply text to categorize:');
  if (!text) return;
  try {
    const r = await fetch('/.netlify/functions/categorize-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ text }),
    });
    const d = await r.json();
    p.replyCategory = d.category;
    p.replyReason = d.reason;
    p.replySuggestion = d.suggestion;
    p.replyText = text.slice(0, 4000);
    p.firstReplyAt = p.firstReplyAt || new Date().toISOString();
    // Auto-set status from category
    if (d.category === 'unsubscribe' || d.category === 'not-interested') p.status = 'dead';
    else if (d.category === 'interested') p.status = 'replied';
    saveProspects(); renderProspectsTable();
    alert('Categorized: ' + d.category.toUpperCase() + '\n\n' + d.suggestion + '\n\n(' + d.mode + ' mode)');
  } catch (err) {
    alert('Classify failed: ' + err.message);
  }
}

/* ════════════════════════════════════════════════════════════════
   AUTO-DISCOVER AGENT — OpenStreetMap Overpass API
   ════════════════════════════════════════════════════════════════ */
async function runDiscover() {
  const btn = document.getElementById('disc-btn');
  const out = document.getElementById('disc-result');
  if (!btn || !out) return;
  const niche = document.getElementById('disc-niche').value;
  const area = document.getElementById('disc-area').value.trim();
  const country = document.getElementById('disc-country').value;
  if (!area) { alert('Enter an area first.'); return; }
  btn.disabled = true; btn.textContent = 'Pulling…';
  out.style.display = 'block';
  out.style.color = 'var(--muted)';
  out.innerHTML = 'Querying OpenStreetMap for ' + niche + ' businesses in ' + area + '…';
  try {
    const r = await fetch('/.netlify/functions/discover-prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ niche, area, country }),
    });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || 'Failed');
    // Refresh the local queue from the server (since the function updated db.scanQueue)
    try {
      const qr = await fetch('/.netlify/functions/get-queue', { headers: { 'x-admin-password': ADMIN_PW } });
      if (qr.ok) {
        const qd = await qr.json();
        if (qd.ok && Array.isArray(qd.scanQueue)) {
          scanQueue = qd.scanQueue;
          saveScanState();
          updateQueueStats();
        }
      }
    } catch {}
    out.style.color = 'var(--green)';
    out.innerHTML = `
      <div style="font-weight:700;color:var(--green);margin-bottom:8px">✓ Found ${d.found} businesses · Added ${d.addedToQueue} to scan queue</div>
      <div style="color:var(--muted);margin-bottom:10px">Queue size: ${d.queueSize}. Cron-scan picks these up every 15 min, or hit Start scanner above for immediate processing.</div>
      <div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Sample</div>
      <div style="display:grid;gap:4px;font-size:11px">${(d.sample || []).map(b =>
        '<div style="padding:6px 10px;background:var(--dark);border:1px solid var(--border);border-radius:5px">' +
        '<span style="color:var(--text);font-weight:600">' + escapeHTML(b.name || b.host) + '</span> · ' +
        '<a href="' + encodeURI(b.website) + '" target="_blank" rel="noopener" style="color:var(--cyan)">' + escapeHTML(b.host) + ' ↗</a>' +
        (b.phone ? ' · <span style="color:var(--muted)">' + escapeHTML(b.phone) + '</span>' : '') +
        '</div>').join('')}</div>`;
  } catch (err) {
    out.style.color = 'var(--red)';
    out.textContent = '✗ ' + err.message + '\n\n(OSM Overpass occasionally times out under load — retry in 30s, or try a smaller area.)';
  } finally {
    btn.disabled = false; btn.textContent = '🔎 Pull from OSM →';
  }
}

/* ════════════════════════════════════════════════════════════════
   CLICKABILITY GUARDS — every new function gets explicit window
   binding so onclick=" " always resolves, regardless of script
   loader behaviour or any future bundling.
   ════════════════════════════════════════════════════════════════ */
[
  // Auto-discover
  'runDiscover',
  // Email tester
  'runEmailTest',
  // Sequence builder
  'startSequenceFor','stopSequenceFor','generateAndOpenSequenceStep','markSequenceStepSent','renderSequenceTray',
  // Scanner / queue
  'toggleScanWorker','seedQueueFromGoogle','addUrlsToQueueModal','clearScanQueue','runBatchScan','stopBatchScan','tickScanWorker',
  // Site analyzer
  'runAnalyze','addProspectFromAnalysis',
  // Templates
  'generateTemplate','copyTmpl','markProspectSent','refreshProspectDropdown','prefillTemplateFor',
  // Prospects command center
  'setProspectFilter','sortProspects','toggleBulkSel','toggleAllBulk','renderProspectsTable',
  'bulkSetStatus','bulkMarkSent','bulkDelete','bulkExportCSV','bulkGenerateTemplate','bulkVerifyEmails',
  'verifyOneEmail','deleteOneProspect',
  // UI pack
  'saveCurrentView','applySavedView','deleteSavedView','renderSavedViews','startInlineEdit','toggleProspectExpand',
  // Reply categorizer
  'classifyReplyFor',
  // Dorks
  'renderDorkPicker',
].forEach(fn => {
  if (typeof window !== 'undefined' && typeof eval(fn) === 'function') {
    window[fn] = eval(fn);
  }
});

// Initial render passes — covers cold load when admin hasn't opened outreach yet
setTimeout(() => {
  try { updateQueueStats(); } catch(e) {}
  try { renderProspectsTable(); } catch(e) {}
  try { renderSequenceTray(); } catch(e) {}
  try { refreshProspectDropdown(); } catch(e) {}
  try { renderDorkPicker(); } catch(e) {}
}, 600);

/* ════════════════════════════════════════════════════════════════
   AUTOPILOT — runs everything automatically while admin tab open.
   Workers:
     - Discover: rotates niche/area targets, calls OSM, fills queue
     - Scan: drains queue continuously
     - Verify: MX-checks any prospect emails not yet verified
     - Sequence: queues drafts when sequence steps come due
     - Auto-send: optionally sends drafts via SMTP (B2B opt-in)
   Activity stream + browser notifications + persistent stats.
   ════════════════════════════════════════════════════════════════ */

let autopilotOn = false;
let autopilotTimers = {};
let autopilotTargets = JSON.parse(localStorage.getItem('ss_ap_targets') || '[]');
let autopilotRotation = JSON.parse(localStorage.getItem('ss_ap_rotation') || '{"idx":0}');
let autopilotStats = JSON.parse(localStorage.getItem('ss_ap_stats') || '{"discovered":0,"scanned":0,"prospects":0,"verified":0,"drafts":0,"sent":0,"sessionStart":null,"lastTick":null}');
let autopilotDrafts = JSON.parse(localStorage.getItem('ss_ap_drafts') || '[]');

function saveAutopilotState() {
  localStorage.setItem('ss_ap_targets', JSON.stringify(autopilotTargets));
  localStorage.setItem('ss_ap_rotation', JSON.stringify(autopilotRotation));
  localStorage.setItem('ss_ap_stats', JSON.stringify(autopilotStats));
  localStorage.setItem('ss_ap_drafts', JSON.stringify(autopilotDrafts));
}

function apLog(msg, kind) {
  const stream = document.getElementById('ap-activity');
  if (!stream) return;
  const ts = new Date().toTimeString().slice(0, 8);
  const color = kind === 'ok' ? 'var(--green)' : kind === 'warn' ? 'var(--amber)' : kind === 'err' ? 'var(--red)' : 'var(--muted)';
  const line = document.createElement('div');
  line.innerHTML = '<span style="color:var(--dim)">[' + ts + ']</span> <span style="color:' + color + '">' + escapeHTML(msg) + '</span>';
  // Clear placeholder
  if (stream.firstChild && stream.firstChild.textContent?.includes('Autopilot off')) stream.innerHTML = '';
  stream.appendChild(line);
  // Keep last 200 lines
  while (stream.children.length > 200) stream.removeChild(stream.firstChild);
  stream.scrollTop = stream.scrollHeight;
}

function apUpdateStats() {
  ['discovered','scanned','prospects','verified','drafts','sent'].forEach(k => {
    const el = document.getElementById('ap-stat-' + k);
    if (el) el.textContent = autopilotStats[k];
  });
  const cnt = document.getElementById('ap-targets-count');
  if (cnt) cnt.textContent = autopilotTargets.length;
}

function apNotify(title, body) {
  if (!document.getElementById('ap-switch-notify')?.checked) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'ss-autopilot', renotify: true });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function renderAutopilotTargets() {
  const list = document.getElementById('ap-targets-list');
  if (!list) return;
  if (!autopilotTargets.length) {
    list.innerHTML = '<span style="font-size:11px;color:var(--dim)">No targets — click "Seed 20 UK trades" or add manually</span>';
    return;
  }
  list.innerHTML = autopilotTargets.map((t, i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:100px;font-size:11px;font-family:'DM Mono',monospace${i === autopilotRotation.idx ? ';border-color:var(--cyan);background:rgba(0,200,224,.08)' : ''}">
      ${i === autopilotRotation.idx ? '<span style="color:var(--cyan)">▶</span>' : ''}
      ${escapeHTML(t.niche)} · ${escapeHTML(t.area)} · ${escapeHTML(t.country)}
      <span onclick="removeAutopilotTarget(${i})" style="cursor:pointer;color:var(--dim);font-weight:700">×</span>
    </span>`).join('');
  apUpdateStats();
}

function addAutopilotTarget() {
  const n = document.getElementById('ap-add-niche').value.trim().toLowerCase();
  const a = document.getElementById('ap-add-area').value.trim();
  const c = document.getElementById('ap-add-country').value;
  if (!n || !a) { alert('Niche and area required.'); return; }
  autopilotTargets.push({ niche: n, area: a, country: c });
  saveAutopilotState();
  renderAutopilotTargets();
  document.getElementById('ap-add-area').value = '';
}

function removeAutopilotTarget(i) {
  autopilotTargets.splice(i, 1);
  if (autopilotRotation.idx >= autopilotTargets.length) autopilotRotation.idx = 0;
  saveAutopilotState();
  renderAutopilotTargets();
}

function seedDefaultTargets() {
  const niches = ['barber','plumber','electrician','photographer','restaurant','cafe','personal-trainer','beauty-salon','dog-groomer','florist','mechanic','optician','dentist','solicitor','accountant','gardener','locksmith','builder','cleaner','vet'];
  const cities = ['Manchester','Birmingham','Leeds','Glasgow','Edinburgh','Liverpool','Bristol','Sheffield','Newcastle','Nottingham'];
  // 20 niche+city combos by rotating through cities
  niches.slice(0, 20).forEach((n, i) => {
    autopilotTargets.push({ niche: n, area: cities[i % cities.length], country: 'UK' });
  });
  saveAutopilotState();
  renderAutopilotTargets();
  apLog('Seeded ' + niches.length + ' UK trade+city targets', 'ok');
}

/* ──── Worker: Discover ──── */
async function apWorkerDiscover() {
  if (!autopilotOn || !document.getElementById('ap-switch-discover')?.checked) return;
  if (!autopilotTargets.length) { apLog('Discover: no targets configured', 'warn'); return; }
  const t = autopilotTargets[autopilotRotation.idx % autopilotTargets.length];
  apLog('🌐 Discover → ' + t.niche + ' / ' + t.area + ' / ' + t.country, 'info');
  try {
    const r = await fetch('/.netlify/functions/discover-prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ niche: t.niche, area: t.area, country: t.country }),
    });
    const d = await r.json();
    if (d.ok) {
      autopilotStats.discovered += d.addedToQueue || 0;
      apLog('  ↳ found ' + d.found + ', added ' + d.addedToQueue + ' to queue', 'ok');
      // Pull updated server queue into local
      try {
        const qr = await fetch('/.netlify/functions/get-queue', { headers: { 'x-admin-password': ADMIN_PW } });
        if (qr.ok) {
          const qd = await qr.json();
          if (qd.ok && Array.isArray(qd.scanQueue)) {
            scanQueue = qd.scanQueue;
            saveScanState(); updateQueueStats();
          }
        }
      } catch {}
      if (d.addedToQueue > 0) apNotify('🌐 Autopilot discovered ' + d.addedToQueue + ' businesses', t.niche + ' · ' + t.area);
    } else {
      apLog('  ↳ failed: ' + (d.error || 'unknown'), 'err');
    }
  } catch (e) { apLog('  ↳ network: ' + e.message, 'err'); }
  autopilotRotation.idx = (autopilotRotation.idx + 1) % autopilotTargets.length;
  saveAutopilotState();
  renderAutopilotTargets();
  apUpdateStats();
}

/* ──── Worker: Scan ──── */
async function apWorkerScan() {
  if (!autopilotOn || !document.getElementById('ap-switch-scan')?.checked) return;
  if (!scanQueue.length) return;
  const before = autopilotStats.scanned;
  const beforeP = prospects.length;
  await tickScanWorker();
  const scannedDelta = SCAN_CONCURRENCY; // tickScanWorker drains SCAN_CONCURRENCY
  autopilotStats.scanned += scannedDelta;
  const newPros = prospects.length - beforeP;
  if (newPros > 0) {
    autopilotStats.prospects += newPros;
    apLog('🔍 Scanned ' + scannedDelta + ' · +' + newPros + ' new prospect' + (newPros === 1 ? '' : 's'), 'ok');
  } else {
    apLog('🔍 Scanned ' + scannedDelta + ' · 0 new (queue: ' + scanQueue.length + ')', 'info');
  }
  apUpdateStats();
  saveAutopilotState();
}

/* ──── Worker: Verify ──── */
async function apWorkerVerify() {
  if (!autopilotOn || !document.getElementById('ap-switch-verify')?.checked) return;
  const toVerify = prospects.filter(p => p.email && p.emailVerified === undefined).slice(0, 5);
  if (!toVerify.length) return;
  apLog('✓ Verifying ' + toVerify.length + ' emails…', 'info');
  for (const p of toVerify) {
    try {
      const r = await fetch('/.netlify/functions/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ email: p.email }),
      });
      const d = await r.json();
      p.emailVerified = !!d.ok;
      p.emailVerifyDetail = d.detail || '';
      autopilotStats.verified++;
    } catch (e) { p.emailVerified = false; p.emailVerifyDetail = e.message; }
  }
  saveProspects(); renderProspectsTable(); apUpdateStats(); saveAutopilotState();
}

/* ──── Worker: Sequence (queue drafts) ──── */
async function apWorkerSequence() {
  if (!autopilotOn || !document.getElementById('ap-switch-sequence')?.checked) return;
  // Start sequences for any new prospects with verified personal emails
  let started = 0;
  prospects.forEach(p => {
    if (p.email && p.emailVerified === true && p.status === 'new' && !p.sequence) {
      const isRole = (p.emailVerifyDetail || '').toLowerCase().includes('role');
      // Skip role emails (info@/sales@) — lower converting + grey-area legality for some jurisdictions
      if (isRole) return;
      startSequenceFor(p.id);
      started++;
    }
  });
  if (started) apLog('🔁 Started ' + started + ' new sequence' + (started === 1 ? '' : 's'), 'ok');
  // Process due steps — generate drafts (don't send unless autosend is on)
  const due = getDueSequenceSteps();
  if (!due.length) return;
  const autosend = document.getElementById('ap-switch-autosend')?.checked;
  for (const item of due) {
    const tmpl = TEMPLATES[item.step.tmpl];
    if (!tmpl || !item.prospect.email) continue;
    const draft = buildDraftFromTemplate(item.prospect, item.step.tmpl);
    autopilotDrafts.push({ ...draft, prospectId: item.prospectId, stepIndex: item.stepIndex, queuedAt: new Date().toISOString() });
    autopilotStats.drafts++;
    item.step.draftedAt = new Date().toISOString();
    apLog('📝 Draft queued: ' + (item.prospect.bizname || item.prospect.email) + ' · ' + item.step.label, 'info');
    if (autosend) {
      // Optional: only send during good-window if the toggle is on
      const goodOnly = document.getElementById('ap-switch-goodtime')?.checked;
      if (goodOnly && !isGoodSendTimeNow()) {
        apLog('  ↳ ⏰ outside Tue–Thu 9–12 window — draft held for later', 'warn');
        continue;
      }
      try {
        const sent = await apSendDraft(draft);
        if (sent) {
          markSequenceStepSent(item.prospectId, item.stepIndex);
          autopilotStats.sent++;
          apLog('  ↳ ✅ sent to ' + draft.to, 'ok');
        } else {
          apLog('  ↳ ❌ send failed', 'err');
        }
      } catch (e) { apLog('  ↳ ❌ ' + e.message, 'err'); }
    }
  }
  if (autopilotStats.drafts > 0 && document.getElementById('ap-switch-notify')?.checked) {
    apNotify('📝 ' + autopilotStats.drafts + ' drafts ready', autosend ? 'auto-sent' : 'review + send in admin');
  }
  saveAutopilotState(); saveProspects(); renderProspectsTable(); renderSequenceTray(); apUpdateStats();
}

function buildDraftFromTemplate(p, tmplKey) {
  const tmpl = TEMPLATES[tmplKey];
  const fields = {
    biz: p.bizname || p.name || '[business]',
    nameOrThere: p.name?.split(' ')[0] || 'there',
    type: p.type || 'business',
    location: p.location || 'your area',
    website: p.website || '[their site URL]',
    observation: (p.siteIssues && p.siteIssues[0]) || 'it could be sharper and load faster',
    issuesBullets: (p.siteIssues && p.siteIssues.length) ? p.siteIssues.slice(0,3).map(i => '  • ' + i).join('\n') : '  • Slow · dated · not ranking',
  };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => fields[k] ?? '');
  const trackPx = '\n\n<img src="https://staticswift.co.uk/.netlify/functions/track-open?p=' + encodeURIComponent(p.id) + '&t=' + encodeURIComponent(tmplKey) + '" width="1" height="1" alt="" style="display:block" />';
  return {
    to: p.email,
    subject: fill(tmpl.subject),
    body: fill(tmpl.body) + SENDER_FOOTER + trackPx,
    template: tmplKey,
  };
}

async function apSendDraft(draft) {
  try {
    const r = await fetch('/.netlify/functions/send-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ to: draft.to, subject: draft.subject, body: draft.body, fromMailbox: 'hello' }),
    });
    const d = await r.json();
    return !!d.ok;
  } catch (e) { return false; }
}

/* ──── Main toggle ──── */
function toggleAutopilot() {
  const cb = document.getElementById('autopilot-toggle');
  autopilotOn = !!cb?.checked;
  const orb = document.getElementById('autopilot-orb');
  const status = document.getElementById('autopilot-status');
  const shimmer = document.getElementById('autopilot-shimmer');
  if (autopilotOn) {
    if (!autopilotTargets.length) {
      apLog('⚠ Add targets first or click "Seed 20 UK trades"', 'warn');
      if (cb) cb.checked = false;
      autopilotOn = false;
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    autopilotStats.sessionStart = new Date().toISOString();
    if (status) { status.textContent = '● Running · workers active · ' + autopilotTargets.length + ' targets in rotation'; status.style.color = 'var(--green)'; }
    if (orb) { orb.style.animation = 'autopilotPulse 1.8s ease-in-out infinite'; }
    if (shimmer) shimmer.style.display = 'block';
    if (cb) cb.style.background = 'var(--green)';
    apLog('🚀 Autopilot ON · session started', 'ok');
    // Kick all workers immediately + schedule
    apWorkerDiscover();
    autopilotTimers.discover = setInterval(apWorkerDiscover, 5 * 60_000);
    autopilotTimers.scan = setInterval(apWorkerScan, 30_000);
    autopilotTimers.verify = setInterval(apWorkerVerify, 2 * 60_000);
    autopilotTimers.sequence = setInterval(apWorkerSequence, 5 * 60_000);
    setTimeout(apWorkerScan, 2000);
    setTimeout(apWorkerVerify, 6000);
    setTimeout(apWorkerSequence, 10000);
  } else {
    Object.values(autopilotTimers).forEach(t => clearInterval(t));
    autopilotTimers = {};
    if (status) { status.textContent = 'Off · stopped'; status.style.color = 'var(--muted)'; }
    if (orb) { orb.style.animation = ''; }
    if (shimmer) shimmer.style.display = 'none';
    if (cb) cb.style.background = 'var(--surface2)';
    apLog('🛑 Autopilot OFF', 'warn');
  }
}

/* ──── Overnight summary banner ──── */
function showOvernightSummary() {
  if (!autopilotStats.sessionStart) return;
  const start = new Date(autopilotStats.sessionStart);
  const hoursAgo = (Date.now() - start.getTime()) / 3600000;
  if (hoursAgo < 1) return; // only show if >1h has passed
  const totals = autopilotStats;
  if (totals.discovered + totals.prospects + totals.drafts === 0) return;
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:20px;right:20px;width:340px;z-index:9999;background:linear-gradient(160deg,#0a0c14,#161a26);border:2px solid var(--cyan);border-radius:14px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(0,200,224,.18);animation:slideInRight .6s cubic-bezier(.16,1,.3,1)';
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <h3 style="margin:0;color:var(--cyan);font-size:18px">☀ Good morning</h3>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:0;color:var(--muted);font-size:18px;cursor:pointer">×</button>
    </div>
    <p style="margin:0 0 14px;font-size:13px;color:var(--text);line-height:1.5">While you were away (${hoursAgo.toFixed(1)}h), autopilot ran:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
      <div style="padding:9px 11px;background:rgba(0,200,224,.08);border:1px solid rgba(0,200,224,.2);border-radius:8px"><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--cyan)">${totals.discovered}</div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">businesses found</div></div>
      <div style="padding:9px 11px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px"><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--green)">${totals.prospects}</div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">prospects added</div></div>
      <div style="padding:9px 11px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);border-radius:8px"><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--purple)">${totals.verified}</div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">emails verified</div></div>
      <div style="padding:9px 11px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px"><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--amber)">${totals.drafts}</div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">drafts queued</div></div>
    </div>
    ${totals.sent ? `<div style="margin-top:10px;padding:9px 11px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:8px;text-align:center"><strong style="color:var(--green)">${totals.sent} emails sent automatically</strong></div>` : ''}
    <button onclick="document.querySelector('[data-page=outreach]').click();this.parentElement.remove()" style="margin-top:14px;width:100%;background:var(--cyan);color:var(--ink);border:0;padding:11px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Review prospects →</button>`;
  document.body.appendChild(banner);
}

// On page load, check for overnight session
setTimeout(() => {
  renderAutopilotTargets();
  apUpdateStats();
  showOvernightSummary();
}, 1500);

// Window-bind autopilot callables so onclick works
['toggleAutopilot','addAutopilotTarget','removeAutopilotTarget','seedDefaultTargets'].forEach(fn => {
  if (typeof eval(fn) === 'function') window[fn] = eval(fn);
});


/* ════════════════════════════════════════════════════════════════
   AUTOPILOT — bulk send, draft management, report export
   ════════════════════════════════════════════════════════════════ */

function updateDraftsPending() {
  const el = document.getElementById('ap-drafts-pending');
  if (el) el.textContent = (autopilotDrafts || []).length;
}

async function sendAllQueuedDrafts() {
  if (!autopilotDrafts.length) { alert('No drafts queued.'); return; }
  const goodOnly = document.getElementById('ap-switch-goodtime')?.checked;
  if (goodOnly && !isGoodSendTimeNow()) {
    if (!confirm('You\'re outside the Tue–Thu 9–12 send window. Send anyway? (open-rate may drop)')) return;
  }
  if (!confirm('Send ' + autopilotDrafts.length + ' queued drafts via SMTP now?\n\nAll templates include the PECR opt-out + your sender identity.')) return;
  let sent = 0, failed = 0;
  const before = autopilotStats.sent;
  apLog('📨 Bulk send starting · ' + autopilotDrafts.length + ' drafts', 'info');
  for (const draft of autopilotDrafts.slice()) {
    try {
      const ok = await apSendDraft(draft);
      if (ok) {
        sent++; autopilotStats.sent++;
        if (typeof draft.prospectId === 'number' || typeof draft.prospectId === 'string') {
          markSequenceStepSent(draft.prospectId, draft.stepIndex);
        }
        autopilotDrafts = autopilotDrafts.filter(d => d !== draft);
        apLog('  ↳ ✅ ' + draft.to, 'ok');
      } else { failed++; apLog('  ↳ ❌ ' + draft.to, 'err'); }
    } catch(e) { failed++; apLog('  ↳ ❌ ' + draft.to + ': ' + e.message, 'err'); }
    // Polite throttle — 1s between sends
    await new Promise(r => setTimeout(r, 1000));
  }
  saveAutopilotState(); updateDraftsPending(); apUpdateStats();
  alert('Sent: ' + sent + ' · Failed: ' + failed);
  apLog('📨 Bulk send done · ' + sent + ' sent · ' + failed + ' failed', 'ok');
}

function clearAllDrafts() {
  if (!autopilotDrafts.length) return;
  if (!confirm('Clear ' + autopilotDrafts.length + ' queued drafts? Sequences will re-queue them later.')) return;
  autopilotDrafts = [];
  saveAutopilotState(); updateDraftsPending();
}

function exportAutopilotReport() {
  const head = ['Stat','Value'];
  const rows = [
    ['Session start', autopilotStats.sessionStart || ''],
    ['Discovered', autopilotStats.discovered],
    ['Scanned', autopilotStats.scanned],
    ['Prospects added', autopilotStats.prospects],
    ['Emails verified', autopilotStats.verified],
    ['Drafts queued (total)', autopilotStats.drafts],
    ['Emails sent', autopilotStats.sent],
    ['Targets', autopilotTargets.map(t => t.niche + '/' + t.area + '/' + t.country).join('; ')],
  ];
  // Also append all prospect data
  const prospectHead = ['','','BizName','Email','Phone','Website','Score','Platform','Status','EmailVerified','LastContacted'];
  const prospectRows = prospects.map(p => ['','',
    p.bizname || '', p.email || '', p.phone || '', p.website || '',
    p.siteScore ?? '', p.sitePlatform || '', p.status || 'new',
    p.emailVerified === true ? 'yes' : p.emailVerified === false ? 'no' : '',
    p.lastContacted || '',
  ]);
  const all = [head, ...rows, ['',''], prospectHead, ...prospectRows];
  const csv = all.map(r => r.map(v => {
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? '"' + s + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'autopilot-report-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

function resetAutopilotStats() {
  if (!confirm('Reset all autopilot stats? (Prospects and drafts kept.)')) return;
  autopilotStats = { discovered:0, scanned:0, prospects:0, verified:0, drafts:0, sent:0, sessionStart:new Date().toISOString(), lastTick:null };
  saveAutopilotState(); apUpdateStats();
}

['sendAllQueuedDrafts','clearAllDrafts','exportAutopilotReport','resetAutopilotStats','updateDraftsPending']
  .forEach(fn => { if (typeof eval(fn) === 'function') window[fn] = eval(fn); });

setInterval(updateDraftsPending, 5000);
setTimeout(updateDraftsPending, 800);

/* ════════════════════════════════════════════════════════════════
   OUTREACH SUB-TAB ROUTER + ANALYTICS DEBUG + WORKFLOW AGENTS
   ════════════════════════════════════════════════════════════════ */

// Map: section heading or characteristic class → which tab it lives under
const OUTREACH_TAB_MAP = [
  // Autopilot tab
  { match: el => el.classList?.contains('autopilot-card'), tab: 'autopilot' },
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Sequence tray'), tab: 'autopilot' },
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Always-on scanner'), tab: 'autopilot' },
  // Discover tab
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Find prospects'), tab: 'discover' },
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Auto-discover'), tab: 'discover' },
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Batch scanner'), tab: 'discover' },
  // Templates tab
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Site analyzer'), tab: 'templates' },
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Outreach templates'), tab: 'templates' },
  // Email-config tab
  { match: el => el.querySelector?.('h3')?.textContent?.includes('Email config'), tab: 'email-config' },
];

function assignOutreachTabs() {
  const pg = document.getElementById('page-outreach');
  if (!pg) return;
  // Stats bar + tabs strip + modal stay always-visible
  pg.querySelectorAll('.outreach-tools, .autopilot-card').forEach(section => {
    for (const rule of OUTREACH_TAB_MAP) {
      if (rule.match(section)) { section.dataset.otab = rule.tab; return; }
    }
    section.dataset.otab = 'discover'; // safe default
  });
  // The command-center prospects table is the big block at the bottom
  const cc = document.querySelector('#page-outreach > div[style*="border:1px solid var(--border);border-radius:14px"]');
  if (cc && !cc.dataset.otab) cc.dataset.otab = 'prospects';
}

function switchOutreachTab(tab) {
  document.querySelectorAll('#outreach-tabs .outreach-tab').forEach(b => b.classList.toggle('active', b.dataset.otab === tab));
  document.querySelectorAll('#page-outreach [data-otab]').forEach(el => {
    el.style.display = (el.dataset.otab === tab) ? '' : 'none';
  });
  // Special: render results tab when switched to
  if (tab === 'results') renderResultsTab();
  // Persist last-used tab
  try { localStorage.setItem('ss_outreach_tab', tab); } catch(e){}
}

function renderResultsTab() {
  let panel = document.getElementById('results-tab-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'results-tab-panel';
    panel.dataset.otab = 'results';
    panel.style.cssText = 'display:flex;flex-direction:column;gap:18px;margin-bottom:18px';
    const pg = document.getElementById('page-outreach');
    pg?.querySelector('.outreach-tabs')?.after(panel);
  }
  const totals = autopilotStats || { discovered:0, scanned:0, prospects:0, verified:0, drafts:0, sent:0 };
  const recentLogs = Array.from(document.querySelectorAll('#ap-activity > div')).slice(-30).map(d => d.outerHTML).join('') || '<div style="color:var(--dim)">No activity yet — start autopilot to see live results here.</div>';
  const sessionStart = totals.sessionStart ? new Date(totals.sessionStart).toLocaleString('en-GB') : 'Not started';
  const uptime = totals.sessionStart ? Math.round((Date.now() - new Date(totals.sessionStart).getTime()) / 60000) : 0;
  const newToday = prospects.filter(p => {
    const t = new Date(p.addedAt).getTime();
    return Date.now() - t < 86400000;
  }).length;
  const topScores = prospects.slice().sort((a,b) => (a.siteScore ?? 999) - (b.siteScore ?? 999)).slice(0, 8);
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
      <div class="stat-card" style="padding:14px"><div class="label">Session start</div><div class="value" style="font-size:14px;font-family:'DM Mono',monospace">${escapeHTML(sessionStart)}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Uptime</div><div class="value">${uptime}<small style="font-size:.5em">min</small></div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Prospects today</div><div class="value" style="color:var(--green)">${newToday}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Total found</div><div class="value" style="color:var(--cyan)">${totals.discovered}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Sites scanned</div><div class="value" style="color:var(--purple)">${totals.scanned}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Emails verified</div><div class="value">${totals.verified}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Drafts queued</div><div class="value" style="color:var(--amber)">${totals.drafts}</div></div>
      <div class="stat-card" style="padding:14px"><div class="label">Emails sent</div><div class="value" style="color:var(--green)">${totals.sent}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;display:flex;justify-content:space-between;align-items:center">
          <span>🔥 Top opportunities (lowest score)</span>
          <button onclick="switchOutreachTab('prospects')" style="background:none;border:0;color:var(--cyan);font-size:11px;cursor:pointer;font-family:inherit">All →</button>
        </div>
        <div style="max-height:380px;overflow-y:auto">
          ${topScores.length ? topScores.map(p => `
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:${(p.siteScore ?? 999) < 40 ? 'var(--red)' : 'var(--amber)'};width:40px">${p.siteScore ?? '—'}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(p.bizname || 'Unknown')}</div>
                <div style="font-size:11px;color:var(--muted)">${escapeHTML(p.sitePlatform || '')} · ${p.email ? escapeHTML(p.email) : 'no email'}</div>
              </div>
              <button onclick="prefillTemplateFor('${escapeHTML(p.id)}');switchOutreachTab('templates')" style="background:var(--cyan);color:var(--ink);border:0;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✉</button>
            </div>`).join('') : '<div style="padding:20px;color:var(--dim);text-align:center">No prospects yet</div>'}
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">📡 Live activity stream</div>
        <div style="max-height:380px;overflow-y:auto;padding:12px 14px;font-family:'DM Mono',monospace;font-size:11px;line-height:1.7;color:var(--muted);background:#000">
          ${recentLogs}
        </div>
      </div>
    </div>`;
}

/* ════ ANALYTICS DEBUG button — diagnoses Blobs + tracker ════ */
async function runAnalyticsDebug() {
  const out = document.getElementById('analytics-debug-result');
  if (!out) return;
  out.style.display = 'block';
  out.textContent = 'Running diagnostic…';
  try {
    const r = await fetch('/.netlify/functions/analytics-debug', {
      headers: { 'x-admin-password': ADMIN_PW },
    });
    const text = await r.text();
    out.textContent = text;
    out.style.color = text.includes('✓ Analytics working') ? 'var(--green)' : 'var(--amber)';
  } catch (err) {
    out.textContent = 'Debug failed: ' + err.message;
    out.style.color = 'var(--red)';
  }
}

/* ════ WORKFLOW AGENTS — long-running, status-aware ════ */

// Agent: auto-archive stale prospects (90 days no activity + status=sent)
function workflowAgentArchiveStale() {
  const cutoff = Date.now() - 90 * 86400000;
  let archived = 0;
  prospects.forEach(p => {
    const last = new Date(p.lastContacted || p.addedAt).getTime();
    if (p.status === 'sent' && last < cutoff) { p.status = 'dead'; p.deadReason = 'stale-90d'; archived++; }
  });
  if (archived) { saveProspects(); renderProspectsTable(); apLog('🗄 Archived ' + archived + ' stale prospects', 'info'); }
  return archived;
}

// Agent: auto-tag prospects by signal richness (★ for hot, ♨ for warm)
function workflowAgentTagProspects() {
  let tagged = 0;
  prospects.forEach(p => {
    const isHot = (p.siteScore ?? 999) < 30 && p.emailVerified === true && (p.sitePlatform === 'Wix' || p.sitePlatform === 'GoDaddy Builder' || p.sitePlatform === 'No website');
    const isWarm = (p.siteScore ?? 999) < 50 && p.email;
    const newTag = isHot ? '🔥hot' : isWarm ? '♨warm' : '';
    if (p.tag !== newTag) { p.tag = newTag; tagged++; }
  });
  if (tagged) { saveProspects(); renderProspectsTable(); }
  return tagged;
}

// Run workflows every 10 min while autopilot is on
function startWorkflowAgents() {
  if (window._workflowInt) return;
  window._workflowInt = setInterval(() => {
    if (!autopilotOn) return;
    workflowAgentArchiveStale();
    workflowAgentTagProspects();
  }, 10 * 60_000);
}

// Hook into autopilot toggle so workflows track its state
const _origToggleAutopilot = window.toggleAutopilot;
window.toggleAutopilot = function(){
  if (typeof _origToggleAutopilot === 'function') _origToggleAutopilot();
  if (autopilotOn) startWorkflowAgents();
};

['switchOutreachTab','renderResultsTab','runAnalyticsDebug','workflowAgentArchiveStale','workflowAgentTagProspects','assignOutreachTabs']
  .forEach(fn => { try { if (typeof eval(fn) === 'function') window[fn] = eval(fn); } catch(e){} });

// On outreach tab open, assign sections + restore last-used sub-tab
const _origShowPage2 = window.showPage;
window.showPage = function(id, btn) {
  if (typeof _origShowPage2 === 'function') _origShowPage2(id, btn);
  if (id === 'outreach') {
    setTimeout(() => {
      assignOutreachTabs();
      const last = localStorage.getItem('ss_outreach_tab') || 'autopilot';
      switchOutreachTab(last);
    }, 100);
  }
};

// Run once on load too in case user lands on outreach
setTimeout(() => { try { assignOutreachTabs(); const t = localStorage.getItem('ss_outreach_tab') || 'autopilot'; switchOutreachTab(t); } catch(e) {} }, 1500);

/* ════════════════════════════════════════════════════════════════
   DEEP-RESEARCH HELPERS — Companies House · Domain age · Deliverability
   ════════════════════════════════════════════════════════════════ */

async function lookupCompaniesHouse(prospectId) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  if (!p.bizname) { alert('Need a business name first.'); return; }
  try {
    const r = await fetch('/.netlify/functions/companies-house', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ name: p.bizname }),
    });
    const d = await r.json();
    p.chStatus = d.status;
    p.chIsLtd = !!d.isLtdCompany;
    p.chPecrSafe = !!d.pecrSafe;
    p.chCompanyNumber = d.companyNumber || '';
    p.chIncorporated = d.incorporated || '';
    p.chVerdict = d.verdict || '';
    saveProspects(); renderProspectsTable();
    alert((d.pecrSafe ? '✓ PECR-SAFE' : '⚠ Not PECR-safe') + '\n\n' + d.verdict);
  } catch (e) { alert('Companies House lookup failed: ' + e.message); }
}

async function lookupDomainAge(prospectId) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p?.website) { alert('No website on record.'); return; }
  try {
    const r = await fetch('/.netlify/functions/domain-age', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ domain: p.website }),
    });
    const d = await r.json();
    if (d.ok) {
      p.domainAge = d.ageYears;
      p.domainBand = d.ageBand;
      p.domainRegistered = d.registered;
      saveProspects(); renderProspectsTable();
      alert(d.verdict + '\n\nRegistered: ' + new Date(d.registered).toLocaleDateString('en-GB') + '\nAge: ' + d.ageYears + ' years\nRegistrar: ' + (d.registrar || 'unknown'));
    } else { alert('Lookup failed: ' + d.error); }
  } catch (e) { alert('Domain lookup failed: ' + e.message); }
}

async function checkDeliverability() {
  const domain = prompt('Check deliverability for which domain? (your sending domain — e.g. staticswift.co.uk)', 'staticswift.co.uk');
  if (!domain) return;
  try {
    const r = await fetch('/.netlify/functions/deliverability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ domain }),
    });
    const d = await r.json();
    const lines = [d.verdict, '', 'Score: ' + d.passing + '/' + d.total, ''];
    Object.entries(d.checks).forEach(([k, v]) => {
      lines.push((v.pass ? '✓' : '✗') + ' ' + k.toUpperCase() + ': ' + v.detail);
      if (!v.pass) lines.push('  Fix: ' + v.fix);
      lines.push('');
    });
    const result = document.getElementById('deliverability-result');
    if (result) {
      result.style.display = 'block';
      result.style.color = d.passing === 4 ? 'var(--green)' : d.passing >= 2 ? 'var(--amber)' : 'var(--red)';
      result.textContent = lines.join('\n');
    } else {
      alert(lines.join('\n'));
    }
  } catch (e) { alert('Check failed: ' + e.message); }
}

['lookupCompaniesHouse','lookupDomainAge','checkDeliverability']
  .forEach(fn => { try { if (typeof eval(fn) === 'function') window[fn] = eval(fn); } catch(e){} });

/* ═══════════════════════════════════════════════════════════════
   EMAIL DRAFTS EDITOR · view + edit + save outreach templates
   localStorage overrides → TEMPLATES on load so edits persist
   ═══════════════════════════════════════════════════════════════ */
const TEMPLATE_OVERRIDES_KEY = 'ss_template_overrides_v1';

function loadTemplateOverrides() {
  try {
    const raw = localStorage.getItem(TEMPLATE_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) { return {}; }
}
function saveTemplateOverrides(overrides) {
  try {
    localStorage.setItem(TEMPLATE_OVERRIDES_KEY, JSON.stringify(overrides));
    return true;
  } catch (e) { console.error('save fail', e); return false; }
}
/* Apply any saved overrides to in-memory TEMPLATES on load */
(function applyTemplateOverridesOnLoad(){
  const overs = loadTemplateOverrides();
  Object.keys(overs).forEach(key => {
    if (typeof TEMPLATES !== 'undefined' && TEMPLATES[key]) {
      Object.assign(TEMPLATES[key], overs[key]);
    }
  });
})();

function renderEmailDraftsEditor() {
  if (typeof TEMPLATES === 'undefined') {
    return '<div style="padding:2rem;color:#888">TEMPLATES not loaded.</div>';
  }
  const overs = loadTemplateOverrides();
  const keys = Object.keys(TEMPLATES);
  let html = `
    <div class="drafts-editor" style="max-width:900px;margin:0 auto;padding:2rem 1rem">
      <div style="margin-bottom:1.6rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <h2 style="font-family:'Boska',Georgia,serif;font-style:italic;font-size:2rem;margin:0 0 .4rem">Email drafts</h2>
        <p style="color:var(--muted);font-size:.92rem;margin:0">${keys.length} templates &middot; ${Object.keys(overs).length} edited. Edits save to your browser instantly. Use merge fields like <code style="background:rgba(0,0,0,.04);padding:1px 6px;border-radius:3px">{biz}</code>, <code style="background:rgba(0,0,0,.04);padding:1px 6px;border-radius:3px">{nameOrThere}</code>, <code style="background:rgba(0,0,0,.04);padding:1px 6px;border-radius:3px">{observation}</code>, <code style="background:rgba(0,0,0,.04);padding:1px 6px;border-radius:3px">{website}</code>.</p>
      </div>`;
  keys.forEach(key => {
    const t = TEMPLATES[key];
    const isEdited = !!overs[key];
    html += `
      <details class="draft-card" ${isEdited ? 'open' : ''} data-tplkey="${key}" style="margin-bottom:1.2rem;background:var(--card);border:1px solid var(--border);border-radius:6px;overflow:hidden">
        <summary style="cursor:pointer;padding:1rem 1.2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;list-style:none">
          <div style="display:flex;align-items:center;gap:.6rem">
            <strong style="font-family:'JetBrains Mono',monospace;font-size:.78rem;letter-spacing:.1em;color:var(--terr-deep,#7e4f37)">${escapeHTML(key)}</strong>
            <span style="color:var(--muted);font-size:.86rem">${escapeHTML(t.label || '')}</span>
          </div>
          <div style="display:flex;gap:.4rem;align-items:center">
            ${isEdited ? '<span style="background:#7e4f37;color:white;font-size:.66rem;letter-spacing:.1em;padding:.2rem .5rem;border-radius:2px;text-transform:uppercase">edited</span>' : ''}
            <span style="color:var(--muted);font-size:.8rem">▾</span>
          </div>
        </summary>
        <div style="padding:1.1rem 1.2rem 1.4rem;border-top:1px solid var(--border)">
          <label style="display:block;margin-bottom:.9rem">
            <span style="display:block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.35rem;font-weight:600">Subject line</span>
            <input type="text" class="draft-subject" value="${escapeHTML(t.subject || '')}" style="width:100%;padding:.6rem .75rem;border:1px solid var(--border);border-radius:4px;background:white;font-family:inherit;font-size:.92rem">
          </label>
          <label style="display:block;margin-bottom:1rem">
            <span style="display:block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.35rem;font-weight:600">Body</span>
            <textarea class="draft-body" rows="12" style="width:100%;padding:.75rem;border:1px solid var(--border);border-radius:4px;background:white;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.82rem;line-height:1.5;resize:vertical">${escapeHTML(t.body || '')}</textarea>
          </label>
          <div style="display:flex;gap:.55rem;flex-wrap:wrap">
            <button type="button" class="ss-btn-primary" onclick="saveDraft('${key}')" style="padding:.55rem 1rem;background:#0e0c0a;color:#faf7f1;border:0;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;font-weight:600">Save edits</button>
            <button type="button" onclick="previewDraft('${key}')" style="padding:.55rem 1rem;background:transparent;border:1px solid var(--border);border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer">Preview merged</button>
            ${isEdited ? `<button type="button" onclick="revertDraft('${key}')" style="padding:.55rem 1rem;background:transparent;border:1px solid #c44;color:#c44;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;margin-left:auto">Revert to original</button>` : ''}
          </div>
          <div class="draft-preview" id="draft-preview-${key}" style="display:none;margin-top:1rem;padding:1rem;background:#faf7f1;border-left:3px solid var(--terr-deep,#7e4f37);font-family:Georgia,serif;font-size:.92rem;white-space:pre-wrap;line-height:1.55"></div>
        </div>
      </details>`;
  });
  html += `
      <div style="margin-top:2rem;padding-top:1.2rem;border-top:1px solid var(--border);font-size:.78rem;color:var(--muted)">
        <strong>Tip:</strong> Edits save to your browser only. To sync to other devices, export the JSON below.
        <div style="margin-top:.6rem;display:flex;gap:.5rem">
          <button onclick="exportTemplateEdits()" style="padding:.4rem .8rem;background:transparent;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:.72rem">Export edits (JSON)</button>
          <button onclick="importTemplateEdits()" style="padding:.4rem .8rem;background:transparent;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:.72rem">Import edits (JSON)</button>
          <button onclick="clearAllTemplateEdits()" style="padding:.4rem .8rem;background:transparent;border:1px solid #c44;color:#c44;border-radius:4px;cursor:pointer;font-size:.72rem">Clear all edits</button>
        </div>
      </div>
    </div>`;
  return html;
}

function saveDraft(key) {
  const card = document.querySelector('details.draft-card[data-tplkey="' + key + '"]');
  if (!card) return;
  const subject = card.querySelector('.draft-subject').value;
  const body = card.querySelector('.draft-body').value;
  const overs = loadTemplateOverrides();
  overs[key] = { subject, body };
  if (saveTemplateOverrides(overs)) {
    // apply to live TEMPLATES
    if (typeof TEMPLATES !== 'undefined' && TEMPLATES[key]) {
      TEMPLATES[key].subject = subject;
      TEMPLATES[key].body = body;
    }
    const btn = card.querySelector('.ss-btn-primary');
    if (btn) { const orig = btn.textContent; btn.textContent = '✓ Saved'; setTimeout(() => btn.textContent = orig, 1600); }
  } else {
    alert('Could not save. localStorage may be full or disabled.');
  }
}
function previewDraft(key) {
  const card = document.querySelector('details.draft-card[data-tplkey="' + key + '"]');
  if (!card) return;
  const subject = card.querySelector('.draft-subject').value;
  const body = card.querySelector('.draft-body').value;
  const merged = (subject + '\n\n' + body)
    .replace(/\{biz\}/g, 'Manchester Plumbing Co.')
    .replace(/\{nameOrThere\}/g, 'James')
    .replace(/\{name\}/g, 'James')
    .replace(/\{website\}/g, 'manchesterplumbing.co.uk')
    .replace(/\{observation\}/g, 'your homepage takes 4.2 seconds to load on mobile')
    .replace(/\{issuesBullets\}/g, '• No mobile menu — the nav is unusable on phones\n• Missing meta description — Google is guessing what your business does')
    .replace(/\{type\}/g, 'plumbing')
    .replace(/\{location\}/g, 'Manchester');
  const pre = card.querySelector('#draft-preview-' + key);
  if (pre) {
    pre.textContent = merged + (typeof SENDER_FOOTER !== 'undefined' ? SENDER_FOOTER : '');
    pre.style.display = 'block';
  }
}
function revertDraft(key) {
  if (!confirm('Revert "' + key + '" to original copy? Your edits will be lost.')) return;
  const overs = loadTemplateOverrides();
  delete overs[key];
  saveTemplateOverrides(overs);
  // restore from default — we kept the originals in a side table
  if (typeof TEMPLATE_DEFAULTS !== 'undefined' && TEMPLATE_DEFAULTS[key]) {
    TEMPLATES[key].subject = TEMPLATE_DEFAULTS[key].subject;
    TEMPLATES[key].body = TEMPLATE_DEFAULTS[key].body;
  }
  showEmailDrafts(); // re-render
}
function exportTemplateEdits() {
  const overs = loadTemplateOverrides();
  const blob = new Blob([JSON.stringify(overs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'staticswift-template-edits-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
}
function importTemplateEdits() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (saveTemplateOverrides(parsed)) {
          alert('Imported ' + Object.keys(parsed).length + ' edits. Refresh to see them.');
          location.reload();
        }
      } catch (e) { alert('Bad JSON: ' + e.message); }
    };
    reader.readAsText(f);
  };
  input.click();
}
function clearAllTemplateEdits() {
  if (!confirm('Clear ALL template edits? You will lose every customisation. (You can re-import from a backup.)')) return;
  localStorage.removeItem(TEMPLATE_OVERRIDES_KEY);
  location.reload();
}
function showEmailDrafts() {
  const host = document.getElementById('outreach-templates-content') || document.getElementById('outreach-templates') || document.getElementById('outreach-content');
  if (!host) {
    const fallback = document.createElement('div');
    fallback.id = 'drafts-modal';
    fallback.style.cssText = 'position:fixed;inset:0;background:rgba(250,247,241,.98);z-index:99999;overflow:auto;padding:2rem';
    fallback.innerHTML = '<div style="max-width:920px;margin:0 auto"><button onclick="document.getElementById(\'drafts-modal\').remove()" style="float:right;padding:.4rem .8rem;border:0;background:#0e0c0a;color:#faf7f1;cursor:pointer;font-family:monospace">CLOSE ✕</button>' + renderEmailDraftsEditor() + '</div>';
    document.body.appendChild(fallback);
    return;
  }
  host.innerHTML = renderEmailDraftsEditor();
}

/* Capture original templates so revert works */
let TEMPLATE_DEFAULTS = {};
(function captureTemplateDefaults(){
  if (typeof TEMPLATES === 'undefined') return;
  Object.keys(TEMPLATES).forEach(k => {
    const overs = loadTemplateOverrides();
    if (!overs[k]) {
      TEMPLATE_DEFAULTS[k] = { subject: TEMPLATES[k].subject, body: TEMPLATES[k].body };
    }
  });
})();

/* ═══════════════════════════════════════════════════════════════
   MY PROSPECTS · table view of everything in the queue
   ═══════════════════════════════════════════════════════════════ */
function renderMyProspects() {
  let prospects = [];
  try {
    const raw = localStorage.getItem('ss_clients_v3') || localStorage.getItem('ss_clients') || '[]';
    prospects = JSON.parse(raw);
  } catch (e) {}
  if (!Array.isArray(prospects)) prospects = [];

  const total = prospects.length;
  const withSite = prospects.filter(p => p.website || p.url).length;
  const scanned = prospects.filter(p => p.score != null || p.scanScore != null).length;
  const sent = prospects.filter(p => p.lastSent || p.sentAt || (p.sequence && p.sequence.length)).length;
  const replied = prospects.filter(p => p.reply || p.replyAt || p.replied).length;

  let html = `
    <div class="my-prospects-view" style="max-width:1300px;margin:0 auto;padding:1.5rem 1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.4rem;gap:1rem;flex-wrap:wrap">
        <div>
          <h2 style="font-family:'Boska',Georgia,serif;font-style:italic;font-size:2rem;margin:0 0 .3rem">My prospects</h2>
          <p style="color:var(--muted);font-size:.88rem;margin:0">${total} total &middot; ${withSite} with websites &middot; ${scanned} scanned &middot; ${sent} contacted &middot; ${replied} replied</p>
        </div>
        <div style="display:flex;gap:.5rem">
          <input id="prospect-filter" placeholder="Filter by name, town, niche..." oninput="filterMyProspects()" style="padding:.5rem .75rem;border:1px solid var(--border);border-radius:4px;font-size:.88rem;width:220px">
          <button onclick="exportMyProspects()" style="padding:.5rem .9rem;background:transparent;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-family:monospace;font-size:.76rem;letter-spacing:.1em;text-transform:uppercase">Export CSV</button>
        </div>
      </div>`;

  if (total === 0) {
    html += `<div style="text-align:center;padding:4rem 1rem;border:1.5px dashed var(--border);border-radius:6px;color:var(--muted)">
      <p style="font-family:'Boska',serif;font-style:italic;font-size:1.4rem;margin:0 0 .5rem;color:#7e4f37">No prospects yet.</p>
      <p style="font-size:.88rem;margin:0">Use <strong>Discover</strong> or <strong>Autopilot</strong> to add some, then come back here.</p>
    </div></div>`;
    return html;
  }

  html += `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;background:white">
      <table id="my-prospects-table" style="width:100%;border-collapse:collapse;font-size:.86rem">
        <thead style="background:#faf7f1;border-bottom:1.5px solid var(--border)">
          <tr style="text-align:left">
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Business</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Town</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Niche</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Score</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Email</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Status</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600">Last touch</th>
            <th style="padding:.7rem .8rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;width:80px">Actions</th>
          </tr>
        </thead>
        <tbody>`;
  prospects.slice(0, 200).forEach((p, i) => {
    const score = p.score ?? p.scanScore ?? null;
    const scoreColor = score == null ? '#888' : score < 40 ? '#c44' : score < 70 ? '#a86c4d' : '#4ea36e';
    const lastTouch = p.lastSent || p.sentAt || p.scannedAt || p.addedAt || '';
    const status = p.replied ? 'replied' : p.lastSent || p.sentAt ? 'contacted' : score != null ? 'scanned' : 'new';
    const statusColor = { replied:'#4ea36e', contacted:'#a86c4d', scanned:'#888', new:'#7e4f37' }[status];
    html += `
      <tr class="prospect-row" data-search="${escapeHTML((p.bizname||'') + ' ' + (p.location||'') + ' ' + (p.niche||'')).toLowerCase()}" style="border-bottom:1px solid var(--border)">
        <td style="padding:.65rem .8rem;font-weight:600">${escapeHTML(p.bizname || p.name || '—')}<br><a href="${escapeHTML(p.website || p.url || '#')}" target="_blank" style="font-weight:400;color:var(--muted);font-size:.78rem;text-decoration:none">${escapeHTML((p.website||p.url||'').replace(/^https?:\/\//,'').replace(/\/$/,''))}</a></td>
        <td style="padding:.65rem .8rem;color:var(--muted)">${escapeHTML(p.location || p.town || '—')}</td>
        <td style="padding:.65rem .8rem;color:var(--muted)">${escapeHTML(p.niche || p.type || '—')}</td>
        <td style="padding:.65rem .8rem;color:${scoreColor};font-weight:700;font-family:monospace">${score == null ? '—' : score + '/100'}</td>
        <td style="padding:.65rem .8rem;font-family:monospace;font-size:.78rem">${escapeHTML(p.email || '—')}</td>
        <td style="padding:.65rem .8rem"><span style="background:${statusColor}15;color:${statusColor};padding:.2rem .55rem;border-radius:2px;font-family:monospace;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700">${status}</span></td>
        <td style="padding:.65rem .8rem;color:var(--muted);font-size:.78rem">${lastTouch ? new Date(lastTouch).toLocaleDateString('en-GB') : '—'}</td>
        <td style="padding:.65rem .8rem">
          <button onclick="viewProspectDetails(${i})" style="background:transparent;border:1px solid var(--border);border-radius:3px;padding:.25rem .5rem;font-size:.72rem;cursor:pointer;font-family:monospace">VIEW</button>
        </td>
      </tr>`;
  });
  html += '</tbody></table></div>';
  if (prospects.length > 200) html += `<p style="color:var(--muted);font-size:.78rem;margin-top:.8rem">Showing 200 of ${prospects.length}. Use filter to narrow.</p>`;
  html += '</div>';
  return html;
}
function showMyProspects() {
  let host = document.getElementById('outreach-prospects-content') || document.getElementById('prospects-panel');
  if (!host) {
    const modal = document.createElement('div');
    modal.id = 'prospects-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(250,247,241,.98);z-index:99999;overflow:auto;padding:1.5rem';
    modal.innerHTML = '<div style="max-width:1300px;margin:0 auto"><button onclick="document.getElementById(\'prospects-modal\').remove()" style="float:right;padding:.4rem .8rem;border:0;background:#0e0c0a;color:#faf7f1;cursor:pointer;font-family:monospace">CLOSE ✕</button>' + renderMyProspects() + '</div>';
    document.body.appendChild(modal);
    return;
  }
  host.innerHTML = renderMyProspects();
}
function filterMyProspects() {
  const q = (document.getElementById('prospect-filter')?.value || '').toLowerCase();
  document.querySelectorAll('.prospect-row').forEach(row => {
    row.style.display = row.dataset.search.includes(q) ? '' : 'none';
  });
}
function exportMyProspects() {
  let prospects = [];
  try { prospects = JSON.parse(localStorage.getItem('ss_clients_v3') || '[]'); } catch(e) {}
  const headers = ['bizname', 'website', 'email', 'location', 'niche', 'score', 'status', 'addedAt', 'lastSent', 'replied'];
  const rows = prospects.map(p => headers.map(h => {
    const v = p[h] ?? p[h.toLowerCase()] ?? '';
    return '"' + String(v).replace(/"/g, '""') + '"';
  }).join(','));
  const csv = headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'staticswift-prospects-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}
function viewProspectDetails(idx) {
  let prospects = [];
  try { prospects = JSON.parse(localStorage.getItem('ss_clients_v3') || '[]'); } catch(e) {}
  const p = prospects[idx]; if (!p) return;
  alert(JSON.stringify(p, null, 2));
}

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS DIAGNOSE · runs the debug endpoint + shows result
   ═══════════════════════════════════════════════════════════════ */
async function diagnoseAnalytics() {
  const out = document.getElementById('analytics-diagnose-result') || (() => {
    const d = document.createElement('div');
    d.id = 'analytics-diagnose-result';
    d.style.cssText = 'position:fixed;inset:5% 5%;background:white;border:2px solid #0e0c0a;border-radius:6px;padding:1.5rem;overflow:auto;z-index:99999;font-family:monospace;font-size:.82rem;white-space:pre-wrap;line-height:1.55';
    document.body.appendChild(d);
    return d;
  })();
  out.innerHTML = '<button onclick="document.getElementById(\'analytics-diagnose-result\').remove()" style="float:right;padding:.3rem .7rem;background:#0e0c0a;color:#faf7f1;border:0;cursor:pointer;font-family:monospace">CLOSE ✕</button><h3 style="margin:0 0 1rem;font-family:Boska,serif;font-style:italic">Diagnosing analytics…</h3>';
  try {
    const r = await fetch('/.netlify/functions/analytics-debug', {
      method: 'POST',
      headers: { 'x-admin-password': ADMIN_PW || sessionStorage.getItem('ss_admin_pw') || '' }
    });
    const txt = await r.text();
    let parsed;
    try { parsed = JSON.parse(txt); } catch(e) { parsed = { raw: txt }; }
    let verdict = parsed.verdict || 'No verdict';
    let detail = '';
    if (parsed.verdict?.startsWith('✓')) detail = '<p style="color:#4ea36e;font-weight:700">' + verdict + '</p>';
    else if (parsed.verdict?.startsWith('⚠')) detail = '<p style="color:#c8a64a;font-weight:700">' + verdict + '</p>';
    else detail = '<p style="color:#c44;font-weight:700">' + verdict + '</p>';
    if (parsed.totalEventsLast7Days != null) detail += '<p>Events in last 7 days: <strong>' + parsed.totalEventsLast7Days + '</strong></p>';
    if (parsed.errors?.length) detail += '<p style="color:#c44">Errors:</p><pre>' + JSON.stringify(parsed.errors, null, 2) + '</pre>';
    out.innerHTML = '<button onclick="document.getElementById(\'analytics-diagnose-result\').remove()" style="float:right;padding:.3rem .7rem;background:#0e0c0a;color:#faf7f1;border:0;cursor:pointer;font-family:monospace">CLOSE ✕</button>' +
      '<h3 style="margin:0 0 1rem;font-family:Boska,serif;font-style:italic">Analytics diagnosis</h3>' +
      detail + '<details style="margin-top:1rem"><summary style="cursor:pointer;color:#666">Raw response</summary><pre style="background:#faf7f1;padding:1rem;border-radius:4px;overflow:auto;font-size:.74rem">' + escapeHTML(JSON.stringify(parsed, null, 2)) + '</pre></details>';
  } catch (err) {
    out.innerHTML += '<p style="color:#c44">FAILED: ' + err.message + '</p>';
  }
}

/* Expose new functions globally so onclicks resolve */
['renderEmailDraftsEditor','saveDraft','previewDraft','revertDraft','exportTemplateEdits','importTemplateEdits','clearAllTemplateEdits','showEmailDrafts','renderMyProspects','showMyProspects','filterMyProspects','exportMyProspects','viewProspectDetails','diagnoseAnalytics']
  .forEach(fn => { try { if (typeof eval(fn) === 'function') window[fn] = eval(fn); } catch(e){} });

/* ═══════════════════════════════════════════════════════════════
   AUTOPILOT v2 · region rotation + exclude rules
   ═══════════════════════════════════════════════════════════════ */
const UK_REGIONS = {
  'north-west':   ['Manchester','Liverpool','Preston','Blackpool','Bolton','Warrington','Stockport','Oldham','Salford','Lancaster','Wigan','Chester','Burnley','Blackburn','Macclesfield','Crewe','Carlisle','Kendal','Southport','St Helens'],
  'north-east':   ['Newcastle','Sunderland','Middlesbrough','Durham','Gateshead','Stockton','Darlington','Hartlepool','South Shields','Whitley Bay','Tynemouth','North Shields'],
  'yorkshire':    ['Leeds','Sheffield','Bradford','Hull','York','Doncaster','Rotherham','Huddersfield','Wakefield','Harrogate','Halifax','Barnsley','Scarborough','Pontefract','Skipton','Whitby','Otley','Ilkley'],
  'midlands-w':   ['Birmingham','Wolverhampton','Coventry','Stoke-on-Trent','Walsall','Dudley','Solihull','Telford','Worcester','Hereford','Stratford-upon-Avon','Leamington Spa','Warwick','Kidderminster','Stourbridge','Sutton Coldfield','Tamworth'],
  'midlands-e':   ['Nottingham','Leicester','Derby','Northampton','Lincoln','Peterborough','Mansfield','Loughborough','Chesterfield','Newark','Grantham','Stamford','Boston','Skegness','Kettering','Wellingborough','Corby','Long Eaton'],
  'east-anglia':  ['Norwich','Cambridge','Ipswich','Colchester','Chelmsford','Southend-on-Sea',"King's Lynn",'Bury St Edmunds','Great Yarmouth','Lowestoft','Felixstowe','Sudbury','Newmarket','Ely','Wisbech','Saffron Walden'],
  'london-n':     ['Camden','Hackney','Islington','Haringey','Enfield','Barnet','Tottenham','Finchley','Wood Green','Holloway','Stoke Newington','Crouch End','Highgate','Muswell Hill','Edmonton'],
  'london-s':     ['Croydon','Bromley','Sutton','Lewisham','Greenwich','Wandsworth','Streatham','Brixton','Clapham','Balham','Tooting','Wimbledon','Putney','Battersea','Catford','Forest Hill','Peckham'],
  'london-e':     ['Romford','Newham','Tower Hamlets','Stratford','Walthamstow','Leyton','Plaistow','Bow','Bethnal Green','Whitechapel','Dagenham','Ilford','Barking','Upton Park'],
  'london-w':     ['Ealing','Brent','Hammersmith','Fulham','Chiswick','Acton','Hounslow','Richmond','Twickenham','Kingston upon Thames','Wembley','Harrow','Uxbridge'],
  'south-east':   ['Brighton','Reading','Southampton','Portsmouth','Oxford','Milton Keynes','Slough','Guildford','Maidstone','Tunbridge Wells','Canterbury','Eastbourne','Hastings','Hove','Worthing','Crawley','Horsham','Chichester','Bognor Regis','Dover','Ashford','Sevenoaks'],
  'south-west':   ['Bristol','Plymouth','Exeter','Bath','Bournemouth','Poole','Cheltenham','Gloucester','Swindon','Salisbury','Truro','Taunton','Torquay','Weston-super-Mare','Yeovil','Weymouth','Newquay','Bideford','Bridgwater','Paignton','Falmouth','St Ives'],
  'wales':        ['Cardiff','Swansea','Newport','Wrexham','Bangor','Aberystwyth','Carmarthen','Llandudno','Bridgend','Caerphilly','Pontypridd','Merthyr Tydfil','Rhyl','Colwyn Bay','Conwy','Holyhead','Llanelli','Neath','Port Talbot','Barry','Cwmbran'],
  'scotland-c':   ['Glasgow','Edinburgh','Stirling','Falkirk','Paisley','Motherwell','Hamilton','Coatbridge','East Kilbride','Greenock','Dunfermline','Kirkcaldy','Livingston','Cumbernauld'],
  'scotland-n':   ['Aberdeen','Dundee','Inverness','Perth','Elgin','Fort William','Oban','Fraserburgh','Peterhead','Stornoway','Thurso','Wick'],
  'scotland-s':   ['Ayr','Dumfries','Galashiels','Hawick','Stranraer','Kilmarnock','Irvine','Troon','Prestwick'],
  'n-ireland':    ['Belfast','Derry','Lisburn','Bangor (NI)','Newtownabbey','Craigavon','Antrim','Ballymena','Armagh','Coleraine','Newry','Omagh','Enniskillen','Carrickfergus'],
  'cornwall':     ['Truro','Newquay','Penzance','St Ives','Falmouth','Bodmin','St Austell','Camborne','Redruth','Bude','Padstow','Looe','Liskeard'],
  'lake-district':['Kendal','Penrith','Keswick','Windermere','Ambleside','Cockermouth','Workington','Whitehaven','Carlisle','Barrow-in-Furness'],
  'jersey-iom':   ['St Helier','St Peter Port','Douglas','Castletown','Ramsey','Peel'],
};
const HOT_NICHES = [
  // Trades
  'barber','plumber','electrician','mechanic','tiler','painter-decorator','window-cleaner','gardener','cleaner','handyman','tree-surgeon','roofer','carpenter','locksmith','glazier','plasterer','scaffolder','bricklayer','heating-engineer','gas-engineer','damp-proofing','driveway-paver','fencing-contractor',
  // Beauty/health
  'beauty-salon','nail-salon','tattoo-studio','massage-therapist','hairdresser','aesthetics-clinic','wellbeing-coach','sports-massage','chiropractor','osteopath','podiatrist','reflexologist','acupuncturist','holistic-therapist',
  // Pet
  'dog-groomer','pet-groomer','dog-walker','dog-trainer','vet-small','pet-photographer','dog-boarding',
  // Pro services
  'solicitor-family','solicitor-conveyancing','accountant-small-business','bookkeeper','mortgage-broker','financial-adviser','will-writer','notary',
  // Creative
  'photographer-wedding','photographer-newborn','photographer-family','photographer-commercial','videographer','illustrator-freelance','calligrapher','jeweller-bespoke',
  // Hospitality / food
  'independent-cafe','independent-restaurant','butcher','baker','farm-shop','greengrocer','deli','wine-shop','micro-brewery','coffee-roaster','pub-independent','food-truck',
  // Health / kids
  'dentist-private','optician-independent','sports-physio','sports-club','dance-school','music-teacher','kids-party-entertainer','soft-play','swim-instructor','martial-arts-club',
  // Trades-adjacent
  'florist','wedding-planner','event-planner','removal-company','man-and-van','courier-local','signwriter','car-detailer','car-valeting',
  // Personal coaching / education
  'personal-trainer','yoga-teacher','pilates-studio','language-tutor','tutor','driving-instructor','life-coach',
];
const COLD_NICHES_BAN = [
  // Other web-people we never pitch to
  'web-design','web-designer','web-development','digital-agency','marketing-agency','seo-agency','branding-agency',
  // Mega/franchise that won't reply
  'tesco','asda','sainsburys','mcdonalds','starbucks','costa','nandos','greggs','boots','wh-smith','poundland','wilko','primark','iceland-store',
  // Outsized businesses with in-house teams
  'plc','holdings','group-ltd','international','enterprise-uk',
];
/* Excludes — applied post-discovery to drop "wrong-fit" prospects.
   Stored under ss_ap_excludes so user edits persist. */
const DEFAULT_EXCLUDES = {
  bizNameContains: ['ltd group','plc','holdings','franchise','international','llc inc','enterprise'],
  webDesignerKeywords: ['web design','web designer','digital agency','web studio','seo agency','marketing agency','branding studio','growth agency','wordpress agency'],
  bigBusinessSignals: ['national','nationwide','est. 19','>50 locations','headquartered','subsidiary of','part of the','group of companies'],
  excludeIfStaffOver: 25,
  excludeIfRevenueOver: 2000000,
  excludeIfFoundedBefore: 1960,
  excludeIfHasAppStoreLink: true,
};

function loadAutopilotConfig() {
  try {
    const raw = localStorage.getItem('ss_ap_config_v2');
    if (raw) return Object.assign({}, defaultConfig(), JSON.parse(raw));
  } catch (e) {}
  return defaultConfig();
}
function defaultConfig() {
  return {
    activeRegions: ['north-west', 'yorkshire', 'midlands-w'],
    activeNiches: HOT_NICHES.slice(0, 16),
    excludes: { ...DEFAULT_EXCLUDES },
    minDomainAgeYears: 2,
    maxDomainAgeYears: 40,
    onlyLtdCompanies: true,
    minScoreToContact: 0,
    maxScoreToContact: 65,
    skipIfHasNoMobile: false,
    rotateRegionsRandom: true,
    // Outreach automation toggles
    autoScan: true,
    autoQueue: true,
    autoSend: false,
    autoFollowup: true,
    autoArchive: true,
    maxSendsPerDay: 15,
    minGapMinutes: 8,
  };
}
function saveAutopilotConfig(cfg) {
  localStorage.setItem('ss_ap_config_v2', JSON.stringify(cfg));
}

function renderAutopilotConfigPanel() {
  const cfg = loadAutopilotConfig();
  const regionKeys = Object.keys(UK_REGIONS);
  let html = `
    <div class="ap-cfg" style="max-width:1100px;margin:0 auto;padding:1.5rem 1rem">
      <div style="margin-bottom:1.6rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <h2 style="font-family:'Boska',Georgia,serif;font-style:italic;font-size:2rem;margin:0 0 .4rem">Autopilot targeting</h2>
        <p style="color:var(--muted);font-size:.92rem;margin:0">Pick UK regions, niches to chase, and what to exclude. Saves to your browser. Active config gets used every cron tick.</p>
      </div>

      <section style="margin-bottom:2rem">
        <h3 style="font-family:monospace;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:var(--terr-deep,#7e4f37);margin:0 0 .8rem">UK regions to target</h3>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem">
          ${regionKeys.map(r => {
            const active = cfg.activeRegions.includes(r);
            const cities = UK_REGIONS[r].slice(0,3).join(', ');
            return `<button onclick="toggleApRegion('${r}')" style="padding:.5rem .85rem;border-radius:3px;border:1.5px solid ${active?'#0e0c0a':'var(--border)'};background:${active?'#0e0c0a':'transparent'};color:${active?'#faf7f1':'#0e0c0a'};cursor:pointer;font-family:monospace;font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600" title="${cities}…">${r}</button>`;
          }).join('')}
        </div>
        <p style="margin:.6rem 0 0;color:var(--muted);font-size:.78rem">Pick at least 1. Each tick rotates through one region/niche pair. Currently rotating ${cfg.activeRegions.length} regions × ${cfg.activeNiches.length} niches = ${cfg.activeRegions.length * cfg.activeNiches.length} target combos.</p>
      </section>

      <section style="margin-bottom:2rem">
        <h3 style="font-family:monospace;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:var(--terr-deep,#7e4f37);margin:0 0 .8rem">Niches to chase</h3>
        <div style="display:flex;flex-wrap:wrap;gap:.35rem;max-height:170px;overflow-y:auto;padding:.6rem;border:1px solid var(--border);border-radius:4px">
          ${HOT_NICHES.map(n => {
            const active = cfg.activeNiches.includes(n);
            return `<button onclick="toggleApNiche('${n}')" style="padding:.35rem .7rem;border-radius:3px;border:1px solid ${active?'#7e4f37':'var(--border)'};background:${active?'rgba(126,79,55,.12)':'white'};color:#0e0c0a;cursor:pointer;font-family:inherit;font-size:.78rem">${n.replace(/-/g,' ')}</button>`;
          }).join('')}
        </div>
      </section>

      <section style="margin-bottom:2rem">
        <h3 style="font-family:monospace;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:#c44;margin:0 0 .8rem">Excludes &mdash; never pitch these</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">
          <label style="display:block">
            <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Biz name contains (one per line)</span>
            <textarea id="ap-exc-biz" rows="4" style="width:100%;margin-top:.3rem;padding:.5rem;border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:.78rem">${cfg.excludes.bizNameContains.join('\n')}</textarea>
          </label>
          <label style="display:block">
            <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Web-designer signal words</span>
            <textarea id="ap-exc-webd" rows="4" style="width:100%;margin-top:.3rem;padding:.5rem;border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:.78rem">${cfg.excludes.webDesignerKeywords.join('\n')}</textarea>
          </label>
          <label style="display:block">
            <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Big-business signal phrases</span>
            <textarea id="ap-exc-big" rows="4" style="width:100%;margin-top:.3rem;padding:.5rem;border:1px solid var(--border);border-radius:3px;font-family:monospace;font-size:.78rem">${cfg.excludes.bigBusinessSignals.join('\n')}</textarea>
          </label>
        </div>
      </section>

      <section style="margin-bottom:2rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">
        <label style="display:flex;flex-direction:column;gap:.3rem">
          <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Min domain age (years)</span>
          <input type="number" id="ap-min-age" value="${cfg.minDomainAgeYears}" min="0" max="40" style="padding:.5rem;border:1px solid var(--border);border-radius:3px">
        </label>
        <label style="display:flex;flex-direction:column;gap:.3rem">
          <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Max domain age (years)</span>
          <input type="number" id="ap-max-age" value="${cfg.maxDomainAgeYears}" min="0" max="60" style="padding:.5rem;border:1px solid var(--border);border-radius:3px">
        </label>
        <label style="display:flex;flex-direction:column;gap:.3rem">
          <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Audit score min</span>
          <input type="number" id="ap-min-score" value="${cfg.minScoreToContact}" min="0" max="100" style="padding:.5rem;border:1px solid var(--border);border-radius:3px">
        </label>
        <label style="display:flex;flex-direction:column;gap:.3rem">
          <span style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Audit score max (skip if too good)</span>
          <input type="number" id="ap-max-score" value="${cfg.maxScoreToContact}" min="0" max="100" style="padding:.5rem;border:1px solid var(--border);border-radius:3px">
        </label>
      </section>

      <section style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;margin-bottom:2rem">
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-only-ltd" ${cfg.onlyLtdCompanies?'checked':''}> <span>PECR-safe only (Ltd companies)</span></label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-rotate" ${cfg.rotateRegionsRandom?'checked':''}> <span>Randomise region order</span></label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-skip-nomobile" ${cfg.skipIfHasNoMobile?'checked':''}> <span>Skip if site has no mobile menu</span></label>
      </section>

      <section style="margin-bottom:2rem">
        <h3 style="font-family:monospace;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:var(--terr-deep,#7e4f37);margin:0 0 .8rem;display:flex;justify-content:space-between;align-items:center">
          <span>Active target combos <span style="background:#0e0c0a;color:#faf7f1;padding:.1rem .5rem;font-size:.7rem;letter-spacing:.1em;margin-left:.5rem">${(typeof autopilotTargets!=='undefined'?autopilotTargets.length:0)} configured</span></span>
          <button onclick="clearAllApTargets()" style="background:#c44;color:white;border:0;border-radius:2px;padding:.35rem .75rem;cursor:pointer;font-family:monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase">Clear all targets</button>
        </h3>
        <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;background:#faf7f1">
          ${(typeof autopilotTargets!=='undefined' && autopilotTargets.length ? autopilotTargets.map((t,i)=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem .85rem;border-bottom:1px solid rgba(0,0,0,.06);font-size:.84rem">
              <div style="display:flex;gap:.8rem;align-items:center;min-width:0;flex:1">
                <span style="font-family:monospace;color:var(--muted);font-size:.7rem;letter-spacing:.06em;flex:0 0 32px">#${(i+1).toString().padStart(3,'0')}</span>
                <span style="font-weight:600;color:#0e0c0a;text-transform:capitalize">${escapeHTML(t.niche.replace(/-/g,' '))}</span>
                <span style="color:#999">in</span>
                <span style="color:#0e0c0a">${escapeHTML(t.area)}</span>
                ${t.region?`<span style="background:rgba(126,79,55,.1);color:#7e4f37;padding:.12rem .45rem;border-radius:2px;font-family:monospace;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase">${escapeHTML(t.region)}</span>`:''}
              </div>
              <button onclick="deleteApTarget(${i})" title="Delete this target" style="background:transparent;border:0;color:#c44;cursor:pointer;font-size:1.15rem;padding:.15rem .55rem;line-height:1">&times;</button>
            </div>
          `).join('') : '<div style="padding:2rem;text-align:center;color:var(--muted);font-style:italic">No target combos yet. Pick regions + niches above and hit <strong>Rebuild target rotation</strong>.</div>')}
        </div>
      </section>

      <section style="margin-bottom:2rem;padding:1rem 1.2rem;background:rgba(126,79,55,.06);border-left:3px solid #7e4f37;border-radius:0 4px 4px 0">
        <h3 style="font-family:monospace;font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:#7e4f37;margin:0 0 .55rem">Outreach automation</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem;font-size:.84rem">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-auto-scan" ${cfg.autoScan?'checked':''}> Auto-scan new prospects on add</label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-auto-queue" ${cfg.autoQueue?'checked':''}> Auto-queue scored prospects (40-65) for sequence</label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-auto-send" ${cfg.autoSend?'checked':''}> Auto-send drafts during business hours (Tue&ndash;Thu 9-12)</label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-auto-followup" ${cfg.autoFollowup?'checked':''}> Auto-follow-up 4 days after no-reply</label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="ap-auto-archive" ${cfg.autoArchive?'checked':''}> Auto-archive stale prospects (no reply, 21 days)</label>
        </div>
        <div style="display:flex;gap:.6rem;margin-top:.9rem;align-items:center;flex-wrap:wrap">
          <label style="font-size:.78rem;color:var(--muted)">Max sends/day:</label>
          <input type="number" id="ap-max-sends-day" min="1" max="100" value="${cfg.maxSendsPerDay||15}" style="width:70px;padding:.35rem;border:1px solid var(--border);border-radius:3px">
          <label style="font-size:.78rem;color:var(--muted);margin-left:.8rem">Min gap (min):</label>
          <input type="number" id="ap-min-gap" min="1" max="120" value="${cfg.minGapMinutes||8}" style="width:70px;padding:.35rem;border:1px solid var(--border);border-radius:3px">
        </div>
      </section>

      <div style="display:flex;gap:.6rem;flex-wrap:wrap;padding-top:1rem;border-top:1px solid var(--border)">
        <button onclick="saveAutopilotConfigFromUi()" style="padding:.75rem 1.5rem;background:#0e0c0a;color:#faf7f1;border:0;border-radius:3px;cursor:pointer;font-family:monospace;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700">Save targeting</button>
        <button onclick="rebuildApTargetsFromConfig()" style="padding:.75rem 1.5rem;background:#7e4f37;color:#faf7f1;border:0;border-radius:3px;cursor:pointer;font-family:monospace;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700">Save + Rebuild rotation</button>
        <button onclick="addManualApTarget()" style="padding:.75rem 1.2rem;background:transparent;border:1px solid #0e0c0a;color:#0e0c0a;border-radius:3px;cursor:pointer;font-family:monospace;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700">+ Add single target</button>
        <button onclick="resetAutopilotConfig()" style="padding:.75rem 1.2rem;background:transparent;border:1px solid #c44;color:#c44;border-radius:3px;cursor:pointer;font-family:monospace;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700">Reset to defaults</button>
      </div>
    </div>`;
  return html;
}
function deleteApTarget(i) {
  if (typeof autopilotTargets === 'undefined' || !autopilotTargets[i]) return;
  autopilotTargets.splice(i, 1);
  if (typeof saveAutopilotState === 'function') saveAutopilotState();
  showAutopilotConfig();
}
function clearAllApTargets() {
  if (!confirm('Clear ALL ' + (autopilotTargets?.length || 0) + ' target combos? Discover worker will idle until you rebuild.')) return;
  if (typeof autopilotTargets !== 'undefined') autopilotTargets.length = 0;
  if (typeof saveAutopilotState === 'function') saveAutopilotState();
  showAutopilotConfig();
}
function addManualApTarget() {
  const niche = prompt('Niche (e.g. "barber" or "pet-groomer"):');
  if (!niche) return;
  const area = prompt('Area / town (e.g. "Manchester" or "Bromley"):');
  if (!area) return;
  if (typeof autopilotTargets === 'undefined') return;
  autopilotTargets.unshift({ niche: niche.trim().toLowerCase(), area: area.trim(), country: 'UK', region: 'manual' });
  if (typeof saveAutopilotState === 'function') saveAutopilotState();
  showAutopilotConfig();
}
function toggleApRegion(r) {
  const cfg = loadAutopilotConfig();
  const i = cfg.activeRegions.indexOf(r);
  if (i >= 0) cfg.activeRegions.splice(i, 1); else cfg.activeRegions.push(r);
  saveAutopilotConfig(cfg);
  showAutopilotConfig();
}
function toggleApNiche(n) {
  const cfg = loadAutopilotConfig();
  const i = cfg.activeNiches.indexOf(n);
  if (i >= 0) cfg.activeNiches.splice(i, 1); else cfg.activeNiches.push(n);
  saveAutopilotConfig(cfg);
  showAutopilotConfig();
}
function saveAutopilotConfigFromUi() {
  const cfg = loadAutopilotConfig();
  cfg.excludes.bizNameContains      = document.getElementById('ap-exc-biz').value.split('\n').map(s=>s.trim()).filter(Boolean);
  cfg.excludes.webDesignerKeywords  = document.getElementById('ap-exc-webd').value.split('\n').map(s=>s.trim()).filter(Boolean);
  cfg.excludes.bigBusinessSignals   = document.getElementById('ap-exc-big').value.split('\n').map(s=>s.trim()).filter(Boolean);
  cfg.minDomainAgeYears   = +document.getElementById('ap-min-age').value || 0;
  cfg.maxDomainAgeYears   = +document.getElementById('ap-max-age').value || 40;
  cfg.minScoreToContact   = +document.getElementById('ap-min-score').value || 0;
  cfg.maxScoreToContact   = +document.getElementById('ap-max-score').value || 100;
  cfg.onlyLtdCompanies    = document.getElementById('ap-only-ltd').checked;
  cfg.rotateRegionsRandom = document.getElementById('ap-rotate').checked;
  cfg.skipIfHasNoMobile   = document.getElementById('ap-skip-nomobile').checked;
  // Automation toggles
  const t = (id, key) => { const el = document.getElementById(id); if (el) cfg[key] = el.checked; };
  t('ap-auto-scan', 'autoScan');
  t('ap-auto-queue', 'autoQueue');
  t('ap-auto-send', 'autoSend');
  t('ap-auto-followup', 'autoFollowup');
  t('ap-auto-archive', 'autoArchive');
  const md = document.getElementById('ap-max-sends-day'); if (md) cfg.maxSendsPerDay = +md.value || 15;
  const mg = document.getElementById('ap-min-gap'); if (mg) cfg.minGapMinutes = +mg.value || 8;
  saveAutopilotConfig(cfg);
  // Visual confirmation in-modal instead of alert
  const note = document.createElement('div');
  note.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:#0e0c0a;color:#faf7f1;padding:.6rem 1.4rem;border-radius:3px;font-family:monospace;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.3)';
  note.textContent = '✓ Targeting saved';
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 1800);
}
function rebuildApTargetsFromConfig() {
  const cfg = loadAutopilotConfig();
  if (!cfg.activeRegions.length || !cfg.activeNiches.length) {
    alert('Pick at least 1 region and 1 niche.');
    return;
  }
  if (typeof autopilotTargets === 'undefined') {
    alert('Autopilot module not initialised yet. Open the autopilot tab once, then try again.');
    return;
  }
  autopilotTargets.length = 0; // clear in place
  cfg.activeRegions.forEach(region => {
    const cities = UK_REGIONS[region];
    cfg.activeNiches.forEach((niche, idx) => {
      const city = cities[idx % cities.length];
      autopilotTargets.push({ niche, area: city, country: 'UK', region });
    });
  });
  if (cfg.rotateRegionsRandom) {
    for (let i = autopilotTargets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [autopilotTargets[i], autopilotTargets[j]] = [autopilotTargets[j], autopilotTargets[i]];
    }
  }
  if (typeof saveAutopilotState === 'function') saveAutopilotState();
  if (typeof renderAutopilotTargets === 'function') renderAutopilotTargets();
  alert('Rebuilt ' + autopilotTargets.length + ' target combinations (' + cfg.activeRegions.length + ' regions × ' + cfg.activeNiches.length + ' niches).');
}
function resetAutopilotConfig() {
  if (!confirm('Reset all autopilot targeting + excludes to defaults?')) return;
  localStorage.removeItem('ss_ap_config_v2');
  showAutopilotConfig();
}
function showAutopilotConfig() {
  let host = document.getElementById('ap-config-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ap-config-modal';
    host.style.cssText = 'position:fixed;inset:1rem;background:#faf7f1;border:2px solid #0e0c0a;border-radius:6px;overflow:auto;z-index:99999';
    host.innerHTML = '<button onclick="document.getElementById(\'ap-config-modal\').remove()" style="position:sticky;top:1rem;float:right;margin:1rem;padding:.4rem .8rem;background:#0e0c0a;color:#faf7f1;border:0;cursor:pointer;font-family:monospace;letter-spacing:.1em;text-transform:uppercase">CLOSE ✕</button>' + renderAutopilotConfigPanel();
    document.body.appendChild(host);
    return;
  }
  host.innerHTML = renderAutopilotConfigPanel();
}

/* Filter helper applied during prospect ingestion — pure exclude pass.
   Returns true if prospect should be DROPPED. Wire into autopilot worker
   if you want strict server-side filtering too. */
window.ssShouldExcludeProspect = function(p) {
  const cfg = loadAutopilotConfig();
  const lower = (s) => (s || '').toString().toLowerCase();
  const name = lower(p.bizname || p.name);
  const site = lower(p.website || p.url);
  const desc = lower(p.description || p.bio || '');
  const hay  = name + ' | ' + site + ' | ' + desc;
  if (cfg.excludes.bizNameContains.some(w => name.includes(lower(w)))) return 'name match';
  if (cfg.excludes.webDesignerKeywords.some(w => hay.includes(lower(w)))) return 'web-designer';
  if (cfg.excludes.bigBusinessSignals.some(w => hay.includes(lower(w)))) return 'big business';
  if (p.staffCount && p.staffCount > cfg.excludes.excludeIfStaffOver) return 'too many staff';
  if (p.annualRevenue && p.annualRevenue > cfg.excludes.excludeIfRevenueOver) return 'revenue too high';
  if (p.founded && p.founded < cfg.excludes.excludeIfFoundedBefore) return 'founded too early';
  return false;
};

['showAutopilotConfig','toggleApRegion','toggleApNiche','saveAutopilotConfigFromUi','rebuildApTargetsFromConfig','resetAutopilotConfig','deleteApTarget','clearAllApTargets','addManualApTarget']
  .forEach(fn => { try { if (typeof eval(fn) === 'function') window[fn] = eval(fn); } catch(e){} });
