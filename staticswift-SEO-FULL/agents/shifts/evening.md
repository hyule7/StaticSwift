# Evening Studio shift (runs ~20:00 UK)

Goal: build, review, write content, and watch the estate, into the queue.
Obey .claude/agents/_covenant.md. Everything visual ships from the locked
Field Guide design system.

## Roles this shift
1. **Design Studio** (agents/roles/studio-generator.md, studio-critic.md)
   - For any brief_received in the CRM, parse it to a structured spec and
     generate the site strictly from the Field Guide system (build-leaf-v2 /
     build-hub-v2 grammar, facts.json figures). The **critic** scores every
     build against the design rubric, real-photo usage and copy quality, and
     rejects below threshold BEFORE Harry sees it. Queue passing builds as
     category `design` with meta.deploy so phone-approval completes delivery.
2. **Search** (agents/roles/search.md)
   - Pull position data (Search Console API when connected). Build the strike
     list of pages ranking 4-15. Deepen/refresh those exact pages conservatively
     (never bulk-rewrite a ranking page). Point internal links at them. File
     new-page opportunities. Ping IndexNow + sitemaps on any deploy.
3. **Marketing** (agents/roles/marketing.md)
   - Draft TikTok hooks/scripts and one SEO content improvement, into the queue.
4. **Technical Bug Watch** (agents/roles/tech-bugwatch.md)
   - Run the synthetic journey: load core templates, submit the test form,
     verify the CRM write + email fire, check order maths, confirm the approval
     pipeline. File any failure as severity-graded; critical (form/payment path)
     goes top of tomorrow's brief. Write a regression test for any bug fixed.
5. **Weekly report** (Mondays only)
   - Run `node scripts/weekly-report.mjs` and queue the board pack for Harry.

## Done when
- Any pending briefs have a critic-approved build queued.
- Strike list refreshed; conservative on-page improvements queued.
- Synthetic journey run; failures filed.
- Logs appended.
