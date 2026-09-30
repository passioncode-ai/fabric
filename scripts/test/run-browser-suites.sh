#!/usr/bin/env bash
# Every mockup browser suite, run against the built reports with one browser.
#
# Needs an installed Playwright package and an installed Chrome; nothing is
# downloaded. Without them the suites are NOT_RUN and this says so — a skipped
# browser check is not a pass (CO-171: ten suites rotted for weeks unrun).
#
#   FABRIC_PLAYWRIGHT_MODULE  path to an installed `playwright` package directory
#   FABRIC_CHROME             path to a Chrome executable
set -uo pipefail
cd "$(dirname "$0")/../.."
if [[ -z "${FABRIC_PLAYWRIGHT_MODULE:-}" || -z "${FABRIC_CHROME:-}" ]]; then
  echo "NOT_RUN browser suites: set FABRIC_PLAYWRIGHT_MODULE and FABRIC_CHROME to run them"
  exit 0
fi
export PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-$FABRIC_PLAYWRIGHT_MODULE/index.mjs}"
port=8770
python3 -m http.server "$port" --bind 127.0.0.1 --directory docs >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$port/reports/product.html" && break; sleep 0.1; done
failed=0; ran=0
for suite in scripts/test/*.browser.mjs scripts/test/*.browser.cjs; do
  ran=$((ran+1))
  if log=$(node "$suite" 2>&1); then echo "  ok   $(basename "$suite")"
  else failed=$((failed+1)); echo "  FAIL $(basename "$suite")"; echo "$log" | grep -v '^\s*at ' | grep -E 'Error|FAIL|actual|expected' | head -3 | sed 's/^/       /'; fi
done
echo "browser suites: $((ran-failed)) of $ran pass"
[[ $failed -eq 0 ]]
