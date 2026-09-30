#!/usr/bin/env bash
# #region workspace-sync-install — docs: docs/architecture/report-workspace.md#keeping-it-current
# Keeps Fabric Workspace current without anyone remembering to publish (Fabric ADR-0093).
#
#   scripts/install-workspace-sync.sh             install or repair (idempotent)
#   scripts/install-workspace-sync.sh --status    what is installed and the last log lines
#   scripts/install-workspace-sync.sh --uninstall remove the job; the checkout is left for inspection
#
# It makes a dedicated detached checkout of this repository's origin/main (sync moves it, so it
# is never a checkout anyone works in), initialises the workspace submodule with its Heroku
# remote, and registers a launchd job that runs `node scripts/workspace.mjs sync` every two
# hours. The job publishes only when `sync` finds something behind. No credential is written
# anywhere: git, gh and the Heroku CLI use the logins already on this Mac.
set -euo pipefail

LABEL="ai.passioncode.fabric-workspace-sync"
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
CHECKOUT="${FABRIC_WORKSPACE_SYNC_DIR:-$HOME/.cache/fabric-workspace/sync-checkout}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/fabric-workspace-sync.log"
INTERVAL="${FABRIC_WORKSPACE_SYNC_INTERVAL:-7200}"

case "${1:-install}" in
  --status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then echo "loaded: $LABEL (every ${INTERVAL}s)"; else echo "not loaded: $LABEL"; fi
    [ -d "$CHECKOUT" ] && echo "checkout: $CHECKOUT @ $(git -C "$CHECKOUT" rev-parse --short HEAD)"
    [ -f "$LOG" ] && { echo "last log lines:"; tail -5 "$LOG"; }
    exit 0 ;;
  --uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed $LABEL; the checkout $CHECKOUT is left for inspection"
    exit 0 ;;
  install) ;;
  *) echo "usage: $0 [--status|--uninstall]" >&2; exit 2 ;;
esac

for tool in git node heroku; do
  command -v "$tool" >/dev/null || { echo "NOT_RUN: $tool is not on PATH; the sync needs it" >&2; exit 2; }
done
HEROKU_APP="$(node -e 'process.stdout.write(require(process.argv[1]).heroku_app)' "$REPO/workspace.config.json")"

git -C "$REPO" fetch -q origin main
if [ ! -d "$CHECKOUT/.git" ] && [ ! -f "$CHECKOUT/.git" ]; then
  mkdir -p "$(dirname "$CHECKOUT")"
  git -C "$REPO" worktree add -q --detach "$CHECKOUT" origin/main
fi
git -C "$CHECKOUT" submodule update --init -q workspace
git -C "$CHECKOUT/workspace" remote get-url heroku >/dev/null 2>&1 \
  || git -C "$CHECKOUT/workspace" remote add heroku "https://git.heroku.com/$HEROKU_APP.git"
[ -d "$CHECKOUT/workspace/node_modules" ] || (cd "$CHECKOUT/workspace" && npm ci --silent)

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
NODE="$(command -v node)"
cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE</string><string>scripts/workspace.mjs</string><string>sync</string>
  </array>
  <key>WorkingDirectory</key><string>$CHECKOUT</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$PATH</string>
    <key>FABRIC_WORKSPACE_SYNC_CHECKOUT</key><string>$CHECKOUT</string>
  </dict>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><false/>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed $LABEL: every ${INTERVAL}s in $CHECKOUT; log $LOG"
echo "NEXT: run it once now with: launchctl kickstart gui/$(id -u)/$LABEL"
# #endregion workspace-sync-install
