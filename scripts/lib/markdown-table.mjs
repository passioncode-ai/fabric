// One reading of a Markdown table row (FA-05).
//
// MEASURED at d28c321 and still true on 2026-09-10: the registers are counted by
// splitting a row on `|`, and two rows — CO-050 and CO-060 — contain an ESCAPED
// pipe inside a cell. A bare split shifts every column after it, so the status
// read for those two rows is a fragment of the sentence before it. The register
// held 101 open carry-over rows and every number quoted about it said 99.
//
// The discrepancy was KNOWN and carried in the prose: the backlog's own exposure
// sentence said "99 by the legacy counter (101 with escaped-pipe parsing)". Two
// numbers for one fact, both published, and the reader left to pick. A register
// that cannot say how many rows it has cannot be the thing other documents cite.
//
// So there is ONE parser, and every counter and every column check uses it.
// Escaping is the Markdown rule: `\|` is a literal pipe inside a cell, and a
// splitter that does not know that is reading a different table from the one a
// person sees.

/**
 * The cells of a Markdown table row, split on unescaped pipes.
 *
 * Index 0 is the empty string before the leading pipe, so `cells(row)[1]` is the
 * first column — the same indexing the callers already used, deliberately, so
 * moving them to this function could not silently renumber anything.
 */
export function cells(row) {
  return row.split(/(?<!\\)\|/)
}

/**
 * One cell, trimmed of the leading whitespace and bold markers a status carries.
 *
 * `**shipped**` and `shipped` are the same status written two ways, and a
 * comparison that saw them as different would report a register full of unknown
 * values rather than a register with emphasis in it.
 */
export function cell(row, index) {
  // BOTH ends. The counter this replaces stripped only the leading markers,
  // which is enough for a `startsWith` and wrong for an equality — so a status
  // written `**shipped**` compared equal to nothing and a register full of
  // emphasis read as a register full of unknown values.
  return (cells(row)[index] ?? '').replace(/^[\s*]+/, '').replace(/[\s*]+$/, '')
}

/** Does this row contain an escaped pipe? Used to prove the parser is exercised
 *  rather than merely present: a rule nothing triggers is a rule nobody tested. */
export function hasEscapedPipe(row) {
  return /\\\|/.test(row)
}
