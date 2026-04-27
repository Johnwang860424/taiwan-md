#!/usr/bin/env bash
# Install Taiwan.md Harvest launchd agent
#
# Usage: bash install.sh
# Verify: launchctl print gui/$UID/md.taiwan.harvest
# Uninstall: bash uninstall.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="md.taiwan.harvest.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOG_DIR="$HOME/Library/Logs/taiwan-md-harvest"

if [[ ! -f "$PLIST_SRC" ]]; then
  echo "❌ Source plist not found: $PLIST_SRC" >&2
  exit 1
fi

# 1. Ensure log dir exists
mkdir -p "$LOG_DIR"
echo "✅ Log dir ready: $LOG_DIR"

# 2. If already loaded, bootout first (idempotent install)
if launchctl print "gui/$UID/md.taiwan.harvest" &>/dev/null; then
  echo "⏸  Existing agent loaded, removing first…"
  launchctl bootout "gui/$UID/md.taiwan.harvest" || true
fi

# 3. Copy plist
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"
echo "✅ Plist installed: $PLIST_DST"

# 4. Bootstrap
launchctl bootstrap "gui/$UID" "$PLIST_DST"
echo "✅ Agent bootstrapped"

# 5. Verify
sleep 2
if launchctl print "gui/$UID/md.taiwan.harvest" &>/dev/null; then
  echo ""
  echo "🧬 Harvest engine loaded. Status:"
  launchctl print "gui/$UID/md.taiwan.harvest" | grep -E '(state|pid|last exit)' | head -5
  echo ""
  echo "📡 Server should be reachable at http://localhost:4319/api/health"
  echo "📋 Logs: tail -f $LOG_DIR/{stdout,stderr}.log"
else
  echo "❌ Bootstrap claimed success but agent not visible. Check $LOG_DIR/stderr.log"
  exit 1
fi
