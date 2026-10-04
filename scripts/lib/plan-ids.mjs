// #region plan-ids — docs: docs/adr/0101-the-general-development-plan.md#decision
// The general development plan names work only by ids that resolve (ADR-0101 §2). An id resolves
// when some Markdown document under docs/ — other than the plan section itself — holds it as the
// first cell of a table row, in a heading, or as the name of a file `<id>.md`. A lane names its work
// in its last cell as a comma list: every entry must be a whole id of a known form (an id-shaped token
// of an unknown form is refused, not skipped), a lane must name at least one id, and it must not
// schedule work whose defining row already says it is finished. Pure over a file map, so the gate and
// its test read the same rule.

export const PLAN_BEGIN = '<!-- general-plan:begin -->'
export const PLAN_END = '<!-- general-plan:end -->'
const FORMS = String.raw`V1-M\d+|AR-\d+(?:\.\d+)?|CO-\d+|COM-\d{2}|M\d+(?:\.[a-z0-9-]+)?|L\d+[a-z]?|S\d+|AD\d{2}|OX-\d{2}|D\d{2}|N\d+|P-\d{2}|FR-[A-G]|MEM-P\d|F\d+`
const ID = new RegExp(String.raw`\b(?:${FORMS})(?![\w.-]*\w)`, 'g')
const WHOLE_ID = new RegExp(String.raw`^(?:${FORMS})$`)
/** A status cell that closes the work it describes. */
/**
 * A status that closes the work: every closing word the workspace's own `normalizeStatus` knows
 * (`workspace/lib/backlog.mjs` — done and cancelled; the test checks the two agree), plus this
 * repository's `passed`, `landed`, `merged`. Markup is stripped first (`**shipped** 2026-10-03`), and the
 * word must stand alone — optionally dated — so a prerequisite like "Passed AD12 receipt…" is not one.
 */
export const CLOSING_WORDS = ['done', 'closed', 'resolved', 'shipped', 'complete', 'completed', 'закрыто', 'готово', 'решено',
  'cancelled', 'canceled', 'dropped', 'superseded', 'отменено', 'passed', 'landed', 'merged']
const FINISHED = new RegExp(String.raw`^(?:✅\s*)?(?:${CLOSING_WORDS.join('|')})(?:\s+\d{4}-\d{2}-\d{2})?\s*(?:$|[—–\-;:.,(])`, 'iu')
const plain = (cell) => cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').trim()
export const isFinished = (cell) => FINISHED.test(plain(cell))
/**
 * A STATUS cell — one read by its column header — is classified by the workspace's own prefix rule
 * (`normalizeStatus`: the closing word leads, whatever follows — "closed 2026-08-26 by ADR-0011",
 * "shipped on 2026-10-03", "done in PR #12"; iteration 3 found the standalone rule too narrow there).
 * The standalone rule above stays only for tables with no status header, where any cell may be a
 * prerequisite like "Passed AD12 receipt…".
 */
const CLOSING_PREFIX = new RegExp(String.raw`^(?:✅\s*)?(?:${CLOSING_WORDS.join('|')})(?=$|[\s\p{P}])`, 'iu')
export const isFinishedStatus = (cell) => CLOSING_PREFIX.test(plain(cell).toLowerCase())
const STATUS_HEADER = /^(status|статус|work card \/ acceptance)$/i

/** Each table row with its cells and the index of its status column (by header), or -1. */
/** Cells of a row, split on unescaped pipes (`a \\| b` is one cell), with leading indentation allowed. */
const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
const isDelimiter = (line) => /^\s*\|\s*:?-/.test(line ?? '')

function tableRows(text) {
  const rows = []
  const lines = text.split('\n')
  let statusAt = -1
  let inTable = false
  let headed = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trimStart().startsWith('|')) { inTable = false; headed = false; statusAt = -1; continue }
    if (isDelimiter(line)) continue
    const cells = cellsOf(line)
    if (!inTable && isDelimiter(lines[i + 1])) { statusAt = cells.findIndex((c) => STATUS_HEADER.test(plain(c))); inTable = true; headed = true; continue }
    inTable = true
    rows.push({ cells, statusAt, headed })
  }
  return rows
}
/** A lane row: its first cell is `<n> · <name>`. */
const LANE = /^\s*\d+\s*·/

/** Ids the plan cites: every table cell of the plan block after the first (the lane's own id). */
export function citedIds(planBlock) {
  const ids = new Set()
  for (const line of planBlock.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue
    for (const c of line.split('|').slice(2, -1)) for (const m of c.matchAll(ID)) ids.add(m[0])
  }
  return ids
}

/** Every id some document defines, outside the plan block. */
export function definedIds(files) {
  const out = new Set()
  for (const [name, text0] of Object.entries(files)) {
    const base = name.split('/').pop()
    const fileId = base.replace(/\.md$/, '')
    if (/^(AD\d{2}|OX-\d{2}|D\d{2}|P-\d{2})$/.test(fileId)) out.add(fileId)
    const text = withoutPlan(text0)
    for (const line of text.split('\n')) {
      if (line.startsWith('|')) {
        const first = line.split('|')[1] ?? ''
        for (const m of first.matchAll(ID)) out.add(m[0])
      } else if (/^#{1,6}\s/.test(line)) {
        for (const m of line.matchAll(ID)) out.add(m[0])
      }
    }
  }
  return out
}

/** Ids whose defining row (outside the plan block) carries a finished status in a later cell. */
export function finishedIds(files) {
  const out = new Set()
  for (const text0 of Object.values(files)) {
    const text = withoutPlan(text0)
    for (const { cells, statusAt } of tableRows(text)) {
      const finished = statusAt > 0 ? isFinishedStatus(cells[statusAt] ?? '') : cells.slice(1).some(isFinished)
      if (!finished) continue
      for (const m of (cells[0] ?? '').matchAll(ID)) out.add(m[0])
    }
  }
  // Adoption packets keep their state in a `Status:` line and a receipt; a receipt outranks the line.
  for (const [name, text] of Object.entries(files)) {
    const id = name.split('/').pop().replace(/\.(md|json)$/, '')
    if (!/^AD\d{2}$/.test(id)) continue
    if (name.endsWith('.json')) {
      try { if (isFinished(String(JSON.parse(text).status ?? ''))) out.add(id) } catch { /* an unreadable receipt proves nothing */ }
    } else {
      const m = /^Status:\s*(.+)$/m.exec(text)
      if (m && isFinished(m[1])) out.add(id)
    }
  }
  return out
}

function withoutPlan(text) {
  const a = text.indexOf(PLAN_BEGIN)
  return a < 0 ? text : text.slice(0, a) + text.slice(text.indexOf(PLAN_END) + PLAN_END.length)
}

/** Each lane row's name and the entries of its last cell (links reduced to their text). */
export function laneEntries(planBlock) {
  const lanes = []
  for (const line of planBlock.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (!LANE.test(cells[0] ?? '')) continue
    const last = (cells.at(-1) ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    lanes.push({ name: cells[0], entries: last.split(',').map((e) => e.trim()).filter((e) => e && e !== '—' && e !== '-') })
  }
  return lanes
}

/** The plan's own P-* rows define themselves; everything else must resolve elsewhere. */
export function planProblems(backlog, files) {
  const a = backlog.indexOf(PLAN_BEGIN), b = backlog.indexOf(PLAN_END)
  if (a < 0 || b < a) return ['the general plan block (general-plan:begin/end) is missing from docs/evidence/backlog.md']
  const block = backlog.slice(a, b)
  const own = new Set(), ownFinished = new Set()
  for (const line of block.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    for (const m of (cells[0] ?? '').matchAll(/\bP-\d{2}\b/g)) {
      own.add(m[0])
      if (cells.slice(1).some(isFinished)) ownFinished.add(m[0])
    }
  }
  const defined = definedIds(files)
  const finished = finishedIds(files)
  const problems = []
  // A P-id is the plan's own row, nothing else: P-01…P-06 are also personas (docs/ux/foundation.md).
  for (const id of citedIds(block)) {
    if (/^P-\d{2}$/.test(id) ? !own.has(id) : !own.has(id) && !defined.has(id))
      problems.push(/^P-\d{2}$/.test(id) ? `the plan cites ${id}, which is not a row of the plan's own table` : `the plan cites ${id}, which no document under docs/ defines`)
  }
  for (const lane of laneEntries(block)) {
    const ids = lane.entries.filter((e) => WHOLE_ID.test(e))
    for (const e of lane.entries) if (!WHOLE_ID.test(e)) problems.push(`lane "${lane.name}" names "${e}", which is not a work id of a form the plan knows`)
    if (ids.length === 0) problems.push(`lane "${lane.name}" cites no work`)
    for (const id of ids) if (finished.has(id) || ownFinished.has(id)) problems.push(`lane "${lane.name}" schedules ${id}, whose own row says it is finished`)
  }
  if (citedIds(block).size === 0) problems.push('the plan cites no work at all')
  // Every open carry-over row has a lane (iteration 3: lane 12 claimed the leftovers while 132 were in none).
  const ledgerPath = 'docs/evidence/specs/2026-08-16-software-fabric-carryover.md'
  const ledger = files[ledgerPath]
  if (ledger === undefined) problems.push(`the carry-over ledger ${ledgerPath} is missing, so open rows cannot be checked against the lanes`)
  else {
    const inLanes = new Set(laneEntries(block).flatMap((l) => l.entries))
    for (const { cells, statusAt, headed } of tableRows(ledger)) {
      const id = plain(cells[0] ?? '')
      if (!/^CO-\d+$/.test(id)) continue
      if (!headed || statusAt < 0) { problems.push(`carry-over ${id} sits in a table with no Status column, so whether it is open cannot be read`); continue }
      if (isFinishedStatus(cells[statusAt] ?? '')) continue
      if (!inLanes.has(id)) problems.push(`carry-over ${id} is open and cited by no lane`)
    }
  }
  return problems
}
// #endregion plan-ids
