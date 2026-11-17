// On-demand spec §3.12 (board finding from dissy, 2026-11-16, point 4): a session resumed after a usage limit under the
// same runtime session id takes back the claims its earlier Fabric session left, over a stand-in of the scoped store.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { handBackResumedClaims, HANDBACK_ACTOR } = await import(path.resolve(import.meta.dirname, '../src/main/resumedClaims.ts'))

const NOW = Date.parse('2026-11-16T22:00:00Z')
const MIN = 60_000
const ago = (ms) => new Date(NOW - ms).toISOString()
const RT = 'rt-9885427c'

function store(tables, fail = null) {
  const select = (table) => {
    let rows = [...(tables[table] ?? [])]
    const q = {
      eq(c, v) { rows = rows.filter((r) => r[c] === v); return q },
      in(c, vs) { rows = rows.filter((r) => vs.includes(r[c])); return q },
      order() { return q },
      limit(n) { rows = rows.slice(0, n); return q },
      then(ok, ko) { return Promise.resolve(table === fail ? { data: null, error: { message: 'refused' } } : { data: rows, error: null }).then(ok, ko) }
    }
    return q
  }
  return {
    select: (table) => select(table),
    async selectIn(table, _cols, column, values, _chunk, _signal, eq = []) {
      if (table === fail) return { rows: [], failed: 'refused' }
      return { rows: (tables[table] ?? []).filter((r) => values.includes(r[column]) && eq.every(([c, v]) => r[c] === v)), failed: null }
    }
  }
}

/** The journal row of an event, with the payload keys the reads filter on flattened beside it. */
const ev = (type, payload) => ({ type, payload, ...Object.fromEntries(Object.entries(payload).map(([k, v]) => [`payload->>${k}`, v])) })

function world(over = {}) {
  const tables = {
    journal: [
      ev('session.enrolled@1', { session_id: 's-old', runtime_session_id: RT, binding_id: 'b-claude' }),
      ev('session.ended@1', { session_id: 's-old', runtime_session_id: RT, reason: 'agent-left' }),
      ev('session.enrolled@1', { session_id: 's-new', runtime_session_id: RT, binding_id: 'b-claude' }),
      ev('work.claimed@1', { owner: 's-old', claim_id: 'c-old', work: 't-1', workflow_id: 'wf_0123456789abcdef' })
    ],
    work_claims: [{ id: 'c-old', work_id: 't-1', owner_session: 's-old', project_id: 'p-dissy', claimed_at: ago(6 * 60 * MIN), released_at: ago(5 * 60 * MIN), released_how: 'session-ended', touches: ['src/a.ts'] }],
    project_tasks: [{ id: 't-1', status: 'backlog', moved_at: ago(5 * 60 * MIN), started_at: null, moved_by_kind: 'system' }],
    ...over.tables
  }
  const appended = []
  // The projection, as far as these events go: a claim stands unless another session holds the task now.
  const append = async (e) => {
    appended.push(e)
    if (e.type === 'work.claimed@1') {
      const heldByOther = tables.work_claims.some((c) => c.work_id === e.payload.work && c.released_at === null && c.owner_session !== e.payload.owner)
      if (!heldByOther && !over.refuseClaims) tables.work_claims.push({ id: e.payload.claim_id, work_id: e.payload.work, owner_session: e.payload.owner, project_id: e.projectId, claimed_at: new Date(NOW).toISOString(), released_at: null, released_how: null, touches: e.payload.write_scopes })
    }
    if (e.type === 'task.moved@1') tables.project_tasks.find((t) => t.id === e.payload.task_id).status = e.payload.to
  }
  const args = { projectId: 'p-dissy', sessionId: 's-new', runtimeSessionId: RT, bindingId: 'b-claude', agent: 'claude-code', now: NOW, runHolds: async () => over.runHolds ?? [], ...over.args }
  return { tables, appended, run: () => handBackResumedClaims(store(tables, over.fail), append, args) }
}

test('§3.12: the resumed session takes back the claim its earlier session left when it ended, with its workflow, and the task runs again', async () => {
  const w = world()
  const r = await w.run()
  assert.equal(r.handedBack.length, 1)
  assert.deepEqual({ taskId: r.handedBack[0].taskId, from: r.handedBack[0].from, moved: r.handedBack[0].taskMovedTo }, { taskId: 't-1', from: 'c-old', moved: 'running' })
  const claimed = w.appended.find((e) => e.type === 'work.claimed@1')
  assert.equal(claimed.payload.owner, 's-new')
  assert.equal(claimed.payload.resumed_from, 'c-old')
  assert.equal(claimed.payload.workflow_id, 'wf_0123456789abcdef', 'the task stays linked to its Observatory workflow')
  assert.deepEqual(claimed.payload.write_scopes, ['src/a.ts'])
  assert.deepEqual(claimed.actor, { kind: 'system', id: HANDBACK_ACTOR })
  assert.equal(w.tables.work_claims.find((c) => c.id === claimed.payload.claim_id).owner_session, 's-new')
  assert.equal(w.tables.project_tasks[0].status, 'running')
})

test('§3.12: nothing is given back to another binding, another runtime session or a task someone took since', async () => {
  assert.equal((await world({ args: { bindingId: 'b-codex' } }).run()).handedBack.length, 0, 'another agent under the same runtime id')
  assert.equal((await world({ args: { runtimeSessionId: 'rt-other' } }).run()).handedBack.length, 0)
  const taken = world()
  taken.tables.work_claims.push({ id: 'c-run', work_id: 't-1', owner_session: 's-run', project_id: 'p-dissy', claimed_at: ago(60 * MIN), released_at: null, released_how: null, touches: [] })
  assert.equal((await taken.run()).handedBack.length, 0, 'the supervisor\'s run took it first: its claim is the newest')
  assert.equal(taken.appended.length, 0)
  assert.equal((await world({ runHolds: ['t-1'] }).run()).handedBack.length, 0)
})

test('§3.12: a /clear-renamed session is found by its end; a claim the projection refused is said, not counted', async () => {
  const renamed = world()
  renamed.tables.journal[0] = ev('session.enrolled@1', { session_id: 's-old', runtime_session_id: 'rt-before-clear', binding_id: 'b-claude' })
  assert.equal((await renamed.run()).handedBack.length, 1)
  const refused = await world({ refuseClaims: true }).run()
  assert.equal(refused.handedBack.length, 0)
  assert.deepEqual(refused.refused.map((x) => x.taskId), ['t-1'])
})

test('§3.12: a read that fails throws, never «nothing to give back»', async () => {
  for (const table of ['journal', 'work_claims', 'project_tasks']) await assert.rejects(world({ fail: table }).run(), table)
})
