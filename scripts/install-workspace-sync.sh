#!/usr/bin/env bash
# #region workspace-sync-install — docs: docs/architecture/report-workspace.md#keeping-it-current
# Keeps Fabric Workspace current without anyone remembering to publish (Fabric ADR-0093).
#
#   scripts/install-workspace-sync.sh             install or repair (idempotent)
#   scripts/install-workspace-sync.sh --status    what is installed and the last log lines
#   scripts/install-workspace-sync.sh --uninstall remove the job; the checkout is left for inspection
#   scripts/install-workspace-sync.sh --uninstall --purge   also remove the checkout (git worktree), source mirrors, state and logs (LC-14)
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
LOG="$HOME/Library/Logs/Fabric/workspace-sync.log"
OLD_LOG="$HOME/Library/Logs/fabric-workspace-sync.log"
STATE="${FABRIC_WORKSPACE_STATE_DIR:-$HOME/.cache/fabric-workspace}"
INTERVAL="${FABRIC_WORKSPACE_SYNC_INTERVAL:-7200}"

case "${1:-install}" in
  --status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then echo "loaded: $LABEL (every ${INTERVAL}s)"; else echo "not loaded: $LABEL"; fi
    [ -d "$CHECKOUT" ] && echo "checkout: $CHECKOUT @ $(git -C "$CHECKOUT" rev-parse --short HEAD)"
    [ -f "$STATE/sync-status.json" ] && { echo "last run:"; cat "$STATE/sync-status.json"; }
    [ -f "$LOG" ] && { echo "last log lines:"; tail -5 "$LOG"; }
    exit 0 ;;
  --uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    # Wait until launchd has really let go, so a reinstall right after does not race the unload.
    for _ in 1 2 3 4 5 6 7 8 9 10; do launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break; sleep 0.5; done
    rm -f "$PLIST"
    if [ "${2:-}" = "--purge" ]; then
      # Only directories under ~/.cache are ever removed by --purge, judged by their REAL path, so neither a
      # variable pointing elsewhere nor "~/.cache/.." can widen it to the home folder (third review).
      under_cache() { local real; real="$(cd "$1" 2>/dev/null && pwd -P)" || return 1; case "$real" in "$(cd "$HOME/.cache" && pwd -P)"/?*) return 0 ;; *) return 1 ;; esac; }
      if [ -e "$CHECKOUT" ]; then
        if under_cache "$CHECKOUT"; then git -C "$REPO" worktree remove --force "$CHECKOUT" 2>/dev/null || rm -rf "$CHECKOUT"; git -C "$REPO" worktree prune
        else echo "refusing to purge $CHECKOUT: not under $HOME/.cache" >&2; fi
      fi
      if [ -e "$STATE" ]; then
        if under_cache "$STATE"; then rm -rf "$STATE"; else echo "refusing to purge $STATE: not under $HOME/.cache" >&2; fi
      fi
      rm -f "$LOG" "$LOG".[0-9]* "$OLD_LOG" "$OLD_LOG".[0-9]*
      echo "removed $LABEL, its checkout, state and logs"
    else
      echo "removed $LABEL; the checkout $CHECKOUT is left for inspection (--uninstall --purge removes it)"
    fi
    exit 0 ;;
  install) ;;
  *) echo "usage: $0 [--status|--uninstall [--purge]]" >&2; exit 2 ;;
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

mkdir -p "$(dirname "$PLIST")"
# The log lives in the product's own directory, owner-only (LC-12); launchd appends to it and the job
# rotates it by copy-truncate. The old root-level log is retired.
mkdir -p "$(dirname "$LOG")" && chmod 700 "$(dirname "$LOG")"
[ -f "$LOG" ] || : > "$LOG"
chmod 600 "$LOG"
rm -f "$OLD_LOG" "$OLD_LOG".[0-9]*
NODE="$(command -v node)"
# A minimal PATH from the tools the job and the fast gate call, never the whole interactive one: a captured
# shell PATH carries plugin directories that later disappear (lifecycle audit, observatory F13). It keeps the
# interactive PATH's ORDER, so each tool resolves to the same binary as in the shell where the gate passes —
# prepending each tool's directory put /usr/local/bin's python3 (no jsonschema) ahead of Homebrew's and the
# scheduled gate failed where the interactive one passed (2026-10-03).
NEEDED_DIRS=""
for tool in node git heroku pnpm npm python3 rg docker supabase gh uv; do
  p="$(command -v "$tool" 2>/dev/null)" || continue
  NEEDED_DIRS="$NEEDED_DIRS:$(dirname "$p"):"
done
JOB_PATH=""
IFS=: read -r -a PATH_PARTS <<< "$PATH"
for d in "${PATH_PARTS[@]}"; do
  case "$NEEDED_DIRS" in *":$d:"*) case ":$JOB_PATH:" in *":$d:"*) ;; *) JOB_PATH="${JOB_PATH:+$JOB_PATH:}$d" ;; esac ;; esac
done
for d in /usr/bin /bin /usr/sbin /sbin; do case ":$JOB_PATH:" in *":$d:"*) ;; *) JOB_PATH="$JOB_PATH:$d" ;; esac; done
# launchd gives a job no locale. PostgreSQL refuses to start without one on macOS ("postmaster became
# multithreaded during startup"), so every owned-cluster runner of the fast gate failed in the job while it
# passed in the shell (2026-10-03 13:12Z to 2026-10-04 01:05Z). The job carries the shell's LANG.
JOB_LANG="${LANG:-en_US.UTF-8}"
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
    <key>PATH</key><string>$JOB_PATH</string>
    <key>LANG</key><string>$JOB_LANG</string>
    <key>FABRIC_WORKSPACE_SYNC_CHECKOUT</key><string>$CHECKOUT</string>
    <key>FABRIC_WORKSPACE_SYNC_LOG</key><string>$LOG</string>
  </dict>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><false/>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
  <key>ProcessType</key><string>Background</string>
  <!-- Longer than the job's own stop path (it kills its step groups and writes its status). -->
  <key>ExitTimeOut</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed $LABEL: every ${INTERVAL}s in $CHECKOUT; log $LOG"
echo "NEXT: run it once now with: launchctl kickstart gui/$(id -u)/$LABEL"
# #endregion workspace-sync-install
