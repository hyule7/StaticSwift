# Closed-lid shift scheduling (Harry, one-time setup)

The workforce runs on this Mac plugged in, lid shut, as the engine room. Two
pieces: **pmset** wakes the machine for each shift, **launchd** runs the shift.

## 1. Prerequisites

- Claude Code CLI installed and logged in (`claude` works in Terminal).
- Mac on mains power. System Settings → Battery → Options → "Prevent
  automatic sleeping on power adapter when display is off" → on. Also enable
  "Wake for network access".
- A clamshell setup needs an external display OR run with lid open once to
  confirm, then it survives lid-close on power.
- Set env so the shifts can reach the queue: in your shell profile export
  `AGENT_TOKEN`, and the same value in Netlify env (used by queue-submit).

## 2. pmset scheduled wakes (run once, with sudo)

    sudo pmset repeat wake MTWRFSU 05:55:00

This wakes the Mac daily at 05:55 so the 06:00 shift fires. (pmset allows one
repeating wake; launchd below covers the midday/evening runs while the Mac is
already awake. If you want guaranteed wakes for all three, use three one-off
`pmset schedule wake` entries refreshed by the evening shift.)

## 3. launchd jobs (per shift)

Create `~/Library/LaunchAgents/co.staticswift.shift-morning.plist` (repeat for
midday at 12:00 and evening at 20:00, changing Hour and the argument):

    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0"><dict>
      <key>Label</key><string>co.staticswift.shift-morning</string>
      <key>ProgramArguments</key>
      <array>
        <string>/bin/bash</string>
        <string>/Users/harryyule/Documents/GitHub/StaticSwift/staticswift-SEO-FULL/agents/run-shift.sh</string>
        <string>morning</string>
      </array>
      <key>StartCalendarInterval</key><dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
      <key>EnvironmentVariables</key><dict>
        <key>AGENT_TOKEN</key><string>YOUR_AGENT_TOKEN</string>
        <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
      </dict>
      <key>StandardOutPath</key><string>/Users/harryyule/Documents/GitHub/StaticSwift/staticswift-SEO-FULL/agents/logs/launchd-morning.log</string>
      <key>StandardErrorPath</key><string>/Users/harryyule/Documents/GitHub/StaticSwift/staticswift-SEO-FULL/agents/logs/launchd-morning.err</string>
    </dict></plist>

Load each: `launchctl load ~/Library/LaunchAgents/co.staticswift.shift-morning.plist`

## 4. Off-schedule runs

- From the Mac: `make shift-morning` (or midday/evening).
- From the Claude mobile app: trigger a manual shift run (same command).

## 5. Watch it

The dashboard reads shift-healthcheck; a shift that misses its window shows
stale on your phone. Each shift also writes agents/logs/<shift>-<timestamp>.log.
