/*
 * _blitz-roster.js — builds the "everyone on task" activity feed for a blitz.
 *
 * Returns one agent-log entry for EVERY role in data/org.json so the whole
 * company lights up green on the board. The revenue desks get specific lines
 * with live counts (scavenged / enriched / drafted / replies); the rest get a
 * department task. Shared by trigger-shift (the button) and cron-blitz-tick
 * (the server heartbeat) so the board stays lit for the whole blitz window.
 */
let ORG = [];
try { ORG = require('../../data/org.json').departments.map(d => [d.dept, d.roles]); } catch (_) { ORG = []; }

const DEPT_TASK = {
  'Executive': 'Steering the blitz and clearing blockers',
  'Chief of Staff': 'Coordinating every desk on the sprint',
  'Business Development': 'Hunting and qualifying fresh prospects',
  'Customer Service': 'Watching the inbox so nothing waits',
  'Design Studio': 'Polishing previews and page design',
  'Client Success': 'Looking after live clients and chasing reviews',
  'Growth & Conversion': 'Working the funnel and every hot lead',
  'Analytics & Data': 'Reading live numbers for the next move',
  'Marketing': 'Pushing the brand and content out',
  'Creative Production': 'Producing fresh creative in the brand style',
  'Search': 'Pushing winnable pages up the rankings',
  'Operations & Finance': 'Keeping the pipeline and sends flowing',
  'Finance': 'Tracking revenue against the plan',
  'Quality & Risk': 'Checking work against the facts and the voice',
  'Partnerships & Referrals': 'Chasing referral and partner leads',
  'Legal & Admin': 'Keeping every send compliant',
  'Resilience': 'Watching the systems stay up',
  'Technical': 'Keeping the site fast and live',
};

// counts: { scavenged, enriched, drafted, replies, queued } (any may be undefined)
function buildEntries(counts) {
  const c = counts || {};
  const SPECIFIC = {
    'Companies House Watcher': ['Scanning Companies House for brand-new UK trade companies', 'fresh prospects'],
    'Website Checker': [c.scavenged ? ('Scavenged ' + c.scavenged + ' businesses with bad or no websites') : 'Hunting businesses with weak websites across the UK', 'full web sweep'],
    'Contact Finder': [c.enriched ? ('Found ' + c.enriched + ' new email contacts') : 'Digging out contact details', 'published + MX-verified'],
    'Writer': [c.drafted ? ('Drafted ' + c.drafted + ' personalised emails into the queue') : 'Drafting personalised first emails', 'hottest first'],
    'Preview Builder': ['Building cinematic one-page previews for the top prospects', 'I already built you this'],
    'Lead Reactivation Specialist': ['Re-engaging warm leads whose follow-up is due today', 'on a real cadence, never all at once'],
    'Sales Closer': ['On the inbox for every hot reply', 'answering within minutes'],
    'Reply Triage Specialist': [c.replies ? ('Drafted ' + c.replies + ' replies to inbound leads') : 'Reading every inbound reply and routing the hot ones', 'interested / objection / stop'],
    'Affiliate Recruiter': [c.partners ? ('Recruited ' + c.partners + ' commission-only partners') : 'Reaching out to accountants, suppliers and creators to refer us', 'commission only, no cost'],
    'Link Building Agent': [c.backlinksDone != null ? ('Prepared backlinks: ' + c.backlinksDone + '/' + (c.backlinksTotal || 22) + ' targets ready to submit') : 'Building the backlink checklist with paste-ready listings', 'real citations + agency directories, no spam'],
    'Proposal Writer': ['Turning interested replies into proposals', '499 pounds once, preview in 24h'],
    'Payment Chaser': ['Chasing any unpaid invoices, gently and on schedule', ''],
    'Invoice Drafter': ['Prepping invoices for anyone who says yes', ''],
    'Fact Checker': ['Checking every drafted message against the facts and the voice', ''],
    'CEO Agent': ['BLITZ ordered: all hands, one goal, a sale today', c.queued ? (c.queued + ' in the approval queue') : 'sprint running'],
  };
  const entries = [];
  for (const [dept, roles] of ORG) {
    for (const role of roles) {
      const sp = SPECIFIC[role];
      entries.push({ role, dept, action: sp ? sp[0] : (DEPT_TASK[dept] || ('On the blitz with ' + dept)), detail: sp ? sp[1] : '' });
    }
  }
  return entries;
}

module.exports = { buildEntries, ORG, DEPT_TASK };
