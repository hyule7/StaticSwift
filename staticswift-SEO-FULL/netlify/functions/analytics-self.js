/**
 * analytics-self.js — Admin endpoint that reads the self-hosted analytics
 * stored by track-event.js and returns aggregated stats. No GA tag needed.
 *
 * Query: ?days=7 (default 30, max 90)
 */
const { getNamedStore } = require('./_blobs');

exports.handler = async (event) => {
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD;
  if (!validPw || auth !== validPw) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const days = Math.min(Math.max(parseInt(event.queryStringParameters?.days || '30'), 1), 90);
    const store = getNamedStore('analytics');
    if (!store) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Netlify Blobs not configured. Set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN env vars.', days: [], totals: { events: 0, sessions: 0, visitors: 0 } }) };
    }

    const now = Date.now();
    const today = new Date();
    const dayKeys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }

    const buckets = await Promise.all(
      dayKeys.map(k =>
        store.get(k, { type: 'json' }).catch(() => [])
      )
    );

    /** @type {any[]} */
    const events = [];
    buckets.forEach(b => { if (Array.isArray(b)) events.push(...b); });

    // ── Aggregations ──────────────────────────────────────────────────
    const pageviews = events.filter(e => e.type === 'pageview');
    const uniqueVisitors = new Set(pageviews.map(e => e.vid));
    const uniqueSessions = new Set(pageviews.map(e => e.sid));

    // Live (last 5 minutes)
    const FIVE_MIN = 5 * 60 * 1000;
    const live = pageviews.filter(e => now - e.t < FIVE_MIN);

    // Today
    const todayStr = today.toISOString().slice(0, 10);
    const todayEvents = pageviews.filter(e => new Date(e.t).toISOString().startsWith(todayStr));

    // Average duration (from timing events)
    const durations = events.filter(e => (e.type === 'timing' || e.type === 'duration') && e.dur > 0).map(e => e.dur);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length / 1000)
      : 0;

    // Bounce rate = sessions with only one pageview / total sessions
    const sessionPageCount = {};
    pageviews.forEach(e => { sessionPageCount[e.sid] = (sessionPageCount[e.sid] || 0) + 1; });
    const sessionCount = Object.keys(sessionPageCount).length;
    const bouncedSessions = Object.values(sessionPageCount).filter(c => c === 1).length;
    const bounceRate = sessionCount ? Math.round((bouncedSessions / sessionCount) * 100) : 0;

    // Top pages
    const pageMap = {};
    pageviews.forEach(e => {
      const path = e.path || '/';
      if (!pageMap[path]) pageMap[path] = { path, views: 0, visitors: new Set() };
      pageMap[path].views++;
      pageMap[path].visitors.add(e.vid);
    });
    const topPages = Object.values(pageMap)
      .map(p => ({ path: p.path, views: p.views, visitors: p.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    // Top referrers (excluding own host)
    const refMap = {};
    pageviews.forEach(e => {
      if (!e.ref) return;
      let host;
      try { host = new URL(e.ref).hostname.replace(/^www\./, ''); }
      catch { return; }
      if (host && !host.includes('staticswift')) {
        refMap[host] = (refMap[host] || 0) + 1;
      }
    });
    const topReferrers = Object.entries(refMap)
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Direct vs referred
    const directCount = pageviews.filter(e => !e.ref).length;
    const referredCount = pageviews.length - directCount;

    // Countries
    const countryMap = {};
    pageviews.forEach(e => {
      const c = e.country || 'Unknown';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });
    const countries = Object.entries(countryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Devices (rough parse from UA)
    const deviceMap = { Mobile: 0, Tablet: 0, Desktop: 0 };
    pageviews.forEach(e => {
      const ua = (e.ua || '').toLowerCase();
      if (/iphone|android(?!.*tablet)|mobi/i.test(ua)) deviceMap.Mobile++;
      else if (/ipad|tablet/i.test(ua)) deviceMap.Tablet++;
      else deviceMap.Desktop++;
    });

    // Browsers
    const browserMap = {};
    pageviews.forEach(e => {
      const ua = e.ua || '';
      let b = 'Other';
      if (/Edg\//.test(ua)) b = 'Edge';
      else if (/Chrome\//.test(ua) && !/Edg/.test(ua)) b = 'Chrome';
      else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) b = 'Safari';
      else if (/Firefox\//.test(ua)) b = 'Firefox';
      browserMap[b] = (browserMap[b] || 0) + 1;
    });
    const browsers = Object.entries(browserMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Daily series (last N days)
    const seriesMap = {};
    dayKeys.forEach(k => { seriesMap[k] = { date: k, views: 0, visitors: new Set() }; });
    pageviews.forEach(e => {
      const k = new Date(e.t).toISOString().slice(0, 10);
      if (!seriesMap[k]) return;
      seriesMap[k].views++;
      seriesMap[k].visitors.add(e.vid);
    });
    const series = dayKeys
      .map(k => ({ date: k, views: seriesMap[k].views, visitors: seriesMap[k].visitors.size }))
      .reverse(); // chronological

    // Conversion events.
    // BUG FIX: previously this filter looked for `type === 'event'` and exact
    // evt names `form_submit` / `cta_click` — but the in-page tracker emits
    // `type: 'step'` with `evt: 'submit:<formId>'` and `evt: 'click:<label>'`,
    // and ALSO (after the patch in index.html) `type: 'event'` rows with the
    // canonical names. Counting both keeps old + new analytics buckets honest.
    const formSubmits =
      events.filter(e => e.type === 'event' && e.evt === 'form_submit').length +
      events.filter(e => e.type === 'step' && typeof e.evt === 'string' && e.evt.startsWith('submit:')).length;

    // CTA clicks: dedupe by session so a user mashing the same button doesn't
    // inflate the number. A "real" CTA click is anything with the click: prefix
    // OR an explicit type:'event' evt:'cta_click' ping.
    const ctaSessionPairs = new Set();
    events.forEach(e => {
      if (e.type === 'event' && e.evt === 'cta_click' && e.sid) ctaSessionPairs.add(e.sid + '|' + (e.path || '') + '|cta');
      else if (e.type === 'step' && typeof e.evt === 'string' && e.evt.startsWith('click:') && e.sid)
        ctaSessionPairs.add(e.sid + '|' + e.evt);
    });
    const ctaClicks = ctaSessionPairs.size;

    // ── Journey + step aggregations ──────────────────────────────────
    // Top sections viewed
    const sectionMap = {};
    events.filter(e => e.type === 'step' && (e.evt || '').startsWith('view:')).forEach(e => {
      const sec = e.evt.slice(5);
      sectionMap[sec] = (sectionMap[sec] || 0) + 1;
    });
    const topSections = Object.entries(sectionMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 12);

    // Top CTA clicks
    const ctaMap = {};
    events.filter(e => e.type === 'step' && (e.evt || '').startsWith('click:')).forEach(e => {
      const lbl = e.evt.slice(6).slice(0, 60);
      ctaMap[lbl] = (ctaMap[lbl] || 0) + 1;
    });
    const topCtas = Object.entries(ctaMap).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count).slice(0, 12);

    // Conversion funnel: count of unique sessions that hit each major step
    const sessionSteps = {};
    events.filter(e => e.type === 'step' || e.type === 'pageview' || e.type === 'event').forEach(e => {
      if (!sessionSteps[e.sid]) sessionSteps[e.sid] = new Set();
      if (e.type === 'pageview') sessionSteps[e.sid].add('Visited');
      else if (e.evt) sessionSteps[e.sid].add(e.evt);
    });
    // Stages are strictly ordered and counted per unique session. Every key
    // here is an event the shared data-ss-tracker actually emits today;
    // stages from retired homepage versions (view:hero, conversion:*) were
    // producing impossible numbers and are gone.
    const funnelStages = [
      { keys: ['Visited'], label: 'Visited site' },
      { keys: ['whatsapp_click', 'tel_click', 'form_submit'], label: 'Took a contact action' },
      { keys: ['form_submit'], label: 'Submitted a form' },
    ];
    // Enforce funnel monotonicity: a session only counts at stage N if it
    // also counted at every earlier stage, so no step can ever exceed 100%
    // of the one before it.
    let eligible = Object.values(sessionSteps);
    const funnel = funnelStages.map(stage => {
      eligible = eligible.filter(set => stage.keys.some(k => set.has(k)));
      return { label: stage.label, key: stage.keys[0], count: eligible.length };
    });

    // Recent visitor journeys (last 25 unique sessions with their step sequence)
    const sessionEvents = {};
    events.forEach(e => {
      if (!e.sid) return;
      if (!sessionEvents[e.sid]) sessionEvents[e.sid] = [];
      sessionEvents[e.sid].push(e);
    });
    const recentJourneys = Object.entries(sessionEvents)
      .map(([sid, evts]) => {
        evts.sort((a, b) => a.t - b.t);
        return {
          sid: sid.slice(0, 10),
          firstSeen: evts[0]?.t,
          lastSeen: evts[evts.length - 1]?.t,
          country: evts[0]?.country || 'Unknown',
          path: evts[0]?.path || '/',
          ref: (() => { try { return evts[0]?.ref ? new URL(evts[0].ref).hostname.replace(/^www\./,'') : 'direct'; } catch { return 'direct'; } })(),
          steps: evts
            .filter(e => e.type === 'step' || e.type === 'pageview' || e.type === 'unload')
            .slice(0, 30)
            .map(e => ({ at: e.t, evt: e.evt || e.type, type: e.type })),
          converted: evts.some(e => (e.evt || '').startsWith('conversion:')),
        };
      })
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 25);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        rangeDays: days,
        overview: {
          pageviews: pageviews.length,
          visitors: uniqueVisitors.size,
          sessions: uniqueSessions.size,
          avgDuration,
          bounceRate,
          live: live.length,
          today: todayEvents.length,
          formSubmits,
          ctaClicks,
        },
        topPages,
        topReferrers,
        traffic: { direct: directCount, referred: referredCount },
        geoSplit: {
          uk: pageviews.filter(e => /united kingdom|^gb$|^uk$/i.test(e.country || '')).length,
          nonUk: pageviews.filter(e => e.country && !/united kingdom|^gb$|^uk$/i.test(e.country)).length,
          unknown: pageviews.filter(e => !e.country).length,
        },
        countries,
        devices: Object.entries(deviceMap).map(([name, count]) => ({ name, count })),
        browsers,
        series,
        topSections,
        topCtas,
        funnel,
        recentJourneys,
      }),
    };
  } catch (err) {
    console.error('[analytics-self] error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
