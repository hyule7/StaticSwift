#!/usr/bin/env bash
# run-shift.sh · headless Claude Code shift runner for the StaticSwift workforce.
#
# Three shifts run as `claude -p` invocations against a shift prompt that names
# which roles work and in what order. Each shift reads its queues, does the
# work in role order, writes every outbound artefact to the APPROVAL QUEUE
# (never sends directly), logs to agents/logs/, and pings the healthcheck so a
# missed shift is visible on Harry's phone.
#
# Runs on Harry's Claude subscription, lid shut, on mains power (see
# agents/SETUP-launchd.md). Designed to complete within a normal usage window;
# if cut short, the next shift resumes from the queue position.
#
# Usage:  ./agents/run-shift.sh morning|midday|evening
set -euo pipefail
cd "$(dirname "$0")/.."

SHIFT="${1:-morning}"
PROMPT="agents/shifts/${SHIFT}.md"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOG="agents/logs/${SHIFT}-$(date -u +%Y%m%d-%H%M).log"
HEALTH_URL="${SS_HEALTHCHECK_URL:-https://staticswift.co.uk/.netlify/functions/shift-healthcheck}"

if [ ! -f "$PROMPT" ]; then echo "No shift prompt: $PROMPT" >&2; exit 1; fi

echo "[$STAMP] starting $SHIFT shift" | tee "$LOG"

# Healthcheck: started
curl -s -m 10 -X POST "$HEALTH_URL" -H 'Content-Type: application/json' \
  -d "{\"shift\":\"$SHIFT\",\"event\":\"start\",\"at\":\"$STAMP\"}" >/dev/null 2>&1 || true

# The shift prompt is the instruction; CLAUDE.md + agents/roles/ are read by
# the model as needed. --print runs headless; --permission-mode acceptEdits so
# file work proceeds, but the agents only ever WRITE to the queue, never send.
set +e
claude --print \
  --append-system-prompt "You are running the StaticSwift $SHIFT shift. Read agents/shifts/${SHIFT}.md and execute it in role order. Every outbound artefact goes to the approval queue via outreach/queue.mjs or queue-submit; you NEVER send email, move money, or change pricing. Obey .claude/agents/_covenant.md. Stop when the shift checklist is done or you approach the usage limit, checkpointing remaining work in agents/logs/." \
  < "$PROMPT" >> "$LOG" 2>&1
CODE=$?
set -e

END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[$END] $SHIFT shift exited $CODE" | tee -a "$LOG"

# Healthcheck: finished (include exit code so a crash is visible)
curl -s -m 10 -X POST "$HEALTH_URL" -H 'Content-Type: application/json' \
  -d "{\"shift\":\"$SHIFT\",\"event\":\"end\",\"at\":\"$END\",\"exit\":$CODE}" >/dev/null 2>&1 || true

exit $CODE
