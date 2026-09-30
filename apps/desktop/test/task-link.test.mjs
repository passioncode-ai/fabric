// Linking two tasks, probed by ATTEMPTING what it must refuse (R-003 · FA-04).
//
// MEASURED BEFORE THIS EXISTED, at agentSurface.ts in `fabric_task_link`:
//
//   const { data: closes } = await db.rpc('would_close_cycle', {...})
//   if (closes === true) return json({ linked: false, ... })
//   await this.appendRedacted({ type: 'task.linked@1', ... })
//
// Two separate failures live in those three lines.
//
//   1. FAIL-OPEN. `error` is destructured away. An RPC that fails returns
//      `data: null`, `null === true` is false, and the append happens anyway.
//      The guard is strongest exactly when the database is healthy and absent
//      the moment it is not.
//   2. CHECK-THEN-APPEND. The answer is computed in one round trip and used in
//      another. Two clients linking A->B and B->A both see "no cycle", both
//      append, and the graph the board reads has a loop in it — a board where
//      A waits for B waits for A is one nobody can act on, which is the exact
//      thing the check exists to prevent.
//
// AND A THIRD, from the vocabulary rather than the concurrency: `spawned` is
// PROVENANCE — it records that this task came out of that one, a fact about the
// past — while `blocks` and `follows` are DEPENDENCY, claims about what may run
// next. `would_close_cycle` walked all three together, so a parent that blocks
// its child made "this child was spawned by that parent" unrecordable: a true
// statement about history refused for the topology of a different graph.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
// A FRESH estate per run, never a fixed id. With fixed ids this probe deleted
// its journal at the end and left the PROJECTIONS behind, so the next run
// compared a live graph carrying the previous run's rows against a replay that
// rebuilt only the current ones. Measured 2026-09-10: that made the replay
// assertion fail once and pass once for reasons belonging entirely to the
// harness — a green that depended on what an earlier run happened to leave.
const ESTATE = randomUUID()
const OTHER  = randomUUID()
const ACTOR = { kind: 'agent', id: 'link-probe' }

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const project = async (estate) => {
  const id = randomUUID()
  await journal.append({ estateId: estate, type: 'project.created@1',
    actor: { kind: 'system', id: 'probe' }, projectId: id,
    payload: { id, name: 'link probe' } })
  return id
}
const task = async (estate, projectId, title) => {
  const id = randomUUID()
  await journal.append({ estateId: estate, type: 'task.created@1', actor: ACTOR, projectId,
    payload: { id, title, task_type: 'development', section: 'core',
               origin: { kind: 'task', ref: 'probe' } } })
  return id
}
const events = async (estate) => {
  const { count } = await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', estate).eq('type', 'task.linked@1')
  return count ?? 0
}
const link = (estate, projectId, from, rel, to) =>
  db.rpc('link_tasks', { p_estate_id: estate, p_task_id: from, p_rel: rel,
                         p_target_id: to, p_actor: ACTOR, p_project_id: projectId })

const P = await project(ESTATE)
const A = await task(ESTATE, P, 'task A')
const B = await task(ESTATE, P, 'task B')

// ── 1 · an unavailable check REFUSES, it does not wave the write through ─────
{
  const before = await events(ESTATE)
  const bad = await db.rpc('link_tasks', { p_estate_id: ESTATE, p_task_id: A,
    p_rel: 'blocks', p_target_id: '00000000-0000-0000-0000-000000000000',
    p_actor: ACTOR, p_project_id: P })
  const refused = bad.error !== null || bad.data?.linked === false
  const after = await events(ESTATE)
  if (refused && after === before) ok('a link the command cannot verify appends NOTHING')
  else fail('a link the command could not verify still produced ' + (after - before) + ' event(s)')
}

// ── 2 · two opposite edges, actually concurrent ──────────────────────────────
{
  const before = await events(ESTATE)
  const [ab, ba] = await Promise.all([
    link(ESTATE, P, A, 'blocks', B),
    link(ESTATE, P, B, 'blocks', A)
  ])
  const linked = [ab, ba].filter((r) => r.data?.linked === true).length
  const after = await events(ESTATE)
  if (linked === 1) ok('of two opposite links raced against each other, exactly one commits')
  else fail('opposite links: ' + linked + ' committed, ' + (after - before) + ' event(s) appended')

  const { data: rows } = await db.from('task_links').select('task_id,target_id')
    .eq('estate_id', ESTATE).in('task_id', [A, B])
  const loop = rows?.some((r) => r.task_id === A && r.target_id === B) &&
               rows?.some((r) => r.task_id === B && r.target_id === A)
  if (!loop) ok('the board is left without a loop A -> B -> A')
  else fail('the board holds A -> B -> A: a queue nobody can act on')

  // THE DEEPEST ONE. Before this command the race appended TWO events and the
  // board held ONE edge, because the projector drops a cyclic edge with a
  // warning. History recorded something the projection does not contain, and
  // the only trace was a Postgres warning nobody reads. Every accepted event
  // must leave a row.
  const edges = rows?.filter((r) => [A, B].includes(r.target_id)).length ?? 0
  if (after - before === edges) ok('every task.linked event the journal accepted left a row on the board')
  else fail('the journal holds ' + (after - before) + ' link event(s) and the board holds ' + edges + ' edge(s)')
}

// ── 3 · the same link twice is one edge and one event ────────────────────────
{
  // Its OWN pair. Reusing the raced edges above would make this assertion
  // depend on which side of a race won, which is a test that reports the
  // scheduler rather than the product.
  const E1 = await task(ESTATE, P, 'idempotent from')
  const E2 = await task(ESTATE, P, 'idempotent to')
  const first = await link(ESTATE, P, E1, 'blocks', E2)
  const before = await events(ESTATE)
  const again = await link(ESTATE, P, E1, 'blocks', E2)
  const after = await events(ESTATE)
  if (first.data?.linked === true && again.data?.reason_code === 'exists' && after === before)
    ok('saying the same true thing twice records it once')
  else fail('re-linking appended ' + (after - before) + ' event(s): ' + JSON.stringify(again.data))
}

// ── 4 · another estate's task is not a target, and does not leak ─────────────
{
  const Q = await project(OTHER)
  const X = await task(OTHER, Q, 'someone else task')
  const before = await events(ESTATE)
  const r = await link(ESTATE, P, A, 'blocks', X)
  const after = await events(ESTATE)
  if (r.data?.linked === false && after === before) ok('a cross-estate edge appends nothing')
  else fail('a cross-estate edge produced ' + (after - before) + ' event(s)')
  if (r.data?.reason_code === 'not_found') ok('and it does not say whether that id exists elsewhere')
  else fail('the refusal leaks cross-estate existence: ' + JSON.stringify(r.data))
}

// ── 5 · provenance is not dependency ─────────────────────────────────────────
{
  const C = await task(ESTATE, P, 'parent')
  const D = await task(ESTATE, P, 'child')
  await link(ESTATE, P, C, 'blocks', D)
  const r = await link(ESTATE, P, D, 'spawned', C)
  const { data: kept } = await db.from('task_links').select('rel')
    .eq('estate_id', ESTATE).eq('task_id', D).eq('target_id', C).eq('rel', 'spawned')
  // BOTH halves. The command answering "linked" and the board holding the edge
  // are different claims, and the projector has its own copy of this rule: with
  // the rel hidden from it the command says yes and the row is dropped with a
  // warning, which is precisely the shape that made the journal and the board
  // disagree in the first place.
  if (r.data?.linked === true && kept?.length === 1)
    ok('a child records that it was spawned by the parent that blocks it, and the board keeps it')
  else fail('spawned-under-blocks: command said ' + JSON.stringify(r.data) + ', board holds ' + (kept?.length ?? 0) + ' row(s)')

  // The other direction, which is the one that makes the walk's filter
  // load-bearing: a parent may BLOCK the child it spawned. Walking provenance
  // as if it were dependency turns that ordinary statement into a loop.
  const F = await task(ESTATE, P, 'spawner')
  const G = await task(ESTATE, P, 'spawned child')
  await link(ESTATE, P, G, 'spawned', F)
  const blocksIt = await link(ESTATE, P, F, 'blocks', G)
  if (blocksIt.data?.linked === true) ok('a parent may block the child it spawned')
  else fail('provenance was walked as a dependency: ' + JSON.stringify(blocksIt.data))

  const self = await link(ESTATE, P, D, 'spawned', D)
  if (self.data?.linked === false) ok('and nothing is its own parent')
  else fail('a task was linked to itself')
}

// ── 6 · replay rebuilds exactly the graph the live commands allowed ──────────
{
  const shape = async () => {
    const { data } = await db.from('task_links').select('task_id,rel,target_id')
      .eq('estate_id', ESTATE).order('task_id').order('rel').order('target_id')
    return JSON.stringify(data)
  }
  const live = await shape()
  const { error } = await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
  if (error) fail('replay failed on an event the live command allowed: ' + error.message)
  else if (await shape() === live) ok('replay rebuilds the same graph and refuses nothing it allowed')
  else fail('replay differs. live: ' + live + ' | replay: ' + (await shape()))
}

for (const estate of [ESTATE, OTHER]) await db.from('journal').delete().eq('estate_id', estate)
console.log(failures ? '  FAIL ' + failures + ' failure(s)' : '\\nall green')
process.exit(failures ? 1 : 0)
`

const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', cwd: path.resolve(HERE, '../../..') })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') env.SUPABASE_URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') env.SUPABASE_SERVICE_ROLE_KEY = m[2]
  }
} catch {
  console.log('  FAIL the local stack is not running — this probe asserts nothing without it (no skip, M110).')
  process.exit(1)
}
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
