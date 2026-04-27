#!/usr/bin/env bash
# Uninstall Taiwan.md Harvest launchd agent
set -euo pipefail

PLIST_DST="$HOME/Library/LaunchAgents/md.taiwan.harvest.plist"

if launchctl print "gui/$UID/md.taiwan.harvest" &>/dev/null; then
  launchctl bootout "gui/$UID/md.taiwan.harvest"
  echo "✅ Agent unloaded"
else
  echo "ℹ️  Agent not currently loaded"
fi

if [[ -f "$PLIST_DST" ]]; then
  rm "$PLIST_DST"
  echo "✅ Plist removed: $PLIST_DST"
else
  echo "ℹ️  Plist not found at $PLIST_DST"
fi

echo ""
echo "🧬 Harvest engine uninstalled. Logs at ~/Library/Logs/taiwan-md-harvest/ kept for reference."
