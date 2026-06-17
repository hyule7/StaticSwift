#!/usr/bin/env bash
# run-watcher.sh — the war-room engine. Runs every few minutes via launchd.
#   1. If BLITZ MODE is active (Harry hit the button, window not expired), it
#      runs the all-hands blitz shift AND fires the no-AI revenue stack every
#      tick, so the whole company hammers flat out for the 1 to 2 hours until
#      he hits Stop or the window ends.
#   2. Otherwise, if a one-shot shift was requested, it runs that once.
#
# A lockfile stops two blitz shifts overlapping (one finishes before the next
# tick starts another). Needs ADMIN_PASSWORD + AGENT_TOKEN in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."
SITE="${SS_SITE:-https://staticswift.co.uk}"
PW="${ADMIN_PASSWORD:-}"
TOK="${AGENT_TOKEN:-}"
[ -z "$PW" ] && exit 0
LOCK="agents/logs/.blitz.lock"

fire() { curl -s -m 60 -X POST "$SITE/.netlify/functions/$1" -H "x-admin-password: $PW" -H 'Content-Type: application/json' >/dev/null 2>&1 || true; }

# ── 1. War-room blitz mode ────────────────────────────────────────────────
MODE="$(curl -s -m 15 "$SITE/.netlify/functions/blitz-mode" -H "x-admin-password: $PW" || echo '{}')"
ACTIVE="$(printf '%s' "$MODE" | grep -o '"active":true' || true)"
if [ -n "$ACTIVE" ]; then
  # Skip if a blitz shift is still running from the last tick.
  if [ -f "$LOCK" ]; then exit 0; fi
  echo $$ > "$LOCK"
  trap 'rm -f "$LOCK"' EXIT
  # No-AI revenue stack every tick: scavenge -> enrich -> draft -> reply -> dispatch.
  fire blitz-scavenge
  fire contact-enrich
  fire blitz-push
  fire reply-loop
  fire dispatch-approved
  # All-hands AI sprint (BD, conversion, SEO pages, analytics, creative).
  ./agents/run-shift.sh blitz || true
  rm -f "$LOCK"; trap - EXIT
  exit 0
fi

# ── 2. One-shot requested shift ───────────────────────────────────────────
RESP="$(curl -s -m 15 "$SITE/.netlify/functions/manual-shift-state" -H "x-admin-password: $PW" || echo '{}')"
SHIFT="$(printf '%s' "$RESP" | sed -n 's/.*"shift":"\([a-z]*\)".*/\1/p')"
CLAIMED="$(printf '%s' "$RESP" | grep -o '"claimed":true' || true)"
[ -z "$SHIFT" ] && exit 0
[ -n "$CLAIMED" ] && exit 0
curl -s -m 15 -X POST "$SITE/.netlify/functions/manual-shift-state" \
  -H "x-admin-password: $PW" -H 'Content-Type: application/json' \
  -d '{"action":"claim"}' >/dev/null 2>&1 || true
if [ "$SHIFT" = "all" ] || [ "$SHIFT" = "blitz" ]; then
  ./agents/run-shift.sh blitz || true
else
  ./agents/run-shift.sh "$SHIFT" || true
fi
