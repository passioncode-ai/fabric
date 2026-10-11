// A merge's conflict markers left in a tracked file (2026-10-11: a merge commit carried two unresolved blocks in
// docs/reports/map.html and every documentation gate passed, because none of them parses for markers).
// A marker is a line that starts with exactly seven '<', '=' or '>' — the shapes git writes — so prose that
// mentions the characters, or a Markdown table rule, does not count.
const OPEN = /^<{7}(?: |$)/
const MID = /^={7}$/
const CLOSE = /^>{7}(?: |$)/

/** The 1-based line numbers of conflict blocks in `text`, as `[open, mid, close]` triples (mid/close 0 if absent). */
export function conflictBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    if (!OPEN.test(lines[i])) continue
    let mid = 0
    let close = 0
    for (let j = i + 1; j < lines.length; j++) {
      if (!mid && MID.test(lines[j])) mid = j + 1
      else if (CLOSE.test(lines[j])) { close = j + 1; break }
    }
    if (mid || close) blocks.push([i + 1, mid, close])
  }
  return blocks
}
