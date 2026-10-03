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
const FORMS = String.raw`V1-M\d+|AR-\d+(?:\.\d+)?|CO-\d+|M\d+(?:\.[a-z0-9-]+)?|L\d+[a-z]?|S\d+|AD\d{2}|OX-\d{2}|D\d{2}|N\d+|P-\d{2}|FR-[A-G]|MEM-P\d|F\d+`
const ID = new RegExp(String.raw`\b(?:${FORMS})(?![\w.-]*\w)`, 'g')
const WHOLE_ID = new RegExp(String.raw`^(?:${FORMS})$`)
/** A status cell that closes the work it describes. */
/** The status word stands alone — optionally dated — so a prerequisite like "Passed AD12 receipt…" does not read as one. */
const FINISHED = /^(?:\*\*)?(?:✅\s*)?(?:done|passed|shipped|landed|closed|merged|superseded)(?:\s+\d{4}-\d{2}-\d{2})?(?:\*\*)?\s*(?:$|[—–\-;:.,(])/i
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
    for (const line of text.split('\n')) {
      if (!line.startsWith('|')) continue
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (!cells.slice(1).some((c) => FINISHED.test(c))) continue
      for (const m of (cells[0] ?? '').matchAll(ID)) out.add(m[0])
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
      if (cells.slice(1).some((c) => FINISHED.test(c))) ownFinished.add(m[0])
    }
  }
  const defined = definedIds(files)
  const finished = finishedIds(files)
  const problems = []
  for (const id of citedIds(block)) if (!own.has(id) && !defined.has(id)) problems.push(`the plan cites ${id}, which no document under docs/ defines`)
  for (const lane of laneEntries(block)) {
    const ids = lane.entries.filter((e) => WHOLE_ID.test(e))
    for (const e of lane.entries) if (!WHOLE_ID.test(e)) problems.push(`lane "${lane.name}" names "${e}", which is not a work id of a form the plan knows`)
    if (ids.length === 0) problems.push(`lane "${lane.name}" cites no work`)
    for (const id of ids) if (finished.has(id) || ownFinished.has(id)) problems.push(`lane "${lane.name}" schedules ${id}, whose own row says it is finished`)
  }
  if (citedIds(block).size === 0) problems.push('the plan cites no work at all')
  return problems
}
// #endregion plan-ids
