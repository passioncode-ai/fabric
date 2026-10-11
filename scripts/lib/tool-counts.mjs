// #region tool-counts-in-prose — docs: docs/reports/2026-10-05-release-032-audit/raw/2026-10-05-architecture.md#fabric-032-rc--architecture-audit
// A tool count written in a sentence, which nothing recomputes (scripts/check-surface-tools.mjs). In words
// ("Sixteen tools") or in digits ("17 tools", "**17 tools**") — the architecture documents wrote theirs in
// digits, and the gate that read only words passed while they said 16/11 and 17 against a measured 27/19
// (audit 2026-10-05 A7-040). Comment lines are skipped, and only lines about tools or the harness are read.
// "25+ tools" quotes a threshold, not a count of ours, and is not matched.

const WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s+tools?\b/i
const DIGITS = /(?<![\d+.§])\b\d+\s+(?:MCP\s+)?tools?\b(?![-+])/i

/** Each line of `text` that writes a tool count: `{ line, count }`, line numbers from 1. */
export function toolCountsInProse(text) {
  const found = []
  String(text).split('\n').forEach((raw, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
    const line = raw.replace(/\/\/.*$/, '')
    if (!/harness|tool/i.test(line)) return
    const m = line.match(WORDS) ?? line.match(DIGITS)
    if (m) found.push({ line: i + 1, count: m[0] })
  })
  return found
}
// #endregion tool-counts-in-prose
