# StaticSwift Autonomous Studio · agents/

A virtual company running on Harry's Claude subscription via headless Claude
Code, orchestrated by three daily shifts, with the approval queue as the
gate between any agent and a customer. One real craftsman with a powerful
back office: agents draft, Harry approves from his phone, the plumbing sends.

## The org (role files in agents/roles/)

- **Executive:** ceo-agent, cfo-agent
- **Chief of Staff:** chief-of-staff (the 7am brief, the product Harry uses daily)
- **Business Development:** bd-discovery, bd-website-checker, bd-contact-finder,
  bd-classifier, bd-preview-builder (operate the outreach/ toolchain)
- **Customer Service:** cs-triage, cs-drafter
- **Design Studio:** studio-brief-parser, studio-generator, studio-critic
- **Marketing:** marketing
- **Search:** search (continuous SEO, every evening)
- **Operations and Finance:** ops-finance
- **Quality and Risk:** qr-factchecker
- **Client Success:** client-success (the Growth Plan factory)
- **Technical:** tech-bugwatch, tech-webmaster

Every role file carries the Excellence Covenant, the identity rules and the
approval-gate. Generated from agents/_build-roles.mjs (re-run to regenerate).

## The shifts (agents/shifts/)

- **Morning Ops** (~06:00 UK): CS triage + drafts, reply classification, the
  Chief of Staff brief.
- **Midday BD** (~12:00 UK): discovery, enrichment, outreach drafting, sequencing.
- **Evening Studio** (~20:00 UK): builds + critic review, search, marketing,
  bug watch; weekly report on Mondays.

Each shift runs `agents/run-shift.sh <shift>` which calls `claude --print`
against the shift prompt, does the work in role order, writes ALL output to
the approval queue, logs to agents/logs/, and pings shift-healthcheck so a
missed shift shows on Harry's phone. Manual run: `make shift-morning` etc.

## The gate

Nothing reaches a customer except through the approval queue
(staticswift.co.uk/admin/queue.html). Autonomy is earned: 50 consecutive
approvals with no edit in a category flips that category to auto-send, with a
per-category and global kill switch. Agents never move money, change pricing,
issue refunds, or sign as a human, at any autonomy level. The dispatcher
(dispatch-approved) is the only path to the wire and runs 24/7 independent of
the Mac, inside UK business hours, under a daily send cap.

## Team Expansion Charter

Any agent hitting a task outside every existing role's scope files a Gap
Report to the CEO Agent: what was needed, why no role covers it, the proposed
role (scope, KPI, queue). The CEO Agent approves or rejects weekly; approved
roles are added to agents/_build-roles.mjs (inheriting all standing rules) and
must process real queue items within 30 days or be retired. Harry sees all Gap
Reports and new hires in the weekly board pack and can veto any.

## Runtime

See agents/SETUP-launchd.md for the closed-lid, mains-power scheduling via
pmset + launchd. State lives in Netlify Blobs (approval-queue, ops, analytics);
JSONBin is the legacy CRM and is being consolidated into Blobs.
