#!/usr/bin/env bash
# run-watcher.sh — lets the "Start everyone working now" button in the admin
# actually launch a shift on this Mac. Runs every few minutes via launchd.
# Polls the Blobs flag (ops/manual-shift) through a tiny admin endpoint; if a
# shift is requested and unclaimed, claims it and runs it.
#
# Needs: ADMIN_PASSWORD (to read the flag) and AGENT_TOKEN (for the shift).
set -euo pipefail
cd "$(dirname "$0")/.."
SITE="${SS_SITE:-https://staticswift.co.uk}"
PW="${ADMIN_PASSWORD:-}"
[ -z "$PW" ] && exit 0

# Read the manual-shift flag.
RESP="$(curl -s -m 15 "$SITE/.netlify/functions/manual-shift-state" -H "x-admin-password: $PW" || echo '{}')"
SHIFT="$(printf '%s' "$RESP" | sed -n 's/.*"shift":"\([a-z]*\)".*/\1/p')"
CLAIMED="$(printf '%s' "$RESP" | grep -o '"claimed":true' || true)"

[ -z "$SHIFT" ] && exit 0
[ -n "$CLAIMED" ] && exit 0

# Claim it so we do not run twice.
curl -s -m 15 -X POST "$SITE/.netlify/functions/manual-shift-state" \
  -H "x-admin-password: $PW" -H 'Content-Type: application/json' \
  -d '{"action":"claim"}' >/dev/null 2>&1 || true

if [ "$SHIFT" = "all" ]; then
  for s in morning midday evening; do ./agents/run-shift.sh "$s" || true; done
else
  ./agents/run-shift.sh "$SHIFT" || true
fi
