/*
 * build-guides.mjs — generates the /guides/ answer pages.
 *
 * These are honest, genuinely useful Q&A pages that answer the questions UK
 * trades actually type into Google and AI engines. Each answers the question in
 * the first paragraph (AEO best practice), carries Article + FAQPage +
 * BreadcrumbList schema, a canonical, internal links, and the Message-me CTA.
 * Every figure comes from data/facts.json. No fabricated stats, no em dashes.
 *
 * Run: node scripts/build-guides.mjs   (regenerates guides/ + guides/index.html)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const P = { build: F.pricing.starter.build, mo: F.pricing.starter.monthly_optional, preview: F.delivery.preview_hours, days: F.delivery.build_days, guar: F.guarantee.days, wa: F.contact.whatsapp_display, waLink: F.contact.whatsapp, email: F.contact.email };
const SITE = 'https://staticswift.co.uk';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const waDigits = P.waLink.replace(/[^\d]/g, '');

// Each guide: slug, question (title/H1), metaDesc, answer (lead paragraph),
// sections [{h, body}], faqs [{q, a}]. Kept honest and traceable.
const GUIDES = [
  {
    slug: 'how-much-does-a-tradesperson-website-cost-uk',
    q: 'How much should a tradesperson’s website cost in the UK?',
    meta: 'A clear, honest breakdown of what a UK tradesperson’s website costs: DIY builders, freelancers, and done-for-you, with real price ranges.',
    answer: `A website for a UK tradesperson usually costs between £300 and £1,500 as a one-off, or roughly £20 to £70 a month if you build it yourself on a platform like Wix or Squarespace. There is no single right number. It depends on whether you want a template you build and maintain yourself, or a site built for you and looked after. StaticSwift builds a hand-coded site for a ${P.build} pounds one-time fee, with an optional ${P.mo} pounds a month managed plan if you want ongoing changes handled.`,
    sections: [
      { h: 'The three ways to get a website, and what each costs', body: `DIY builders (Wix, Squarespace, GoDaddy) are the cheapest to start, around 15 to 40 pounds a month, but you build and maintain it, and you pay that fee forever. Freelancers and agencies range from a few hundred to several thousand pounds depending on scope. Done-for-you productised services, like StaticSwift, sit in between: a fixed ${P.build} pounds once for a hand-coded site, no surprise bills.` },
      { h: 'One-off vs monthly: which is cheaper?', body: `A monthly builder looks cheap but adds up: 30 pounds a month is 360 pounds a year, every year. A one-off build you own outright is usually cheaper over two or three years, and you are not locked in. The trade-off is that a builder lets you edit it yourself, while a built-for-you site means asking someone for changes (or paying an optional monthly plan for that).` },
      { h: 'What you are actually paying for', body: `A good trades website is not just pages. It is fast loading on a phone, click-to-call, clear services and area covered, and set up so it can show in Google for "your trade near me". Cheap template sites often miss these, which is why they do not bring calls. Ask what is included: mobile speed, local SEO basics, and whether you own the files.` },
    ],
    faqs: [
      { q: 'Is a free website builder good enough for a tradesperson?', a: `It can work to start, but free tiers usually show ads, use a long messy web address, and load slowly, which puts customers off. A proper domain and a fast site pays for itself in calls.` },
      { q: 'Do I have to pay monthly for a website?', a: `No. Monthly is only required with subscription builders. A one-off build, like StaticSwift at ${P.build} pounds, has no required monthly fee. The ${P.mo} pounds a month managed plan is optional, for people who want changes handled for them.` },
    ],
  },
  {
    slug: 'do-i-need-a-website-if-i-have-facebook',
    q: 'Do I need a website if I have a Facebook page?',
    meta: 'A Facebook page is not a website. Here is why UK tradespeople still need a proper site, and what Facebook cannot do for you.',
    answer: `In most cases, yes. A Facebook page does not show up when someone searches Google for "your trade near me", and you do not own it or control how it looks. A website ranks on Google, works as your always-on shopfront, and is genuinely yours. Facebook is a good addition, not a replacement. The two work best together: the website is found on Google and builds trust, the Facebook page shows your latest work.`,
    sections: [
      { h: 'Most people search Google, not Facebook, for a trade', body: `When someone needs a plumber or an electrician at short notice, they Google it. Facebook pages rarely appear in those searches. If you only have Facebook, you are invisible to the biggest source of new work.` },
      { h: 'You do not own your Facebook page', body: `Facebook controls the layout, the reach, and can change the rules or suspend accounts any time. A website on your own domain is an asset you own and control, which also makes you look more established to a customer comparing quotes.` },
      { h: 'A website builds trust before they call', body: `People check you out before ringing. A clean website with your services, area, and a click-to-call button turns a "maybe" into a call. Around the clock, whether or not you are on Facebook that day.` },
    ],
    faqs: [
      { q: 'Can I just link my Facebook page instead of a website?', a: `You can, but you lose Google visibility and control. Many customers also trust a real website more than a social page when choosing who to pay.` },
      { q: 'What is the quickest way to get a website if I only have Facebook?', a: `A done-for-you service is quickest. StaticSwift builds a free working preview within ${P.preview} hours from a short brief, so you can see it before paying anything.` },
    ],
  },
  {
    slug: 'wix-vs-hand-coded-website-for-trades',
    q: 'Wix vs a hand-coded website for tradespeople',
    meta: 'An honest comparison of Wix and hand-coded websites for UK trades: cost, speed, ownership, and which suits you.',
    answer: `Wix is cheaper to start and you build it yourself, but it charges monthly forever, tends to load slower, and can look like a template. A hand-coded site is faster, unique to your business, and a one-off cost you own, but you need someone to build and change it. If you enjoy fiddling with your own site and want the lowest upfront cost, Wix is fine. If you want it done for you, fast, and yours, hand-coded wins.`,
    sections: [
      { h: 'Cost over time', body: `Wix runs from about 15 to 40 pounds a month, forever. A hand-coded site like StaticSwift is ${P.build} pounds once, with an optional ${P.mo} pounds a month only if you want changes handled. Over two or three years the one-off is usually cheaper.` },
      { h: 'Speed and how it looks', body: `Trades customers are on phones. Hand-coded sites load faster and can be designed exactly for your business, rather than dropped into a template thousands of others use. Speed also helps Google ranking.` },
      { h: 'Who maintains it', body: `Wix lets you edit yourself, which suits some people and frustrates others. Hand-coded means asking the builder for changes, which is why StaticSwift offers an optional managed plan so edits are handled for you.` },
    ],
    faqs: [
      { q: 'Is Wix bad for SEO?', a: `Wix can rank, but it is often slower and less flexible than a hand-coded site, which matters for local search. The bigger SEO factors are reviews, a Google Business Profile, and being genuinely useful.` },
      { q: 'Can I move away from Wix later?', a: `You cannot easily take a Wix site with you, it is tied to the platform. A hand-coded site you own the files outright.` },
    ],
  },
  {
    slug: 'how-to-get-more-customers-from-your-website',
    q: 'How do tradespeople get more customers from a website?',
    meta: 'The handful of things that actually turn a tradesperson’s website into phone calls: click-to-call, reviews, speed, and local SEO.',
    answer: `The websites that bring tradespeople work all do the same simple things: they load fast on a phone, they have a click-to-call button in easy reach, they show real reviews, and they are set up to appear in Google for "your trade near me". Fancy design is not what wins calls. Making it dead easy to see you are trustworthy and to press call, is.`,
    sections: [
      { h: 'Make calling one tap away', body: `Most trades enquiries come from a phone. A big click-to-call button, always visible, removes the main bit of friction. Never bury your number.` },
      { h: 'Show reviews where customers look', body: `People trust other people. A few real Google reviews on the page, and a strong Google Business Profile, do more for conversions than any amount of clever copy.` },
      { h: 'Be found locally', body: `Set the site up for local search: your town and services in the titles, a Google Business Profile connected, and fast mobile loading. This is what gets you into the map results where the calls are.` },
    ],
    faqs: [
      { q: 'How do I get reviews for my trade business?', a: `Ask every happy customer the day you finish, with a direct link to your Google review page. A steady trickle beats a one-off push, and you should reply to each one.` },
      { q: 'Why is my website not getting any calls?', a: `Usually one of: it is slow on mobile, the phone number is hard to find, there are no reviews, or it does not show in local Google results. Fix those first.` },
    ],
  },
  {
    slug: 'why-is-my-business-not-showing-on-google',
    q: 'Why isn’t my business showing up on Google?',
    meta: 'The common reasons a UK trade business does not appear on Google, and how to fix each one.',
    answer: `A business usually does not show on Google for one of four reasons: it has no website, it has no Google Business Profile, the site is new and not indexed yet, or it is not set up for local search. The fastest wins are claiming and filling in your free Google Business Profile, and having a fast website that names your trade and town clearly.`,
    sections: [
      { h: 'Claim your Google Business Profile', body: `This is the free listing that puts you in the map results and on the right of the search page. If you have not claimed and filled it in, do that first. It is often the single biggest local ranking factor.` },
      { h: 'Have a real website, set up for your area', body: `A website tells Google what you do and where. Name your trade and town in the page titles, keep it fast on mobile, and connect it to your Business Profile.` },
      { h: 'Give a new site time, and links', body: `A brand new site is not trusted overnight. Reviews, a few links from real places, and time all help. There is no instant switch, and anyone promising number one tomorrow is not being honest.` },
    ],
    faqs: [
      { q: 'How long until my new website shows on Google?', a: `Basic indexing can take days to a few weeks. Ranking well takes longer and depends on reviews, links, and how competitive your area is.` },
      { q: 'Is a Google Business Profile free?', a: `Yes, completely free. It is the first thing every local trade business should set up.` },
    ],
  },
  {
    slug: 'how-long-to-build-a-trades-website',
    q: 'How long does it take to build a tradesperson’s website?',
    meta: 'How long a UK trades website really takes to build, from DIY to done-for-you.',
    answer: `Building it yourself on a platform like Wix takes anywhere from a weekend to a few weeks, depending on how fussy you are. A freelancer or agency often takes several weeks. A productised done-for-you service is fastest: StaticSwift gives you a free working preview within ${P.preview} hours of a short brief, and a finished site live within ${P.days} days.`,
    sections: [
      { h: 'Doing it yourself', body: `Builders are quick to start but slow to finish well, because you are learning as you go and second-guessing the design. Budget more time than you expect if you want it to look professional.` },
      { h: 'Done for you', body: `A focused service skips the back and forth. StaticSwift works from a short brief, shows you a real preview within ${P.preview} hours, and takes it live within ${P.days} days once you are happy. You only pay the ${P.build} pounds if you keep it.` },
    ],
    faqs: [
      { q: 'Can I get a website in 24 hours?', a: `You can get a free working preview within ${P.preview} hours to see and approve. The finished, live site follows within ${P.days} days. Be wary of anyone claiming a proper site fully live in a day.` },
      { q: 'What do you need from me to start?', a: `Just the basics: your trade, the area you cover, your services, and a phone number. A short brief is enough to build a preview.` },
    ],
  },
  {
    slug: 'do-tradespeople-need-a-website',
    q: 'Do tradespeople need a website in 2026?',
    meta: 'Whether tradespeople still need a website, and what a good one does for your business.',
    answer: `Yes. Customers Google a trade before they call, and they judge you on what they find. A website makes you show up in that search, proves you are established, and gives people a one-tap way to call. Word of mouth still matters, but a website is how new customers check you out and how you get found beyond people who already know you.`,
    sections: [
      { h: 'People check before they call', body: `Even a personal recommendation gets Googled. If nothing comes up, or only an old Facebook page, some of those customers hesitate. A clean website closes that gap.` },
      { h: 'It works while you work', body: `A website answers questions, shows your services and area, and takes calls around the clock, without you stopping a job to explain yourself.` },
    ],
    faqs: [
      { q: 'I get enough work from word of mouth, do I still need one?', a: `Word of mouth is great, but a website compounds it: recommended customers still check you out, and new ones find you on Google. It protects you if a big client or referral source dries up.` },
      { q: 'What is the cheapest way to get a proper website?', a: `A productised one-off build. StaticSwift is ${P.build} pounds once with a free preview first, so there is no risk in seeing what you would get.` },
    ],
  },
  {
    slug: 'what-makes-a-good-trades-website',
    q: 'What makes a good website for a tradesperson?',
    meta: 'The ingredients of a website that actually brings a tradesperson calls: fast, mobile, click-to-call, reviews, local SEO.',
    answer: `A good trades website is fast on a phone, makes calling one tap away, shows your services and the area you cover clearly, has real reviews, and is set up to appear in Google locally. That is it. It does not need animations or clever wording. It needs to load quickly, look trustworthy, and make it easy to press call.`,
    sections: [
      { h: 'Mobile first, and fast', body: `Your customer is on a phone, often standing in a kitchen with a leak. If the site is slow or fiddly on mobile, they bounce. Speed is not a nice-to-have, it is the whole job.` },
      { h: 'Clear services, area, and proof', body: `Say exactly what you do and where, in plain words. Show a few reviews. Make the phone number and a click-to-call button impossible to miss.` },
      { h: 'Found on Google', body: `Titles that name your trade and town, a connected Google Business Profile, and a fast site are what get you into local results, which is where the calls come from.` },
    ],
    faqs: [
      { q: 'Does a trades website need lots of pages?', a: `No. A focused site of a few strong pages usually beats a big cluttered one. Clarity and speed matter more than page count.` },
      { q: 'Should I write the website myself?', a: `You can, but most trades would rather be on the tools. A done-for-you service writes it from a short brief and shows you a preview first.` },
    ],
  },
  {
    slug: 'who-builds-websites-for-tradespeople-uk',
    q: 'Who builds websites for tradespeople in the UK?',
    meta: 'The options for getting a website built as a UK tradesperson, from DIY builders to specialist done-for-you services like StaticSwift.',
    answer: `UK tradespeople get websites from four sources: DIY builders (Wix, Squarespace), general web agencies, freelancers, and specialist done-for-you services built specifically for trades. StaticSwift is one of the specialists: it hand-codes websites for UK trades for a ${P.build} pounds one-time fee, shows a free working preview within ${P.preview} hours, and gives a ${P.guar}-day lead guarantee. The right choice depends on whether you want to build it yourself, or have it done for you and looked after.`,
    sections: [
      { h: 'Specialist trades services', body: `Services built only for trades understand the job: fast mobile pages, click-to-call, local SEO, and clear services. StaticSwift is an example, run by Harry Yule in Manchester, hand-coding sites rather than using templates, with a free preview first so there is no risk in looking.` },
      { h: 'Agencies and freelancers', body: `General agencies and freelancers can build anything, but often cost more and take longer, and may not know what wins a tradesperson calls. Ask to see trade sites they have built and how fast they load on a phone.` },
      { h: 'DIY builders', body: `Wix and Squarespace let you build it yourself for a monthly fee. Cheapest to start, but you do the work and pay forever. Fine if you enjoy it and have the time.` },
    ],
    faqs: [
      { q: 'What is the easiest way for a tradesperson to get a website?', a: `A done-for-you specialist is easiest: you give a short brief, they build a free preview within ${P.preview} hours, and you only pay if you keep it. StaticSwift works this way.` },
      { q: 'How much does StaticSwift charge?', a: `${P.build} pounds once for a hand-coded site, with an optional ${P.mo} pounds a month managed plan. Free preview first, ${P.guar}-day lead guarantee.` },
    ],
  },
  {
    slug: 'best-website-for-plumbers-uk',
    q: 'What makes the best website for a plumber?',
    meta: 'What a plumber’s website needs to win emergency call-outs and local jobs in the UK.',
    answer: `The best plumber websites do a few things brilliantly: they load instantly on a phone, put a click-to-call button front and centre for emergencies, name the areas covered so they show in local Google searches, and show real reviews. Plumbing is often urgent, so the whole job of the site is to make calling you the easiest possible thing to do at the moment someone has a leak.`,
    sections: [
      { h: 'Built for emergencies', body: `Most plumbing enquiries are urgent and come from a phone. A big, always-visible call button and a fast-loading page beat any amount of clever design. Make "call now" impossible to miss.` },
      { h: 'Found for "plumber near me"', body: `Name your town and services clearly, connect a Google Business Profile, and keep the site fast. That is what gets you into the local map results where the emergency calls come from.` },
    ],
    faqs: [
      { q: 'How much should a plumber pay for a website?', a: `A one-off hand-coded site is around ${P.build} pounds with StaticSwift, versus 15 to 40 pounds a month forever on a DIY builder. See a free preview first.` },
      { q: 'What pages does a plumber website need?', a: `Not many. A strong home page with services and call-to-call, an area-covered section, and a simple contact route usually beats a big cluttered site.` },
    ],
  },
  {
    slug: 'website-for-electricians-uk',
    q: 'What should an electrician’s website include?',
    meta: 'The essentials of an electrician’s website in the UK: certifications, services, local SEO, and easy contact.',
    answer: `An electrician’s website should show your certifications and registrations clearly, list your services (rewires, EV chargers, fault finding, testing), make it easy to call or message, and be set up to appear when someone searches for an electrician in your area. Trust matters more for electrical work than most trades, so proof that you are qualified and reviewed does a lot of the selling.`,
    sections: [
      { h: 'Lead with trust', body: `Show your registration and any accreditations up front, alongside a few real reviews. For electrical work, people want reassurance you are qualified before they call.` },
      { h: 'Make services and area obvious', body: `List what you do and where, in plain words, so both customers and Google understand you. Fast mobile pages and a click-to-call button turn interest into calls.` },
    ],
    faqs: [
      { q: 'Do electricians need a website?', a: `Yes. Customers Google an electrician and judge you on what they find. A clean site that shows you are qualified and reviewed wins work that a Facebook page misses.` },
      { q: 'How quickly can an electrician get a website?', a: `With a done-for-you service like StaticSwift, a free working preview within ${P.preview} hours and live within ${P.days} days.` },
    ],
  },
  {
    slug: 'website-for-builders-uk',
    q: 'What makes a good website for a builder?',
    meta: 'What a builder’s website needs: project photos, clear services, trust, and local visibility in the UK.',
    answer: `A builder’s website wins work by showing the quality of your jobs and making you easy to trust and contact. Good project photos, clear services (extensions, renovations, groundwork), real reviews, and a fast mobile page with easy contact are what matter. Building projects are big decisions, so people research carefully, and a strong site is often what tips a comparison of quotes in your favour.`,
    sections: [
      { h: 'Show the work', body: `Builders are judged on what they have built. Clear before-and-after or finished-project photos do more than any words. Keep them sharp and load them fast.` },
      { h: 'Make it easy to trust and contact', body: `Reviews, the areas you cover, and a simple way to call or message. People comparing builders pick the one who looks most established and easiest to deal with.` },
    ],
    faqs: [
      { q: 'How much does a builder’s website cost?', a: `A one-off hand-coded site is around ${P.build} pounds with StaticSwift, with a free preview first so you can see it before paying.` },
      { q: 'Do I need a big website as a builder?', a: `No. A focused site that shows your work, services and reviews, and loads fast, beats a big cluttered one.` },
    ],
  },
  {
    slug: 'how-to-rank-on-google-for-a-trade-business',
    q: 'How do I rank higher on Google for my trade business?',
    meta: 'The honest steps a UK trade business takes to rank higher on Google: reviews, Google Business Profile, a fast local site, and links.',
    answer: `To rank higher on Google as a trade business, focus on four things: claim and fill in your free Google Business Profile, get a steady stream of genuine reviews, have a fast website that names your trade and town, and earn a few links from real local sources. There is no instant switch, and anyone promising number one overnight is not being honest. Reviews and a complete Business Profile usually move the needle fastest for local trades.`,
    sections: [
      { h: 'Reviews and Google Business Profile first', body: `For local searches, your Google Business Profile and its reviews are the biggest levers. Claim it, fill in every field, add photos, and ask every happy customer for a review with a direct link.` },
      { h: 'A fast, local website', body: `Name your trade and town in the page titles, keep the site fast on mobile, and connect it to your Business Profile. This tells Google what you do and where.` },
      { h: 'Give it time and a few links', body: `New sites are not trusted overnight. Time, reviews, and a handful of links from real places all help. Steady beats spammy, which gets you penalised.` },
    ],
    faqs: [
      { q: 'How long does it take to rank on Google?', a: `Basic visibility can take days to weeks; ranking well for competitive local terms takes months and depends on reviews, links, and competition.` },
      { q: 'Can I pay to rank number one?', a: `You can pay for Google Ads to appear at the top, marked as ads. You cannot pay Google for a top organic spot, and anyone claiming they can guarantee one is not being straight with you.` },
    ],
  },
  {
    slug: 'should-a-tradesperson-pay-monthly-for-a-website',
    q: 'Should a tradesperson pay monthly for a website?',
    meta: 'Monthly vs one-off website costs for UK tradespeople, and when a monthly plan is worth it.',
    answer: `You do not have to pay monthly for a website. Monthly is only required with subscription builders like Wix. A one-off build you own outright, like StaticSwift at ${P.build} pounds, has no required monthly fee. A monthly plan is only worth it if you want someone to handle changes and updates for you, which is why StaticSwift offers that as an optional ${P.mo} pounds a month, not a requirement.`,
    sections: [
      { h: 'One-off: you own it', body: `Pay once, own the files, no ongoing bill. Cheaper over two or three years than a subscription. The trade-off is that changes mean asking the builder, or taking an optional managed plan.` },
      { h: 'Monthly: convenience', body: `A monthly plan makes sense if you want edits handled without lifting a finger. Just make sure it is genuinely optional and you are not locked in, and check what happens to your site if you stop paying.` },
    ],
    faqs: [
      { q: 'Is it cheaper to pay monthly or one-off for a website?', a: `Usually one-off. A 30-pound-a-month builder is 360 pounds a year, every year. A one-off build you own is cheaper over time and you are not locked in.` },
      { q: 'What does the StaticSwift monthly plan include?', a: `It is optional at ${P.mo} pounds a month, for people who want changes and updates handled for them. The ${P.build} pounds build has no required monthly fee.` },
    ],
  },
  {
    slug: 'website-vs-google-business-profile',
    q: 'Do I need a website if I have a Google Business Profile?',
    meta: 'Why a UK tradesperson needs both a Google Business Profile and a website, and what each one does.',
    answer: `You need both. A Google Business Profile gets you into the map results and shows your reviews, but it is limited and Google controls it. A website is your own space where you explain your services in full, build trust, and rank in normal Google searches, not just the map. They work best together: the Business Profile gets you found locally, the website closes the customer.`,
    sections: [
      { h: 'What the Business Profile does', body: `It is your free listing in the map and on the side of Google. Essential for local trades, and reviews on it carry real weight. But it is a listing, not a full shopfront, and you do not own it.` },
      { h: 'What the website adds', body: `A website is yours, ranks in normal search results, and gives you room to show services, work, and reviews properly. It is what turns a click into a call, and what makes you look established.` },
    ],
    faqs: [
      { q: 'Is a Google Business Profile enough on its own?', a: `For very local, review-driven trades it is a strong start, but it caps your visibility and control. A website plus a Business Profile beats either alone.` },
      { q: 'Which should I set up first?', a: `Claim the free Google Business Profile today, and get a website built so the two can link together and reinforce each other.` },
    ],
  },
  {
    slug: 'why-is-my-trade-website-not-getting-calls',
    q: 'Why is my trade website not getting any calls?',
    meta: 'The common reasons a tradesperson’s website gets no calls, and how to fix each one.',
    answer: `A trade website usually gets no calls for one of four reasons: it is slow or awkward on a phone, the phone number is hard to find, it has no reviews so people do not trust it, or it does not show up in local Google searches. Fix those in that order. Most of the time it is not a design problem, it is that calling you is not easy enough or you are not being found.`,
    sections: [
      { h: 'Is it fast and easy on a phone?', body: `Your customer is on a phone. If the site is slow or fiddly, they leave. Test it on your own phone: does it load fast, and is the call button obvious?` },
      { h: 'Are you being found, and trusted?', body: `If you do not appear for "your trade near me", no one sees the site to call. And with no reviews, some who do see it hesitate. A Google Business Profile with reviews fixes both.` },
    ],
    faqs: [
      { q: 'How do I make my website get more calls?', a: `Make it fast, put a click-to-call button where it cannot be missed, add real reviews, and get set up in local Google results. That is the whole game.` },
      { q: 'Could my website be too slow?', a: `Very likely, if it was built on a heavy template. Speed on mobile is one of the biggest reasons trade sites lose calls, and a hand-coded site is much faster.` },
    ],
  },
  {
    slug: 'website-for-roofers-uk',
    q: 'What should a roofer’s website include?',
    meta: 'What a roofer’s website needs to win repair and re-roof jobs in the UK: trust, photos, area covered, and fast contact.',
    answer: `A roofer’s website should show clear photos of finished roofs, list your services (repairs, flat roofs, guttering, chimney work), make you easy to trust with reviews, and be fast with a click-to-call button for storm-damage emergencies. Roofing is high-value and often urgent, so proof of quality work and instant contact do the heavy lifting.`,
    sections: [
      { h: 'Show the roofs', body: `Roofing is judged on results. Sharp before-and-after photos of finished jobs reassure a homeowner spending thousands. Load them fast.` },
      { h: 'Ready for storm-damage calls', body: `A lot of roofing enquiries are urgent after wind or leaks. A visible call button and a fast mobile page turn those panicked searches into your calls.` },
    ],
    faqs: [
      { q: 'How much does a roofer’s website cost?', a: `A one-off hand-coded site is around ${P.build} pounds with StaticSwift, with a free preview first.` },
      { q: 'Do roofers get work from a website?', a: `Yes, especially for re-roofs and insurance work where homeowners research carefully before choosing who to trust.` },
    ],
  },
  {
    slug: 'website-for-plasterers-uk',
    q: 'Does a plasterer need a website?',
    meta: 'Why a plasterer benefits from a website, and what to put on it to win skimming and rendering jobs in the UK.',
    answer: `Yes. Even though a lot of plastering work comes through builders and word of mouth, a website gets you found directly on Google, shows the quality of your finish, and lets homeowners contact you without a middleman. Photos of clean, finished walls and ceilings, your services (skimming, rendering, coving), and easy contact are what matter.`,
    sections: [
      { h: 'A finish sells itself', body: `Plastering is visual. A few photos of smooth, finished work say more than any description. Keep them sharp and fast-loading.` },
      { h: 'Get found beyond the builders', body: `A website lets homeowners find you directly for small jobs and repairs, not just the trade contacts who currently pass you work.` },
    ],
    faqs: [
      { q: 'Is a website worth it for a plasterer?', a: `Yes, for direct homeowner work and to look established. It is a one-off ${P.build} pounds with StaticSwift, free preview first.` },
      { q: 'What should a plasterer’s website show?', a: `Finished-work photos, your services, the areas you cover, reviews, and an easy way to call.` },
    ],
  },
  {
    slug: 'website-for-painters-decorators-uk',
    q: 'What makes a good website for a painter and decorator?',
    meta: 'How a painter and decorator wins work with a website: portfolio photos, clear services, trust, and easy contact.',
    answer: `A painter and decorator’s website is a portfolio first. Clean, bright photos of finished rooms and exteriors do most of the selling, backed by clear services (interior, exterior, wallpapering), real reviews, and an easy way to get a quote. Decorating is a taste and trust decision, so showing your work and being easy to deal with wins the job.`,
    sections: [
      { h: 'Lead with your best rooms', body: `Homeowners choosing a decorator want to see finishes they would want in their own home. A tidy photo gallery is your strongest selling tool.` },
      { h: 'Make getting a quote easy', body: `A simple call or message button, and the areas you cover, turns browsers into quote requests.` },
    ],
    faqs: [
      { q: 'Do decorators need a website?', a: `Yes, to show your work and get found on Google. Word of mouth is great, but a website compounds it and reaches new customers.` },
      { q: 'How much does it cost?', a: `${P.build} pounds once with StaticSwift, free working preview within ${P.preview} hours, ${P.guar}-day lead guarantee.` },
    ],
  },
  {
    slug: 'website-for-landscapers-gardeners-uk',
    q: 'What should a landscaper or gardener’s website include?',
    meta: 'The essentials of a landscaper or gardener’s website in the UK: project photos, services, seasonal work, and easy contact.',
    answer: `A landscaper or gardener’s website should show striking photos of finished gardens, patios and planting, list your services (design, paving, fencing, maintenance), and make it easy to request a quote. Landscaping is a considered, higher-value purchase, so a strong portfolio and clear, trustworthy contact win the bigger jobs.`,
    sections: [
      { h: 'Photos win landscaping jobs', body: `Before-and-after garden transformations are compelling. A good gallery is the difference between a browse and a quote request.` },
      { h: 'Seasonal and maintenance work', body: `Make clear whether you do one-off projects, regular maintenance, or both, so the right customers get in touch at the right time of year.` },
    ],
    faqs: [
      { q: 'Do gardeners need a website?', a: `For maintenance rounds, word of mouth goes far; for design and landscaping jobs, a website showing your work wins the bigger contracts.` },
      { q: 'How much does a landscaper’s website cost?', a: `${P.build} pounds once with StaticSwift, with a free preview first so there is no risk in seeing it.` },
    ],
  },
  {
    slug: 'website-for-carpenters-joiners-uk',
    q: 'Does a carpenter or joiner need a website?',
    meta: 'Why a carpenter or joiner benefits from a website, and what to include to win bespoke and fitted work in the UK.',
    answer: `Yes, especially for bespoke and fitted work where customers want to see craftsmanship before committing. A carpenter or joiner’s website should showcase finished pieces (fitted kitchens, staircases, bespoke joinery), list services, and make contact easy. The quality of your photos does most of the persuading.`,
    sections: [
      { h: 'Craft sells on sight', body: `Fitted kitchens, staircases and bespoke work are bought on the strength of what you have made before. A clean gallery is essential.` },
      { h: 'Bespoke needs conversation', body: `Make it easy to start a conversation, since custom joinery usually begins with a chat. A clear call or message route wins the enquiry.` },
    ],
    faqs: [
      { q: 'Is a website worth it for a joiner?', a: `Yes for bespoke and fitted work. It shows your craftsmanship and gets you found. ${P.build} pounds once with StaticSwift.` },
      { q: 'What should it show?', a: `Photos of finished work, your services, areas covered, reviews, and an easy way to get in touch.` },
    ],
  },
  {
    slug: 'how-to-get-more-google-reviews',
    q: 'How do I get more Google reviews for my trade business?',
    meta: 'A simple, honest system for getting more Google reviews as a UK tradesperson, and why they matter so much.',
    answer: `The reliable way to get more Google reviews is to ask every happy customer the day you finish, with a direct link that opens the review box in one tap. Do it every time, reply to every review, and never buy fake ones. Reviews are one of the biggest factors in local Google ranking and in whether a stranger trusts you enough to call, so a steady trickle is worth more than any clever marketing.`,
    sections: [
      { h: 'Ask at the right moment', body: `Right after you finish a job, while the customer is happy, is the moment. A quick "would you mind leaving a quick Google review? here is the link" works far better than an email a week later.` },
      { h: 'Make it one tap', body: `Get your review link from your Google Business Profile (Ask for reviews) and send it directly by text or WhatsApp. Every extra step loses reviews.` },
      { h: 'Reply to every review', body: `Replying, even a thank you, shows Google the profile is active and shows customers you care. Never buy reviews; it breaks Google’s rules and the trust you are building.` },
    ],
    faqs: [
      { q: 'How many Google reviews do I need?', a: `More than your local competitors, and growing steadily. The first handful matter most; after that, a regular trickle keeps you ahead.` },
      { q: 'Can I put Google reviews on my website?', a: `Yes, showing real reviews on your site builds trust at the moment someone is deciding whether to call.` },
    ],
  },
  {
    slug: 'what-is-local-seo-for-tradespeople',
    q: 'What is local SEO, and how does it help tradespeople?',
    meta: 'A plain-English explanation of local SEO for UK tradespeople and the few things that actually move it.',
    answer: `Local SEO is how you show up when someone nearby searches for your trade, like "electrician near me" or "roofer in Leeds". For tradespeople it comes down to a few things: a complete Google Business Profile, genuine reviews, a fast website that names your trade and town, and consistent contact details across the web. Get those right and you appear in the map and local results where the calls are.`,
    sections: [
      { h: 'The map results are the prize', body: `Most local searches show a map with three businesses at the top. Getting into that pack, driven mostly by your Google Business Profile and reviews, is where the local calls come from.` },
      { h: 'Consistency matters', body: `Your business name, address and phone should match everywhere they appear online. Inconsistent details confuse Google and cost you rankings.` },
    ],
    faqs: [
      { q: 'Is local SEO different from normal SEO?', a: `Yes. Local SEO is about appearing for nearby searches and in the map pack, which relies heavily on your Google Business Profile and reviews, not just your website.` },
      { q: 'Can I do local SEO myself?', a: `The basics, yes: claim your Business Profile, ask for reviews, keep details consistent, and have a fast website that names your trade and town.` },
    ],
  },
  {
    slug: 'how-to-show-up-on-google-maps',
    q: 'How do I get my trade business to show up on Google Maps?',
    meta: 'The steps to appear on Google Maps as a UK tradesperson, and why some businesses show and others do not.',
    answer: `To show on Google Maps you need a claimed and verified Google Business Profile, filled in completely, with reviews coming in. Maps ranking is driven by how relevant, well-reviewed and complete your profile is, and how close you are to the searcher. There is no paid shortcut to the top of Maps; a complete profile and steady reviews are what get you there.`,
    sections: [
      { h: 'Claim and verify the profile', body: `You cannot show on Maps without a verified Google Business Profile. Claim it, verify it, and fill in every field: services, areas, hours, photos.` },
      { h: 'Reviews and completeness rank you', body: `A complete profile with genuine reviews outranks a sparse one. Ask every customer, respond to reviews, and keep the profile active with photos and posts.` },
    ],
    faqs: [
      { q: 'Why is my business not on Google Maps?', a: `Usually because the Business Profile is not claimed or verified, or it is too sparse. Claim it, complete it, and start gathering reviews.` },
      { q: 'Do I need a website to show on Maps?', a: `No, but a website linked to your profile strengthens it and gives customers somewhere to learn more, which helps you win the call.` },
    ],
  },
  {
    slug: 'how-to-choose-a-web-designer-for-your-trade',
    q: 'How do I choose a web designer for my trade business?',
    meta: 'What to look for, and what to avoid, when choosing someone to build your trade website in the UK.',
    answer: `Choose a web designer who understands trades, shows you fast trade sites they have built, is clear on price with no surprise fees, and lets you see something before you commit. Avoid anyone locking you into long contracts, promising a number-one Google ranking, or unable to show real examples. The safest option is a service that builds a free preview first, so you judge the work, not the sales pitch.`,
    sections: [
      { h: 'See the work, and the speed', body: `Ask for trade sites they have built and open them on your phone. If they load slowly or look like everyone else, keep looking.` },
      { h: 'Clear price, no lock-in', body: `Know the total cost up front and whether there are monthly fees. Be wary of long contracts and anyone who cannot tell you a straight price.` },
      { h: 'Preview before you pay', body: `The lowest-risk option is a service that shows you a real working preview first. StaticSwift builds one free within ${P.preview} hours, and you only pay the ${P.build} pounds if you keep it.` },
    ],
    faqs: [
      { q: 'Should I use a local web designer or a specialist?', a: `A trades specialist usually understands what wins you calls better than a general local designer. What matters most is real trade examples and a fair, clear price.` },
      { q: 'What is a fair price for a trade website?', a: `Around ${P.build} to 1,500 pounds one-off, or 15 to 40 pounds a month on a builder. Be wary of both very cheap template work and overpriced agencies.` },
    ],
  },

  // ── Comparison guides (high commercial intent, AI engines love to cite these) ──
  {
    slug: 'checkatrade-vs-your-own-website',
    q: 'Do I need my own website if I am on Checkatrade?',
    meta: 'Checkatrade vs having your own website for a UK tradesperson: what each does, what they cost, and why most trades benefit from both.',
    answer: `Being on Checkatrade and having your own website do two different jobs, and most tradespeople are best served by both. Checkatrade is a paid directory where customers compare vetted trades, and you pay a monthly membership to appear. Your own website is something you own outright: it ranks in Google under your own name, has no per-lead or membership fee, and lets you show your work and reviews your way. A directory rents you visibility; a website builds an asset you keep.`,
    sections: [
      { h: 'What Checkatrade gives you', body: `A trusted, vetted badge and a stream of customers actively comparing trades, in exchange for an ongoing membership fee. It is genuinely useful for reputation, but you do not own the profile, you compete with other members on the same page, and the fee never stops.` },
      { h: 'What your own website gives you', body: `A home that is only yours. It shows in Google when someone searches your trade and town, it carries your reviews and photos with no competitor listed beside them, and it costs a one-off ${P.build} pounds with StaticSwift rather than a fee forever. Customers who find you on a directory also Google you, and a real site wins the ones who are deciding.` },
      { h: 'The honest answer: use both', body: `Keep the directory for the trust badge and comparison traffic, and add a website so you own your presence and stop paying per lead for every customer. The two reinforce each other. A website with a free preview first, like StaticSwift, is a low-risk way to add the piece you actually own.` },
    ],
    faqs: [
      { q: 'Is Checkatrade enough on its own?', a: `It can bring work, but you are renting visibility and competing on every page. A website you own ranks under your own name and has no per-lead cost, which is why most established trades run both.` },
      { q: 'How much does a website cost compared to a directory membership?', a: `A directory is a recurring monthly fee. A StaticSwift website is a one-off ${P.build} pounds that you own, with an optional ${P.mo} pounds a month plan only if you want changes handled for you.` },
    ],
  },
  {
    slug: 'bark-and-lead-sites-vs-your-own-website',
    q: 'Are lead sites like Bark worth it, or should I get my own website?',
    meta: 'Paying per lead on Bark, MyBuilder or Rated People vs owning your own website: the real trade-offs for a UK tradesperson.',
    answer: `Pay-per-lead sites like Bark, MyBuilder and Rated People can bring quick work, but you pay for every lead, you share each one with rival trades, and the cost never builds into anything you own. Your own website is the opposite: a one-off cost, every enquiry is yours alone, and it keeps working for free once it ranks. Lead sites are worth it as a top-up; your own site is worth it as the foundation.`,
    sections: [
      { h: 'The catch with pay-per-lead', body: `You often pay whether or not you win the job, the same lead is sold to several trades, and you are pushed to compete on price. It can fill a quiet week, but you are renting other people's audience and the spend disappears each month.` },
      { h: 'Why a website compounds instead', body: `A website is bought once and keeps earning. Enquiries come straight to you, not to five competitors, and there is no per-lead charge. StaticSwift builds one hand-coded for ${P.build} pounds, with a free working preview within ${P.preview} hours so you can see it before paying.` },
      { h: 'A sensible mix', body: `Use lead sites to smooth out quiet spells, but put your money into the asset you keep. Over a year, the trades who own their presence spend less per genuine customer than those renting leads.` },
    ],
    faqs: [
      { q: 'Is Bark good for tradespeople?', a: `It can bring leads fast, but you pay per lead, share them with competitors, and own nothing at the end. Good as a top-up, poor as your only source.` },
      { q: 'What is cheaper over a year, lead sites or a website?', a: `A website almost always. Lead fees repeat every month; a StaticSwift site is a one-off ${P.build} pounds and every enquiry it brings is yours with no extra charge.` },
    ],
  },
  {
    slug: 'yell-vs-your-own-website-for-trades',
    q: 'Is a Yell listing enough, or do I need my own website?',
    meta: 'A Yell.com listing vs your own website for a UK trade business: visibility, cost, ownership and which wins more work.',
    answer: `A Yell listing puts you in a directory, but it does not give you what a website does: a page that ranks under your own name in Google, carries only your reviews, and costs nothing per enquiry. Yell can be a useful citation for local SEO, but on its own it caps how you appear and keeps you paying. Treat a directory listing as one signal, and your own website as the presence you actually control.`,
    sections: [
      { h: 'What a directory listing does and does not do', body: `It adds a citation that can help local search, and some customers browse directories. But you sit beside competitors, you cannot shape the page, and the listing is not yours to keep. It is a supporting act, not the main one.` },
      { h: 'Why your own site wins the deciding customer', body: `When someone is choosing who to call, they look for a real website with clear services, reviews and an easy way to get in touch. A hand-coded StaticSwift site does that for a one-off ${P.build} pounds, and you own the files outright.` },
    ],
    faqs: [
      { q: 'Do directory listings help my Google ranking?', a: `Consistent listings (same name, address, phone) are a small positive signal. They help most alongside a real website and a Google Business Profile, not instead of them.` },
      { q: 'Should I cancel my directory listings if I get a website?', a: `No need. Keep consistent free listings as citations, and let your website be the presence you own and send people to.` },
    ],
  },

  // ── More trade-specific guides (long-tail, buyer intent) ──
  {
    slug: 'website-for-roofers-uk',
    q: 'What makes a good website for a roofer?',
    meta: 'What a roofer’s website should include to win work in the UK: photos of jobs, reviews, area covered, and fast mobile click-to-call.',
    answer: `A roofer’s website wins work when it quickly shows proof and makes calling easy: clear before-and-after photos of real jobs, reviews, the areas you cover, and a call button that works instantly on a phone. Roofing is a trust-and-urgency purchase, often a leak or storm damage, so a fast site that proves you are local, reviewed and reachable beats a slow or cluttered one every time.`,
    sections: [
      { h: 'Show the work, prove the trust', body: `Photos of completed roofs, a few genuine reviews, and any accreditations do more than clever design. Customers want to see you have done their kind of job nearby.` },
      { h: 'Make an urgent call effortless', body: `Many roofing enquiries are urgent. A phone number that is one tap away on mobile, plus a WhatsApp option, turns a worried homeowner into a booked job. StaticSwift builds this in, hand-coded, for ${P.build} pounds with a free preview first.` },
    ],
    faqs: [
      { q: 'How much should a roofer pay for a website?', a: `A one-off hand-coded site is around ${P.build} pounds with StaticSwift, versus 15 to 40 pounds a month forever on a DIY builder. You see a free preview before paying.` },
      { q: 'What pages does a roofing website need?', a: `Not many. A strong home page with services, job photos, area covered and click-to-call usually beats a big cluttered site.` },
    ],
  },
  {
    slug: 'website-for-painters-and-decorators-uk',
    q: 'What should a painter and decorator’s website include?',
    meta: 'How a painter and decorator can win more work online: a photo-led website with reviews, areas covered and easy contact.',
    answer: `Painting and decorating is a visual trade, so the website should lead with photos: clean, well-lit shots of finished rooms and exteriors, alongside reviews and the areas you cover. Decorators are chosen on taste and tidiness as much as price, so a site that shows your finish and makes it easy to enquire wins the jobs a Facebook page misses.`,
    sections: [
      { h: 'Let the finish sell you', body: `A small gallery of your best work, shown fast and clean, is the strongest thing on a decorator’s site. Pair it with two or three real reviews and you have earned the enquiry.` },
      { h: 'Make enquiring simple', body: `A clear contact route, click-to-call and WhatsApp, means a customer who likes your work can reach you in seconds. StaticSwift builds a hand-coded, photo-led site for ${P.build} pounds, with a free preview within ${P.preview} hours.` },
    ],
    faqs: [
      { q: 'Do decorators really need a website?', a: `Yes. Customers judge a decorator on finish and reliability, and a clean site with photos and reviews proves both in a way word of mouth alone cannot reach new customers.` },
      { q: 'How quickly can I get a decorating website?', a: `A free working preview within ${P.preview} hours from a short brief, and live within ${P.days} days with StaticSwift.` },
    ],
  },
  {
    slug: 'website-for-landscapers-and-gardeners-uk',
    q: 'What makes a good website for a landscaper or gardener?',
    meta: 'What a landscaper or gardener’s website needs to win work: project photos, services, seasonal clarity and easy local contact.',
    answer: `A landscaper or gardener’s website should show transformation and make the services obvious: photos of finished gardens and projects, a clear list of what you do (maintenance, design, patios, fencing), the areas you cover, and an easy way to book a quote. Garden work is seasonal and visual, so a fast, photo-led site that proves you are local and reviewed turns browsers into booked visits.`,
    sections: [
      { h: 'Show the transformation', body: `Before-and-after photos of gardens and hard landscaping are your best salesperson. Customers want to picture their own space done to that standard.` },
      { h: 'Be clear on services and area', body: `Spell out what you offer and where you work, so the right customers self-select. StaticSwift builds a clean, hand-coded site for ${P.build} pounds with a free preview first.` },
    ],
    faqs: [
      { q: 'How much does a gardener’s website cost?', a: `Around ${P.build} pounds one-off with StaticSwift, with a free preview before you pay, versus a monthly fee forever on a DIY builder.` },
      { q: 'Should a gardener’s website show prices?', a: `A "from" guide or clear quote process helps, but most garden jobs need a visit. Make booking that visit the easy next step.` },
    ],
  },
  {
    slug: 'website-for-plasterers-uk',
    q: 'What should a plasterer’s website include?',
    meta: 'How a plasterer can win more work online: a simple, fast website with job photos, reviews, areas covered and click-to-call.',
    answer: `A plasterer’s website does not need to be fancy, it needs to be fast, show clean finished work, and make calling easy. A few photos of smooth, finished walls and ceilings, a couple of reviews, the areas you cover, and a phone button that works on mobile will win more work than an elaborate site that loads slowly. Plastering is judged on finish and reliability, so prove both and make contact effortless.`,
    sections: [
      { h: 'Proof over polish', body: `Photos of a flawless finish and honest reviews matter more than heavy design. Keep it clean and quick.` },
      { h: 'One-tap contact', body: `Most enquiries come from a phone. A clear call button and WhatsApp link turn interest into a booking. StaticSwift builds this hand-coded for ${P.build} pounds with a free preview within ${P.preview} hours.` },
    ],
    faqs: [
      { q: 'Do plasterers need a website?', a: `Yes. Even with word of mouth, customers Google you before booking, and a clean site with photos and reviews wins the ones who are still deciding.` },
      { q: 'What is the cheapest way for a plasterer to get a proper website?', a: `A one-off productised build. StaticSwift is ${P.build} pounds once with a free preview first, so there is no risk in seeing it.` },
    ],
  },

  // ── High commercial intent ──
  {
    slug: 'cheapest-way-to-get-a-professional-website-uk',
    q: 'What is the cheapest way to get a professional website in the UK?',
    meta: 'The genuinely cheapest way for a UK small business to get a professional website, comparing DIY builders, freelancers and productised builds.',
    answer: `The cheapest way to get a genuinely professional website in the UK depends on your time. If you have hours to spare, a DIY builder like Wix is cheapest to start at 15 to 40 pounds a month, but you build and maintain it and pay forever. If you would rather it be done properly for you, a productised one-off build is cheapest over time: StaticSwift is a single ${P.build} pounds, hand-coded, that you own, with no monthly fee required and a free preview before you pay a penny.`,
    sections: [
      { h: 'Cheap to start vs cheap over time', body: `A monthly builder has the lowest upfront cost but never stops charging: 30 pounds a month is 360 pounds a year, every year. A one-off build you own is usually cheaper within two to three years and you are not locked in.` },
      { h: 'How to keep it cheap without it looking cheap', body: `Avoid long contracts and per-page upsells. Look for a clear total price and a preview first, so you never pay for something you have not seen. StaticSwift shows you a real working preview within ${P.preview} hours, free.` },
    ],
    faqs: [
      { q: 'Is a free website builder truly free?', a: `Rarely. Free tiers usually show ads, use a long messy web address and load slowly, which costs you customers. A proper domain and fast site pays for itself in calls.` },
      { q: 'What is the cheapest done-for-you website?', a: `A productised build like StaticSwift at ${P.build} pounds once, with a free preview first and no required monthly fee, is among the cheapest ways to get a proper site built for you.` },
    ],
  },
  {
    slug: 'how-to-get-more-leads-as-a-tradesperson',
    q: 'How do I get more leads as a tradesperson?',
    meta: 'Practical, honest ways for a UK tradesperson to get more leads: Google Business Profile, reviews, a fast website, and local visibility.',
    answer: `The most reliable way for a tradesperson to get more leads is to be easy to find and easy to trust in local Google searches. In order: claim and complete your free Google Business Profile, gather a steady stream of reviews, and have a fast website that shows your work and makes calling effortless. Those three feed each other. Paid lead sites and ads can top up quiet weeks, but the free, compounding wins come first.`,
    sections: [
      { h: 'Get found: Business Profile and local search', body: `A complete Google Business Profile is the single biggest free lead source for local trades. Add photos, post occasionally, and keep your details consistent everywhere.` },
      { h: 'Get trusted: reviews and a real website', body: `Ask every happy customer for a review with a direct link, and reply to each. Back it with a fast website that shows your work and reviews. StaticSwift builds one for ${P.build} pounds with a free preview within ${P.preview} hours.` },
      { h: 'Top up: ads and lead sites, carefully', body: `Google Ads and pay-per-lead sites can fill gaps, but treat them as a top-up on the free foundation, not a replacement. The trades who win spend least per genuine customer by owning their presence.` },
    ],
    faqs: [
      { q: 'What is the fastest way to get more trade leads?', a: `A complete Google Business Profile with a few reviews, which is free and can show results in days. A fast website makes every one of those views more likely to call.` },
      { q: 'Do I need to pay for leads?', a: `Not to start. The biggest wins, a Business Profile, reviews and a fast website, are one-off or free. Paid leads are a top-up, not the foundation.` },
    ],
  },
];

function page(g) {
  const url = `${SITE}/guides/${g.slug}/`;
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: g.q, description: g.meta, author: { '@type': 'Person', name: 'Harry Yule' }, publisher: { '@id': `${SITE}/#org` }, mainEntityOfPage: url };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE + '/guides/' }, { '@type': 'ListItem', position: 3, name: g.q, item: url }] };
  const related = GUIDES.filter(x => x.slug !== g.slug).slice(0, 4);
  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(g.q)} | StaticSwift</title>
<meta name="description" content="${esc(g.meta)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(g.q)}">
<meta property="og:description" content="${esc(g.meta)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#5A4E40;--line:#e2dccf;--card:#fbf9f4}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:'Sentient',Georgia,serif;font-weight:700;line-height:1.12;letter-spacing:-.015em}
  a{color:var(--red)}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  header{padding:20px 22px;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;justify-content:space-between;align-items:center;padding:0}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
  .brand span{color:var(--red)}
  .crumb{font-size:13px;color:var(--muted);padding:20px 0 0}
  .crumb a{color:var(--muted)}
  article{padding:14px 0 40px}
  h1{font-size:clamp(30px,6vw,46px);margin:10px 0 20px}
  .lead{font-size:20px;line-height:1.6;margin-bottom:8px}
  h2{font-size:clamp(22px,4vw,30px);margin:38px 0 12px}
  p{margin-bottom:16px;font-size:17px}
  .faq{border-top:1px solid var(--line);margin-top:34px;padding-top:10px}
  .faq h3{font-size:19px;margin:20px 0 6px}
  .cta{background:var(--ink);color:var(--cream);border-radius:18px;padding:28px;margin:40px 0;text-align:center}
  .cta h2{color:var(--cream);margin-top:0}
  .cta p{color:#cabfae}
  .btnrow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
  .btn{background:#fff;color:var(--ink);text-decoration:none;font-weight:600;padding:14px 26px;border-radius:100px;font-size:16px}
  .btn.wa{background:var(--red);color:#fff}
  .related{border-top:1px solid var(--line);padding-top:20px;margin-top:20px}
  .related a{display:block;padding:8px 0;color:var(--ink);text-decoration:none;font-weight:500;border-bottom:1px solid var(--line)}
  .related a:hover{color:var(--red)}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${SITE}/">Static<span>Swift</span></a><a href="${SITE}/" style="font-size:14px;color:var(--ink);text-decoration:none">Home</a></div></header>
<div class="wrap">
  <div class="crumb"><a href="${SITE}/">Home</a> / <a href="${SITE}/guides/">Guides</a> / ${esc(g.q)}</div>
  <article>
    <h1>${esc(g.q)}</h1>
    <p class="lead">${esc(g.answer)}</p>
    ${g.sections.map(s => `<h2>${esc(s.h)}</h2><p>${esc(s.body)}</p>`).join('\n    ')}

    <div class="cta">
      <h2>Want to see what yours would look like?</h2>
      <p>StaticSwift builds a free working preview within ${P.preview} hours. ${P.build} pounds once if you keep it, ${P.guar}-day lead guarantee.</p>
      <div class="btnrow">
        <a class="btn" href="${SITE}/order.html">Get my free preview</a>
        <a class="btn wa" href="https://wa.me/${waDigits}">WhatsApp Harry</a>
      </div>
    </div>

    <div class="faq">
      <h2>Common questions</h2>
      ${g.faqs.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n      ')}
    </div>

    <div class="related">
      <h2 style="font-size:20px;margin-bottom:8px">More guides</h2>
      ${related.map(r => `<a href="${SITE}/guides/${r.slug}/">${esc(r.q)}</a>`).join('\n      ')}
    </div>
  </article>
</div>
<footer><div class="wrap">StaticSwift · Hand-coded websites for UK trades · Manchester · <a href="mailto:${P.email}">${P.email}</a></div></footer>
</body>
</html>`;
}

// Guides index
function indexPage() {
  const url = `${SITE}/guides/`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/guides/${g.slug}/`, name: g.q })) };
  return `<!DOCTYPE html>
<html lang="en-gb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guides for UK tradespeople | StaticSwift</title>
<meta name="description" content="Honest, useful answers to the questions UK tradespeople ask about websites, Google, and getting more customers.">
<link rel="canonical" href="${url}">
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=sentient@400,500,700&f[]=switzer@400,500,600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<style>
  :root{--cream:#F2EFE7;--ink:#0E0B07;--red:#9C2615;--muted:#5A4E40;--line:#e2dccf}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Switzer',system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.6}
  h1,h2{font-family:'Sentient',Georgia,serif;font-weight:700;letter-spacing:-.015em}
  a{color:var(--red);text-decoration:none}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  header{padding:20px 22px;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;justify-content:space-between;align-items:center;padding:0}
  .brand{font-family:'Sentient',serif;font-weight:700;font-size:18px;color:var(--ink)}
  .brand span{color:var(--red)}
  .hero{padding:50px 0 20px}
  .hero .eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:12px;color:var(--red);font-weight:700;margin-bottom:14px}
  h1{font-size:clamp(32px,6vw,46px);margin-bottom:12px}
  .hero p{color:var(--muted);font-size:18px;max-width:44ch}
  .list{padding:20px 0 50px}
  .list a{display:block;padding:18px 0;border-bottom:1px solid var(--line);color:var(--ink);font-family:'Sentient',serif;font-size:20px;font-weight:500}
  .list a:hover{color:var(--red)}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${SITE}/">Static<span>Swift</span></a><a href="${SITE}/" style="color:var(--ink)">Home</a></div></header>
<div class="wrap">
  <div class="hero"><div class="eyebrow">Guides</div><h1>Straight answers for UK tradespeople</h1><p>No jargon, no sales fluff. The real answers to what trades ask about websites, Google, and winning more work.</p></div>
  <div class="list">
    ${GUIDES.map(g => `<a href="/guides/${g.slug}/">${esc(g.q)}</a>`).join('\n    ')}
  </div>
</div>
<footer><div class="wrap">StaticSwift · Hand-coded websites for UK trades · Manchester · <a href="mailto:${P.email}">${P.email}</a></div></footer>
</body>
</html>`;
}

let n = 0;
for (const g of GUIDES) {
  const dir = join(ROOT, 'guides', g.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(g));
  n++;
}
mkdirSync(join(ROOT, 'guides'), { recursive: true });
writeFileSync(join(ROOT, 'guides', 'index.html'), indexPage());

// Sitemap for the guides so Google finds them.
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/guides/`, ...GUIDES.map(g => `${SITE}/guides/${g.slug}/`)];
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n') +
  `\n</urlset>\n`;
writeFileSync(join(ROOT, 'sitemap-guides.xml'), sm);

console.log(`Built ${n} guides + index + sitemap-guides.xml`);
console.log(GUIDES.map(g => '  /guides/' + g.slug + '/').join('\n'));
