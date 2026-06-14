#!/usr/bin/env bash
# install-autostart.sh — run ONCE. After this, the whole workforce starts by
# itself whenever the laptop is open or wakes, and runs its three daily shifts.
# Harry does nothing else, ever.
#
#   bash agents/install-autostart.sh
#
# What it sets up (all under your user, no admin needed except the pmset wake):
#   - 3 LaunchAgents (morning/midday/evening) with StartCalendarInterval so
#     they fire at 06:00 / 12:00 / 20:00 every day.
#   - A "catch-up" LaunchAgent with RunAtLoad=true: the instant you log in or
#     open the lid, it runs whichever shift is due so nothing waits for the
#     next clock tick.
#   - A pmset repeating wake at 05:55 so the Mac is awake for the morning shift
#     even with the lid shut on mains power (needs your password once).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LA="$HOME/Library/LaunchAgents"
mkdir -p "$LA" "$REPO/agents/logs"

# AGENT_TOKEN: needed so shifts can write to the approval queue.
TOKEN="${AGENT_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  read -rp "Paste your AGENT_TOKEN (same value you set in Netlify env): " TOKEN
fi
[ -z "$TOKEN" ] && { echo "AGENT_TOKEN is required. Set it in Netlify env first, then re-run."; exit 1; }

# ADMIN_PASSWORD lets the watcher read the "start everyone now" flag.
APW="${ADMIN_PASSWORD:-}"
if [ -z "$APW" ]; then
  read -rsp "Paste your ADMIN_PASSWORD (same value as in Netlify env): " APW; echo
fi

BASH_BIN="/bin/bash"
PATH_LINE="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

mk_plist () {  # label, hour|catchup|watch, arg
  local label="$1" hour="$2" arg="$3" plist="$LA/$label.plist" prog="$REPO/agents/run-shift.sh"
  local sched
  if [ "$hour" = "catchup" ]; then
    sched="<key>RunAtLoad</key><true/>"
  elif [ "$hour" = "watch" ]; then
    prog="$REPO/agents/run-watcher.sh"
    sched="<key>StartInterval</key><integer>180</integer><key>RunAtLoad</key><true/>"
  else
    sched="<key>StartCalendarInterval</key><dict><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>0</integer></dict>"
  fi
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>$BASH_BIN</string><string>$prog</string><string>$arg</string></array>
  $sched
  <key>EnvironmentVariables</key><dict>
    <key>AGENT_TOKEN</key><string>$TOKEN</string>
    <key>ADMIN_PASSWORD</key><string>$APW</string>
    <key>PATH</key><string>$PATH_LINE</string>
  </dict>
  <key>StandardOutPath</key><string>$REPO/agents/logs/launchd-$arg.log</string>
  <key>StandardErrorPath</key><string>$REPO/agents/logs/launchd-$arg.err</string>
</dict></plist>
PLIST
  launchctl unload "$plist" 2>/dev/null || true
  launchctl load "$plist"
  echo "  loaded $label"
}

echo "Installing LaunchAgents..."
mk_plist co.staticswift.shift-morning 6  morning
mk_plist co.staticswift.shift-midday  12 midday
mk_plist co.staticswift.shift-evening 20 evening
# Catch-up: runs the right shift the moment you open the laptop / log in.
mk_plist co.staticswift.shift-catchup catchup catchup
# Watcher: every 3 min, runs a shift requested from the admin "Start everyone now" button.
mk_plist co.staticswift.shift-watch watch watch

echo "Setting a 05:55 wake so the morning shift fires lid-shut on power..."
sudo pmset repeat wake MTWRFSU 05:55:00 || echo "  (skipped pmset; run 'sudo pmset repeat wake MTWRFSU 05:55:00' yourself)"

cat <<DONE

Done. The workforce is now self-starting.
- Opens/logs in   -> catch-up shift runs immediately
- 06:00 / 12:00 / 20:00 -> the three daily shifts run on their own
- Watch them in the admin Workforce tab (shift status, live activity, queue)

One thing left for full lid-shut running: System Settings -> Battery ->
Options -> "Prevent automatic sleeping on power adapter when display is off"
= ON, and "Wake for network access" = ON. Then you never touch it again.
DONE
