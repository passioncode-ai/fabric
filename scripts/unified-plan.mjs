// #region unified-plan — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { readFileSync, existsSync, realpathSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

export const REPORT = 'docs/reports/2026-10-04-unified-execution'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const safePath = p => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.split(/[\\/]/).some(x => x === '..' || x === '')
const present = x => typeof x === 'string' ? x.trim().length > 0 : Array.isArray(x) ? x.length > 0 : x && typeof x === 'object' && Object.keys(x).length > 0
export function canonicalLanes(text) {
  const section = text.split('<!-- general-plan:begin -->')[1]?.split('<!-- general-plan:end -->')[0]
  if (!section) throw new Error('canonical general-plan markers missing')
  return section.split('\n').filter(x => /^\| \d+ ·/.test(x)).map(line => {
    const cells = line.split('|').map(x => x.trim())
    return { number: Number(cells[1].match(/^\d+/)[0]), canonical_ids: cells.at(-2).split(',').map(x => x.trim()) }
  })
}
export function validatePlan(plan, root) {
  const problems = []
  if (plan.schema !== 1) problems.push('unsupported schema')
  if (!/^[a-f0-9]{40}$/.test(plan.baseline ?? '')) problems.push('missing full source revision')
  if (!present(plan.constraints)) problems.push('missing program constraints')
  const tasks = plan.tasks ?? [], ids = new Set()
  const pinned = new Set((plan.sources ?? []).map(s => s.path))
  if (pinned.size !== (plan.sources ?? []).length) problems.push('duplicate source pins')
  for (const t of tasks) {
    if (!t.id || ids.has(t.id)) problems.push(`duplicate or absent task ${t.id}`)
    ids.add(t.id)
    if (!t.title || !present(t.canonical_ids)) problems.push(`${t.id}: missing title/canonical ids`)
    if (!Number.isInteger(t.priority_group) || t.priority_group < 0) problems.push(`${t.id}: invalid priority group`)
    if (!['candidate', 'design-gated', 'owned-elsewhere', 'operator-gated', 'done'].includes(t.dispatch)) problems.push(`${t.id}: unknown dispatch state`)
    if (t.dispatch === 'candidate' && ['design-review', 'activation-design', 'implementation'].includes(t.kind) && !t.id.endsWith('.prepare')) problems.push(`${t.id}: broad parent cannot dispatch without reviewed bounded leaf`)
    if (t.dispatch === 'done') {
      if (!safePath(t.evidence?.path) || !/^[a-f0-9]{64}$/.test(t.evidence?.sha256 ?? '')) problems.push(`${t.id}: done without digest-bound evidence`)
      else {
        try { if (hash(readFileSync(resolve(root, t.evidence.path))) !== t.evidence.sha256) problems.push(`${t.id}: evidence changed`) }
        catch { problems.push(`${t.id}: evidence unreadable`) }
      }
    }
    for (const k of ['outcome', 'sources', 'scope', 'steps', 'acceptance', 'risks', 'stop_conditions', 'resume'])
      if (!present(t.context?.[k])) problems.push(`${t.id}: missing context ${k}`)
    for (const p of t.context?.scope ?? []) {
      if (!safePath(p)) { problems.push(`${t.id}: unsafe write scope ${p}`); continue }
      let ancestor = resolve(root, p)
      while (!existsSync(ancestor) && ancestor !== dirname(ancestor)) ancestor = dirname(ancestor)
      const inside = relative(realpathSync(root), realpathSync(ancestor))
      if (inside.startsWith('..') || inside.startsWith('/')) problems.push(`${t.id}: write scope escapes repository ${p}`)
    }
    for (const p of t.context?.sources ?? []) {
      const base = typeof p === 'string' ? p.split('#')[0] : ''
      if (!safePath(p) || !existsSync(resolve(root, base))) problems.push(`${t.id}: source missing ${p}`)
      if (!pinned.has(base)) problems.push(`${t.id}: unpinned context source ${p}`)
    }
    for (const d of t.depends_on ?? []) if (!present(d.carries)) problems.push(`${t.id}: missing dependency payload ${d.id}`)
  }
  const byId = new Map(tasks.map(t => [t.id, t]))
  for (const t of tasks) for (const d of t.depends_on ?? []) if (!byId.has(d.id)) problems.push(`${t.id}: unknown dependency ${d.id}`)
  const visiting = new Set(), visited = new Set()
  const walk = id => {
    if (visiting.has(id)) { problems.push(`dependency cycle at ${id}`); return }
    if (visited.has(id)) return
    visiting.add(id)
    for (const d of byId.get(id)?.depends_on ?? []) if (byId.has(d.id)) walk(d.id)
    visiting.delete(id); visited.add(id)
  }
  for (const id of ids) walk(id)
  for (const s of plan.sources ?? []) {
    if (!safePath(s.path)) { problems.push(`unsafe source path ${s.path}`); continue }
    try { if (hash(readFileSync(resolve(root, s.path))) !== s.sha256) problems.push(`source changed: ${s.path}`) }
    catch { problems.push(`source unreadable: ${s.path}`) }
  }
  if (!(plan.sources ?? []).some(s => s.path === 'docs/evidence/backlog.md')) problems.push('canonical backlog not pinned')
  try {
    const lanes = canonicalLanes(readFileSync(resolve(root, 'docs/evidence/backlog.md'), 'utf8'))
    const mapped = new Set(tasks.flatMap(t => t.canonical_ids ?? []))
    for (const lane of lanes) {
      const planned = plan.lanes?.find(x => x.number === lane.number)
      if (!planned || JSON.stringify([...planned.canonical_ids].sort()) !== JSON.stringify([...lane.canonical_ids].sort())) problems.push(`lane ${lane.number}: canonical coverage drift`)
      for (const id of lane.canonical_ids) if (!mapped.has(id)) problems.push(`${id}: uncovered canonical work`)
    }
    if (plan.lanes?.length !== lanes.length) problems.push('lane count drift')
  } catch (e) { problems.push(e.message) }
  const canon = new Set(plan.lanes?.flatMap(l => l.canonical_ids) ?? [])
  const impactIds = new Set()
  for (const impact of plan.impacts ?? []) {
    if (!impact.id || impactIds.has(impact.id)) problems.push(`duplicate impact ${impact.id}`)
    impactIds.add(impact.id)
    if (!present(impact.evidence) || !present(impact.action)) problems.push(`${impact.id}: impact lacks evidence/action`)
    if (!Array.isArray(impact.targets) || !impact.targets.length) problems.push(`${impact.id}: impact needs nonempty targets`)
    if (!['blocking', 'advisory'].includes(impact.severity) || !['open', 'incorporated', 'retracted', 'noted'].includes(impact.disposition)) problems.push(`${impact.id}: invalid impact state`)
    if (impact.disposition !== 'open' && !present(impact.resolution)) problems.push(`${impact.id}: disposition without resolution`)
    for (const id of impact.targets ?? []) if (!ids.has(id) && !canon.has(id)) problems.push(`${impact.id}: unknown impact target ${id}`)
  }
  return [...new Set(problems)].sort()
}
function descendants(tasks, id, seen = new Set()) {
  for (const t of tasks) if ((t.depends_on ?? []).some(x => x.id === id) && !seen.has(t.id)) { seen.add(t.id); descendants(tasks, t.id, seen) }
  return seen.size
}
export function frontier(plan) {
  const tasks = plan.tasks ?? []
  const blockedImpact = t => (plan.impacts ?? []).filter(i => i.severity === 'blocking' && i.disposition === 'open' && i.targets.some(id => id === t.id || t.canonical_ids.includes(id)))
  const done = new Set(tasks.filter(t => t.dispatch === 'done' && safePath(t.evidence?.path) && /^[a-f0-9]{64}$/.test(t.evidence?.sha256 ?? '') && !blockedImpact(t).length).map(t => t.id))
  const ready = [], held = []
  for (const t of tasks) {
    if (t.dispatch === 'done') continue
    const reasons = []
    if (t.dispatch !== 'candidate') reasons.push(t.dispatch)
    for (const d of t.depends_on ?? []) if (!done.has(d.id)) reasons.push(`requires ${d.id}: ${d.carries}`)
    for (const i of blockedImpact(t)) reasons.push(`impact ${i.id}`)
    if (reasons.length) held.push({id: t.id, reasons})
    else ready.push({id: t.id, title: t.title, kind: t.kind, priority_group: t.priority_group, unblocks: descendants(tasks, t.id)})
  }
  ready.sort((a,b) => a.priority_group - b.priority_group || b.unblocks - a.unblocks || a.id.localeCompare(b.id, 'en'))
  return {ready, held}
}
export function taskPacket(plan, id) {
  const task = plan.tasks.find(t => t.id === id)
  if (!task) throw new Error(`unknown task ${id}`)
  return { baseline: plan.baseline, constraints: plan.constraints, source_pins: plan.sources.filter(s => task.context.sources.some(p => p.split('#')[0] === s.path)), task,
    impacts: (plan.impacts ?? []).filter(i => i.targets.some(x => x === id || task.canonical_ids.includes(x))) }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const [verb = 'check', id] = process.argv.slice(2)
    const plan = JSON.parse(readFileSync(resolve(root, REPORT, 'plan.json'), 'utf8'))
    const problems = validatePlan(plan, root)
    if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1 }
    else if (verb === 'check') console.log(`PASS: ${plan.lanes.length} lanes, ${plan.tasks.length} packets; sources, coverage, dependencies and impacts valid`)
    else if (verb === 'next') console.log(JSON.stringify(frontier(plan), null, 2))
    else if (verb === 'packet') console.log(JSON.stringify(taskPacket(plan, id), null, 2))
    else if (verb === 'impacts') console.log(JSON.stringify(id ? taskPacket(plan, id).impacts : plan.impacts, null, 2))
    else throw new Error('usage: node scripts/unified-plan.mjs check|next|packet ID|impacts [ID]')
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
// #endregion unified-plan
