// #region work-doors-test — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
// ADR-0195 W2c.2b, the second group: the window's twelve work doors as functions (`main/workDoors.ts`), and the same
// functions served on the board's operator door. The stores are stand-ins that record what they were asked; the door
// is a real loopback listener under a temporary root, called through the published files as the window will call it.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { callOperatorDoor, startOperatorDoor } from '../src/main/operatorDoor.ts'
import { WORK_DOOR_NAMES, createWorkDoors, workDoorTable } from '../src/main/workDoors.ts'
import { overlapPair } from '../src/shared/abandonedSweep.ts'

const OPERATOR = { kind: 'person', id: 'op-1' }
const P1 = '11111111-1111-4111-8111-111111111111'
const C1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const C2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const claim = (id, at, over = {}) => ({ id, work_id: `task-${id.slice(0, 1)}`, project_id: P1, owner_session: `sess-${id.slice(0, 1)}`, claimed_at: at, released_at: null, ...over })

/** A store that answers each table from fixed rows and records every read. */
function fakeStore(name, tables = {}, opts = {}) {
  const calls = []
  let linkReads = 0
  return {
    name,
    calls,
    select: (table, columns) => {
      const call = { store: name, table, columns, eq: [], in: [] }
      calls.push(call)
      const answer = () => (opts.fail?.[table] ? { data: null, error: { message: opts.fail[table] } } : { data: tables[table] ?? [], error: null })
      const chain = {
        is: () => chain, not: () => chain, limit: () => chain, order: () => chain, gte: () => chain, lt: () => chain, or: () => chain,
        eq: (k, v) => { call.eq.push([k, v]); return chain },
        in: (k, v) => { call.in.push([k, v]); return chain },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (ok, no) => Promise.resolve(answer()).then(ok, no)
      }
      return chain
    },
    // `readWork` reads the links of the claims first (two reads); the launch check's own reads are the next two.
    selectIn: async (table) => (table === 'task_links' && opts.linksFailed && ++linkReads > 2 ? { rows: [], failed: opts.linksFailed } : { rows: [], failed: null })
  }
}

function standIn(over = {}) {
  const estate = over.estate ?? fakeStore('estate', over.tables ?? {}, over.storeOpts)
  const project = fakeStore('project', {})
  const asked = { projectStore: [], leases: [], rpc: [], notes: [], perform: [], decided: [], said: [], held: [] }
  const sweep = {
    decideOverlap: (pair, choice) => asked.decided.push([pair, choice]),
    say: (sessionId, text) => { asked.said.push([sessionId, text]); return { id: 'msg-1' } },
    messages: (sessionId) => [{ id: 'msg-1', text: `to ${sessionId}`, at: 5, readAt: null }]
  }
  const deps = {
    store: () => estate,
    projectStore: (id) => { asked.projectStore.push(id); return project },
    rpc: async (fn, args) => { asked.rpc.push([fn, args]); return over.rpc ?? { data: { linked: true }, error: null } },
    journal: () => ({ append: async (e) => { asked.notes.push(e) } }),
    estateId: 'estate-1',
    operator: () => OPERATOR,
    sessionSign: () => null,
    heldSessions: (projectId) => { asked.held.push(projectId ?? null); return [] },
    leaseRefs: async (id) => { asked.leases.push(id); return null },
    consoleOpen: () => false,
    sweep: () => ('sweep' in over ? over.sweep : sweep),
    home: async () => ({ marker: 'home' }),
    executors: async () => [],
    rhythm: async (now) => ({ marker: 'rhythm', now }),
    acts: () => ({ perform: async (kind, args) => { asked.perform.push([kind, args]); return over.act ?? { ok: true, seq: 3 } } }),
    now: () => 1_000
  }
  return { deps, estate, project, asked }
}

test('the table serves exactly the twelve work doors of the window, each a name the operator door accepts', () => {
  const table = workDoorTable(createWorkDoors(standIn().deps))
  assert.deepEqual([...table.keys()], [...WORK_DOOR_NAMES])
  assert.equal(table.size, 12)
})

test('a project\'s reading goes through that project\'s store, its sessions and its lease refs; the estate\'s through the estate store', async () => {
  const s = standIn()
  const doors = createWorkDoors(s.deps)
  await doors.project(P1)
  assert.deepEqual(s.asked.projectStore, [P1])
  assert.deepEqual(s.asked.leases, [P1])
  assert.deepEqual(s.asked.held, [P1])
  assert.equal(s.estate.calls.length, 0, 'a project reading never reads through the estate store')
  assert.ok(s.project.calls.length > 0)
  await doors.estate()
  assert.ok(s.estate.calls.some((c) => c.table === 'work_claims'))
  assert.equal(s.asked.projectStore.length, 1)
})

test('the board filters by a project only when it is named by an id; anything else reads every project', async () => {
  const s = standIn()
  const doors = createWorkDoors(s.deps)
  await doors.board(P1, 40)
  assert.ok(s.estate.calls.filter((c) => c.table === 'work_claims').every((c) => c.eq.some(([k, v]) => k === 'project_id' && v === P1)))
  s.estate.calls.length = 0
  await doors.board('every project; drop table', 'forty')
  assert.ok(s.estate.calls.length > 0)
  assert.ok(s.estate.calls.every((c) => !c.eq.some(([k]) => k === 'project_id')))
})

test('a launch check whose links could not be read rejects, never «nobody works here»; with no claims it names no console', async () => {
  const failing = standIn({ storeOpts: { linksFailed: 'database away' } })
  await assert.rejects(createWorkDoors(failing.deps).launchCheck({ projectId: P1, text: 'login form' }), /the task links could not be read: database away/)
  const quiet = await createWorkDoors(standIn().deps).launchCheck({ projectId: P1, taskId: null, text: 'login form' })
  assert.deepEqual(quiet.console, [])
  assert.deepEqual(quiet.overlaps, [])
})

test('an overlap decision: an unknown key or choice is refused before any read', async () => {
  const s = standIn()
  const doors = createWorkDoors(s.deps)
  assert.deepEqual(await doors.overlapDecide({ key: 'overlap-unsettled:x:y', choice: 'wait' }), { ok: false, reason: 'unknown overlap or choice' })
  assert.deepEqual(await doors.overlapDecide({ key: `overlap-unsettled:${C1}:${C2}`, choice: 'merge' }), { ok: false, reason: 'unknown overlap or choice' })
  assert.deepEqual(await doors.overlapDecide(null), { ok: false, reason: 'unknown overlap or choice' })
  assert.equal(s.estate.calls.length, 0)
})

test('an overlap decision: a claim already released, or claims that cannot be read, change nothing', async () => {
  const released = standIn({ tables: { work_claims: [claim(C1, '2026-11-21T10:00:00Z'), claim(C2, '2026-11-21T11:00:00Z', { released_at: '2026-11-21T12:00:00Z' })] } })
  assert.deepEqual(await createWorkDoors(released.deps).overlapDecide({ key: `overlap-unsettled:${C1}:${C2}`, choice: 'wait' }), { ok: false, reason: 'one of the two sessions no longer holds its task' })
  const away = standIn({ storeOpts: { fail: { work_claims: 'database away' } } })
  assert.deepEqual(await createWorkDoors(away.deps).overlapDecide({ key: `overlap-unsettled:${C1}:${C2}`, choice: 'split' }), { ok: false, reason: 'the claims could not be read: database away' })
  for (const s of [released, away]) assert.deepEqual([s.asked.rpc, s.asked.notes, s.asked.decided], [[], [], []])
})

test('«The other waits» links the later task after the first as the person, notes both tasks and tells the sweep', async () => {
  // Given in the other order: the first is the one claimed earlier, not the one named first.
  const s = standIn({ tables: { work_claims: [claim(C2, '2026-11-21T11:00:00Z'), claim(C1, '2026-11-21T10:00:00Z')] } })
  assert.deepEqual(await createWorkDoors(s.deps).overlapDecide({ key: `overlap-unsettled:${C2}:${C1}`, choice: 'wait' }), { ok: true })
  assert.deepEqual(s.asked.rpc, [['link_tasks', { p_estate_id: 'estate-1', p_task_id: 'task-b', p_rel: 'follows', p_target_id: 'task-a', p_actor: OPERATOR, p_project_id: P1 }]])
  assert.deepEqual(s.asked.notes.map((n) => [n.type, n.estateId, n.actor, n.projectId, n.payload.task_id]), [
    ['task.note.added@1', 'estate-1', OPERATOR, P1, 'task-a'], ['task.note.added@1', 'estate-1', OPERATOR, P1, 'task-b']])
  assert.match(s.asked.notes[0].payload.body_md, /^Decided: this task waits for task task-a \(session sess-a\), which goes first\. \(overlap of sessions sess-a and sess-b\)$/)
  assert.deepEqual(s.asked.decided, [[overlapPair(C1, C2), 'wait']])
})

test('a link the database refuses is the door\'s refusal: no note, nothing told; the other choices link nothing', async () => {
  const rows = { work_claims: [claim(C1, '2026-11-21T10:00:00Z'), claim(C2, '2026-11-21T11:00:00Z')] }
  const refused = standIn({ tables: rows, rpc: { data: { linked: false, reason_code: 'cycle', says: 'the link would close a cycle' }, error: null } })
  const answer = await createWorkDoors(refused.deps).overlapDecide({ key: `overlap-unsettled:${C1}:${C2}`, choice: 'wait' })
  assert.equal(answer.ok, false)
  assert.match(answer.reason, /cycle/)
  assert.deepEqual([refused.asked.notes, refused.asked.decided], [[], []])
  const split = standIn({ tables: rows })
  assert.deepEqual(await createWorkDoors(split.deps).overlapDecide({ key: `overlap-unsettled:${C1}:${C2}`, choice: 'split' }), { ok: true })
  assert.deepEqual(split.asked.rpc, [])
  assert.equal(split.asked.notes.length, 2)
  assert.match(split.asked.notes[1].payload.body_md, /^Decided: both sessions go on/)
})

test('the person\'s words reach the sweep trimmed and bounded; with no words, or no sweep yet, the door says so', async () => {
  const s = standIn()
  const doors = createWorkDoors(s.deps)
  assert.deepEqual(await doors.say({ sessionId: ' sess-1 ', text: '   ' }), { ok: false, reason: 'say what the agent should read' })
  assert.deepEqual(await doors.say({ sessionId: ' sess-1 ', text: `  ${'x'.repeat(5000)} ` }), { ok: true, id: 'msg-1' })
  assert.equal(s.asked.said[0][0], 'sess-1')
  assert.equal(s.asked.said[0][1].length, 4000)
  assert.deepEqual(await doors.messages('sess-1'), [{ id: 'msg-1', text: 'to sess-1', at: 5, readAt: null }])
  const starting = createWorkDoors(standIn({ sweep: null }).deps)
  assert.deepEqual(await starting.say({ sessionId: 'sess-1', text: 'stop' }), { ok: false, reason: 'Fabric is still starting; try again in a moment' })
  assert.deepEqual(await starting.messages('sess-1'), [])
})

test('the home and the rhythm are the serving process\'s own readings; an identity that is not one rejects', async () => {
  const doors = createWorkDoors(standIn().deps)
  assert.deepEqual(await doors.home(), { marker: 'home' })
  assert.deepEqual(await doors.rhythm(), { marker: 'rhythm', now: 1_000 })
  await assert.rejects(doors.session('not-a-session'), /Invalid session identity/)
  await assert.rejects(doors.sources({ id: P1 }), /Invalid project identity/)
})

test('a release is History\'s act; an id that is not one never reaches it, and a refusal is said by its kind', async () => {
  const s = standIn()
  const doors = createWorkDoors(s.deps)
  assert.deepEqual(await doors.release('claim; drop'), { released: false, reason: 'not-found' })
  assert.deepEqual(await doors.release({ id: C1 }), { released: false, reason: 'not-found' })
  assert.deepEqual(s.asked.perform, [])
  assert.deepEqual(await doors.release(C1), { released: true, claimId: C1 })
  assert.deepEqual(s.asked.perform, [['claim.release', { claim_id: C1 }]])
  for (const [reason, said] of [['claim_gone', 'not-found'], ['already_released', 'already-released'], ['db away', 'unconfirmed']])
    assert.deepEqual(await createWorkDoors(standIn({ act: { ok: false, reason } }).deps).release(C1), { released: false, reason: said })
})

test('the same doors through the board\'s operator door: positional arguments in, the door\'s answer out', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-work-doors-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const s = standIn({ tables: { work_claims: [claim(C1, '2026-11-21T10:00:00Z'), claim(C2, '2026-11-21T11:00:00Z')] } })
  const door = await startOperatorDoor({ root: dir, peerAccount: async () => 'own', doors: workDoorTable(createWorkDoors(s.deps)) })
  t.after(() => door.stop())
  assert.deepEqual(await callOperatorDoor(dir, 'work.home', []), { ok: true, value: { marker: 'home' } })
  assert.deepEqual(await callOperatorDoor(dir, 'work.say', [{ sessionId: 'sess-1', text: 'stop and report' }]), { ok: true, value: { ok: true, id: 'msg-1' } })
  assert.deepEqual(await callOperatorDoor(dir, 'work.messages', ['sess-1']), { ok: true, value: [{ id: 'msg-1', text: 'to sess-1', at: 5, readAt: null }] })
  assert.deepEqual(await callOperatorDoor(dir, 'work.overlapDecide', [{ key: `overlap-unsettled:${C1}:${C2}`, choice: 'handover' }]), { ok: true, value: { ok: true } })
  assert.deepEqual(await callOperatorDoor(dir, 'work.release', [C1]), { ok: true, value: { released: true, claimId: C1 } })
  assert.deepEqual(s.asked.said, [['sess-1', 'stop and report']])
  assert.deepEqual(s.asked.decided, [[overlapPair(C1, C2), 'handover']])
  assert.deepEqual(s.asked.perform, [['claim.release', { claim_id: C1 }]])
  // Arguments that are not a list never reach a door: no act, and the refusal is the door's failure answer.
  const refused = await callOperatorDoor(dir, 'work.release', { claimId: C2 })
  assert.equal(refused.ok, false)
  assert.equal(s.asked.perform.length, 1)
})
// #endregion work-doors-test
