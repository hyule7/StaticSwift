# Morning Ops shift (runs ~06:00 UK)

Goal: Harry wakes to a clear brief and a queue of drafts ready to approve from
his phone. Work the roles below in order. Everything outbound goes to the
approval queue. Obey .claude/agents/_covenant.md.

## Roles this shift
1. **Customer Service triage + drafter** (agents/roles/cs-triage.md, cs-drafter.md)
   - Pull inbound from the CRM / inbox (get-clients, fetch-inbox if available).
   - Classify each: edit request, billing, technical, complaint, sales.
   - Draft a reply in the Field Guide voice with full client context. Queue as
     category `cs-reply`. Escalate anything older than 4 working hours.
2. **Reply classifier** (agents/roles/bd-classifier.md)
   - Classify any overnight outreach replies: interested / objection /
     not-interested / autoreply / unsubscribe. Honour unsubscribes immediately
     (add to suppression). Advance CRM stages.
3. **Chief of Staff brief** (agents/roles/chief-of-staff.md)
   - Compile the 7am brief: yesterday's numbers (analytics-self, get-clients),
     today's approval-queue depth by category, and the top 3 decisions only
     Harry can make. Keep it to one screen. Send via send-brief (queued/emailed
     per that role file). This is the product Harry uses daily; make it excellent.

## Done when
- Every inbound has a queued draft reply or an escalation note.
- Unsubscribes are suppressed.
- The brief is compiled and dispatched.
- A one-line summary is appended to agents/logs/ for the day.
