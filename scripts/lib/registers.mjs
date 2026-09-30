// Reading a register so that a row cannot be invisible.
//
// FA-10, and the file this serves records the same failure twice in its own
// comments. `verification.md`'s row pattern was `[A-Z]{2,3}-REQ-`; the five
// BRAND-REQ rows were outside every number ever quoted about the ledger (M115),
// the pattern was widened, and then a prefix carrying a DIGIT was invisible in
// exactly the same way (FA-01) — revealing eleven rows when ten had been added,
// because `HARNESS-REQ-004` had been outside every count since it was written.
//
// Both times the discovery method was the same: add a row, watch the total
// refuse to move. That is not a method, it is luck with a good habit attached.
// The shape is that A COUNTER WITH A PATTERN REPORTS A SMALLER REGISTER WITH
// TOTAL CONFIDENCE, and widening the pattern a third time would leave the shape
// intact and wait for the fourth prefix nobody thought of.
//
// So rows are found STRUCTURALLY — every data row of every table under a header
// this register declares — and the id pattern is used only to say whether a row
// is WELL FORMED. A row that looks like data and does not parse is returned as a
// problem, so the gate refuses instead of the count shrinking.

import { cell, cells } from './markdown-table.mjs'

const SEPARATOR = /^\|[\s:|-]+\|\s*$/

/**
 * The columns of a row, in the form every comparison here wants them.
 *
 * Read through `cell`, not `cells`: the raw split keeps the whitespace either
 * side of a value and the emphasis markers a status carries, and a comparison
 * against those is how a register full of `** resolved **` reads as a register
 * full of unknown values. Two of the three ad-hoc counts written while
 * measuring this card were wrong for exactly this reason — an id compared as
 * `" AB-REQ-001 "` matches no pattern at all.
 *
 * Index 0 is the first column a reader sees: `cells` keeps an empty element for
 * the opening pipe and another for the closing one, and both are dropped.
 */
function columns(line) {
  const raw = cells(line)
  let end = raw.length
  while (end > 0 && String(raw[end - 1]).trim() === '') end--
  const out = []
  for (let i = 1; i < end; i++) out.push(cell(line, i))
  return out
}

/**
 * Every data row of every table whose header row matches `header`.
 *
 * A table ends at the first line that is not a row — a heading, a paragraph, a
 * blank line — which is what makes this structural rather than a guess about
 * ids. `header` is a predicate over the header row's cells, because this
 * repository's registers do not agree on a spelling: `verification.md` has
 * tables headed `| REQ |` and tables headed `| Requirement |`, and a reader
 * that knew one of them counted 42 header rows as data (measured 2026-09-10,
 * while writing this).
 */
export function tableRows(text, header) {
  const lines = String(text).split('\n')
  const rows = []
  let inTable = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|')) {
      inTable = false
      continue
    }
    if (SEPARATOR.test(line)) continue
    const c = columns(line)
    if (!inTable) {
      // A header is only a header if the line under it is a separator.
      if (header(c) && SEPARATOR.test(lines[i + 1] ?? '')) inTable = true
      continue
    }
    rows.push({ line: i + 1, cells: c, text: line })
  }
  return rows
}

/**
 * Split a register's rows into the ones that parse and the ones that do not.
 *
 * `id` is a predicate over the first cell. Everything that reached here is a
 * data row inside a declared table, so a first cell that does not look like an
 * id is a MALFORMED ROW, not a row to skip: skipping it is how the register
 * ends up holding more than any count of it.
 */
export function classify(rows, id) {
  const wellFormed = []
  const malformed = []
  for (const row of rows) (id(row.cells[0] ?? '') ? wellFormed : malformed).push(row)
  return { wellFormed, malformed }
}
