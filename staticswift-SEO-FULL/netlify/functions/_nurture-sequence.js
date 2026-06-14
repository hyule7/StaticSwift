/*
 * _nurture-sequence.js — the 5-email sequence for captured non-buyers.
 *
 * Plain text, from Harry, Field Guide voice. No marketing-blast formatting,
 * no em dashes, every figure traced to data/facts.json. Sent over 14 days.
 * State lives on the db.nurture record (sentSteps array) so a record is
 * never emailed the same step twice.
 *
 * Step schedule (days since signup): the welcome email is step 0 and is sent
 * synchronously by nurture-signup.js, so this engine handles steps 1 to 4.
 */

const facts = {
  build: 499, monthly: 49, previewHours: 24, buildDays: 14, guaranteeDays: 60,
  whatsapp: '+447502731799', whatsappDisplay: '07502 731 799', email: 'hello@staticswift.co.uk',
};

// firstName helper
const fn = (name) => (name && name.trim()) ? name.trim().split(/\s+/)[0] : 'there';

// Each step: { day, subject, body(ctx) } where ctx = { name, unsub }
const STEPS = [
  {
    day: 3,
    subject: 'The cost of a quiet phone',
    body: (c) => `Hi ${fn(c.name)},

A quick one. The trades who call me are rarely short of skill. They are short of the right calls landing at the right time.

Here is the maths that made me start StaticSwift. One job a month missed because a customer searched, found a competitor first, and never saw you. Say that job is worth a few hundred pounds. Over a year that is thousands walking past your door to someone whose only advantage was being easier to find.

A website does not fix everything. It fixes that one thing, and that one thing compounds.

If you want to see what yours could look like, reply with your business name and town. Free working preview in ${facts.previewHours} hours, no card.

Harry
StaticSwift, Manchester
${facts.whatsappDisplay}

Not for you? Unsubscribe: ${c.unsub}`,
  },
  {
    day: 6,
    subject: 'One I built for an electrician in Bristol',
    body: (c) => `Hi ${fn(c.name)},

Rather than tell you it works, here is one I built: Harrison Electrical in Bristol. NICEIC electrician, hand-coded five-page site, his registration and reviews where a nervous customer sees them first, click-to-call in the thumb zone.

You can look at it here: https://staticswift.co.uk/work/harrison-electrical/

Same approach for every trade. No templates, no page builders, no agency middlemen. One developer who writes the whole thing by hand.

If you want yours, reply with your business name and town. Preview in ${facts.previewHours} hours, ${facts.build} pounds only if you keep it.

Harry
StaticSwift, Manchester

Not for you? Unsubscribe: ${c.unsub}`,
  },
  {
    day: 10,
    subject: 'How the guarantee actually works',
    body: (c) => `Hi ${fn(c.name)},

People assume there is a catch, so here is the whole clause with no asterisk.

I build your site. If it does not bring you a lead within ${facts.guaranteeDays} days of going live, you get the full ${facts.build} pounds back. And you keep the site.

That is it. I carry the risk, not you, because I would rather build sites that work than argue with people about refunds. It also keeps me honest: if your trade or your town will not convert, I will tell you before you pay, not after.

Reply with your business name and town if you want to start. Preview in ${facts.previewHours} hours, no card.

Harry
StaticSwift, Manchester
${facts.whatsappDisplay}

Not for you? Unsubscribe: ${c.unsub}`,
  },
  {
    day: 14,
    subject: 'Last note from me',
    body: (c) => `Hi ${fn(c.name)},

This is the last email I will send unless you reply, so I will keep it short.

The offer does not change: a real working preview of your website within ${facts.previewHours} hours, free, no card. ${facts.build} pounds once if you keep it, live within ${facts.buildDays} days. Optional ${facts.monthly} pounds a month only if you want me to manage it. First lead in ${facts.guaranteeDays} days or your money back.

If the timing is wrong, no problem, I will not pester you. If it is right, just reply with your business name and town and I will get started tonight.

Either way, thanks for the look.

Harry
StaticSwift, Manchester
${facts.whatsappDisplay}

Not for you? Unsubscribe: ${c.unsub}`,
  },
];

module.exports = { STEPS, facts };
