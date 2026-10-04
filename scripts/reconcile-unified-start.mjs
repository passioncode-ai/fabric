// #region unified-start-review — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { readFileSync, lstatSync, realpathSync, openSync, writeFileSync, closeSync, renameSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readPlan, reportDirectory, validatePlan } from './unified-plan.mjs'
import { publicInputProblems } from './unified-canonical-sources.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const code = ['scripts/reconcile-unified-start.mjs', 'scripts/unified-plan.mjs', 'scripts/unified-canonical-sources.mjs']
const states = ['done', 'candidate', 'design-gated', 'owned-elsewhere', 'operator-gated']
function sourceBytes(root, path) {
  if (typeof path !== 'string' || path.length > 700 || /[\\\x00-\x1f\x7f?#%:]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('unsafe review input path')
  let cursor = realpathSync(root)
  for (const part of path.split('/')) {
    cursor = resolve(cursor, part)
    if (lstatSync(cursor).isSymbolicLink()) throw new Error('linked review input refused')
  }
  const stat = lstatSync(cursor)
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('nonregular or oversized review input')
  return readFileSync(cursor)
}
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new Error(`invalid ${label} fields`)
}
export function reviewedStartPlan(root, plan, reviewPath, deny, validationOptions = {}) {
  const revision = plan.baseline
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('review requires full immutable baseline')
  const git = (...args) => execFileSync('git', args, {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024})
  if (git('cat-file', '-t', revision).toString().trim() !== 'commit') throw new Error('unknown review baseline commit')
  // A reviewed Start overlay differs from raw compiler output by design, so source reconstruction
  // (expectedPlanReader) is off here unless a caller asks for it; pins, receipts and scope still guard it.
  validationOptions = {expectedPlanReader: null, ...validationOptions}
  const before = validatePlan(plan, root, validationOptions)
  if (before.length) throw new Error('input plan invalid: ' + before.join('\n'))
  const next = structuredClone(plan), inputs = new Map()
  const startIds = new Set(plan.lanes?.find(l => l.number === 1)?.canonical_ids ?? [])
  const pin = path => {
    const bytes = sourceBytes(root, path)
    let committed
    try { committed = git('show', `${revision}:${path}`) } catch { throw new Error('review input absent from immutable source') }
    if (digest(bytes) !== digest(committed)) throw new Error('review input is uncommitted or differs from baseline')
    inputs.set(path, bytes)
    const entry = {path, sha256: digest(bytes), commit: revision}
    const index = next.sources.findIndex(s => s.path === path)
    if (index < 0) next.sources.push(entry)
    else if (JSON.stringify(next.sources[index]) !== JSON.stringify(entry)) {
      // Pin equality is structural, independent of JSON field ordering.
      const old = next.sources[index]
      if (old.sha256 !== entry.sha256 || old.commit !== entry.commit) throw new Error('existing review source pin differs')
    }
    return bytes
  }
  const parseInput = path => {
    const bytes = pin(path), privacy = publicInputProblems([{path, bytes}], deny)
    if (privacy.length) throw new Error(privacy.join('\n'))
    try { return JSON.parse(bytes) } catch { throw new Error('invalid review input JSON') }
  }
  const reviewed = parseInput(reviewPath)
  fields(reviewed, ['schema', 'review', 'new_tasks', 'impacts'], 'review')
  if (reviewed.schema !== 1 || !Array.isArray(reviewed.review) || (reviewed.new_tasks !== undefined && !Array.isArray(reviewed.new_tasks)) || (reviewed.impacts !== undefined && !Array.isArray(reviewed.impacts))) throw new Error('invalid Start review schema')
  for (const path of code) pin(path)
  const reviewedIds = new Set()
  const evidence = (task, proof) => {
    fields(proof, ['path', 'scope'], 'evidence')
    if (proof.scope !== task.id) throw new Error('evidence scope must equal the exact bounded task id')
    const bytes = pin(proof.path)
    task.evidence = {path: proof.path, scope: proof.scope, sha256: digest(bytes), source_revision: revision}
    if (!task.context.sources.includes(proof.path)) task.context.sources.push(proof.path)
  }
  const sources = (task, completedImplementation = false) => {
    if (!task.context || !Array.isArray(task.context.sources)) throw new Error('review packet requires full task context')
    if (completedImplementation) {
      if (!Array.isArray(task.context.scope) || !task.context.scope.length) throw new Error('completed bounded task requires exact implemented file scope')
      for (const path of task.context.scope) {
        pin(path)
        if (!task.context.sources.includes(path)) task.context.sources.push(path)
      }
    }
    for (const path of task.context.sources) pin(typeof path === 'string' ? path.split('#')[0] : path)
    if (!task.context.sources.includes(reviewPath)) task.context.sources.push(reviewPath)
    task.context.start_review = {path: reviewPath, source_revision: revision, scope: task.id}
  }
  for (const entry of reviewed.review) {
    fields(entry, ['id', 'dispatch', 'evidence', 'packet'], 'disposition')
    const parent = typeof entry.id === 'string' && entry.id.endsWith('.prepare') ? entry.id.slice(0, -'.prepare'.length) : undefined
    if (!startIds.has(parent) || reviewedIds.has(entry.id)) throw new Error('only distinct existing Start preparation leaves may be reviewed')
    reviewedIds.add(entry.id)
    const task = next.tasks.find(t => t.id === entry.id)
    if (!task || task.lane !== 1 || !states.includes(entry.dispatch)) throw new Error('unknown Start preparation leaf or dispatch')
    const packet = parseInput(entry.packet)
    fields(packet, ['schema', 'id', 'context'], 'packet')
    if (packet.schema !== 1 || packet.id !== task.id) throw new Error('review packet identity mismatch')
    const preserved = task.context
    task.context = structuredClone(packet.context)
    if (!task.context || !Array.isArray(task.context.sources)) throw new Error('review packet requires full task context')
    for (const key of ['research_provenance', 'research_artifact', 'full_research_packet', 'module_context']) if (preserved[key] !== undefined) task.context[key] = preserved[key]
    if (!task.context.sources.includes(entry.packet)) task.context.sources.push(entry.packet)
    task.dispatch = entry.dispatch
    delete task.evidence
    if (entry.evidence !== undefined) evidence(task, entry.evidence)
    else if (entry.dispatch === 'done') throw new Error('done preparation lacks current bounded evidence')
    sources(task)
  }
  for (const raw of reviewed.new_tasks ?? []) {
    const task = structuredClone(raw)
    const parent = typeof task.id === 'string' ? task.id.match(/^(CO-\d+)\.[1-9]\d*$/)?.[1] : undefined
    if (!parent || !startIds.has(parent) || task.lane !== 1 || next.tasks.some(t => t.id === task.id) || !task.canonical_ids?.includes(parent) || !next.tasks.some(t => t.lane === 1 && t.canonical_ids.includes(parent))) throw new Error('new task must be a distinct bounded Start child of an existing owner')
    if (!states.includes(task.dispatch) || task.dispatch === 'candidate') throw new Error('new bounded implementation cannot be activated by Start overlay')
    if (task.dispatch === 'done') {
      const proof = task.evidence
      delete task.evidence
      evidence(task, proof)
    } else if (task.evidence !== undefined) evidence(task, task.evidence)
    sources(task, task.dispatch === 'done')
    next.tasks.push(task)
  }
  for (const impact of reviewed.impacts ?? []) {
    const index = (next.impacts ??= []).findIndex(i => i.id === impact.id)
    if (index < 0) next.impacts.push(impact)
    else next.impacts[index] = impact
  }
  next.sources.sort((a, b) => a.path.localeCompare(b.path, 'en'))
  next.start_review = {path: reviewPath, commit: revision, sha256: digest(inputs.get(reviewPath)), scope: 'Explicit preparation dispositions and bounded Start child receipts only; no parent/native/release acceptance', adapter_projection: 'audit-graph.json and cold-packets are predecessor snapshots; current complete task context is scripts/unified-plan.mjs --report DIR packet ID'}
  const output = JSON.stringify(next, null, 2) + '\n'
  const privacy = publicInputProblems([{path: 'reviewed-plan.json', bytes: Buffer.from(output)}, ...[...inputs].map(([path, bytes]) => ({path, bytes}))], deny)
  if (privacy.length) throw new Error(privacy.join('\n'))
  const problems = validatePlan(next, root, validationOptions)
  if (problems.length) throw new Error('reviewed plan invalid: ' + problems.join('\n'))
  return {plan: next, output}
}
export function reconcileStart({root, report, review, privacyFile}, validationOptions = {}) {
  if (!privacyFile) throw new Error('Start overlay requires --privacy-deny-file local JSON')
  let deny
  try { deny = JSON.parse(readFileSync(privacyFile, 'utf8')) } catch { throw new Error('invalid local privacy deny JSON') }
  const directory = reportDirectory(root, report), target = resolve(directory, 'plan.json')
  const plan = readPlan(root, report), original = readFileSync(target)
  const {output} = reviewedStartPlan(root, plan, review, deny, validationOptions)
  const temporary = resolve(directory, `.start-review-${randomUUID()}.tmp`)
  const lock = resolve(directory, '.start-review.lock')
  let lockFd, created = false
  try {
    lockFd = openSync(lock, 'wx', 0o600)
    if (digest(readFileSync(target)) !== digest(original)) throw new Error('plan changed during Start review; reconcile before retry')
    writeFileSync(temporary, output, {flag: 'wx', mode: 0o600}); created = true
    renameSync(temporary, target); created = false
  } finally {
    if (created) unlinkSync(temporary)
    if (lockFd !== undefined) { closeSync(lockFd); unlinkSync(lock) }
  }
  return JSON.parse(output)
}
export function parseStartArgs(args) {
  const values = {}
  for (let i = 0; i < args.length; i++) {
    if (!['--report', '--review', '--privacy-deny-file'].includes(args[i]) || args[i] in values || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('usage: reconcile-unified-start.mjs --report DIR --review PATH --privacy-deny-file LOCAL')
    values[args[i]] = args[++i]
  }
  if (Object.keys(values).length !== 3) throw new Error('report, review and local privacy deny file are required')
  return {report: values['--report'], review: values['--review'], privacyFile: values['--privacy-deny-file']}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const plan = reconcileStart({root, ...parseStartArgs(process.argv.slice(2))})
    console.log(`PASS: current Start review applied at ${plan.baseline}; parent and native/release status unchanged`)
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
// #endregion unified-start-review
