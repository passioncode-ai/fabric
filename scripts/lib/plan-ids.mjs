// #region plan-ids — docs: docs/adr/0101-the-general-development-plan.md#decision
// The general development plan names work only by ids that resolve (ADR-0101 §2). An id resolves
// when some Markdown document under docs/ — other than the plan section itself — holds it as the
// first cell of a table row, in a heading, or as the name of a file `<id>.md`. Pure over a file map,
// so the gate and its test read the same rule.

export const PLAN_BEGIN = '<!-- general-plan:begin -->'
export const PLAN_END = '<!-- general-plan:end -->'
const ID = /\b(?:V1-M\d+|AR-\d+(?:\.\d+)?|CO-\d+|M\d+(?:\.[a-z0-9-]+)?|L\d+[a-z]?|S\d+|AD\d{2}|OX-\d{2}|D\d{2}|N\d+|P-\d{2})\b/g

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
    const text = text0.includes(PLAN_BEGIN) ? text0.slice(0, text0.indexOf(PLAN_BEGIN)) + text0.slice(text0.indexOf(PLAN_END) + PLAN_END.length) : text0
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

/** The plan's own P-* rows define themselves; everything else must resolve elsewhere. */
export function planProblems(backlog, files) {
  const a = backlog.indexOf(PLAN_BEGIN), b = backlog.indexOf(PLAN_END)
  if (a < 0 || b < a) return ['the general plan block (general-plan:begin/end) is missing from docs/evidence/backlog.md']
  const block = backlog.slice(a, b)
  const own = new Set()
  for (const line of block.split('\n')) {
    const first = line.startsWith('|') ? line.split('|')[1] ?? '' : ''
    for (const m of first.matchAll(/\bP-\d{2}\b/g)) own.add(m[0])
  }
  const defined = definedIds(files)
  const problems = []
  for (const id of citedIds(block)) if (!own.has(id) && !defined.has(id)) problems.push(`the plan cites ${id}, which no document under docs/ defines`)
  if (citedIds(block).size === 0) problems.push('the plan cites no work at all')
  return problems
}
// #endregion plan-ids
