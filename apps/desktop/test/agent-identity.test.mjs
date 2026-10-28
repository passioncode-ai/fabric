// The home's reads behind one identity and «at work» (the mockup parity, 2026-10-27, home gaps D3 to D7): the earlier
// session ids of a re-enrolled agent are found by its runtime session id, their rows joined, a failed read changes
// nothing; turns and console output judge an agent at work, a keep-alive ping does not.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { withIdentity } = await import(path.resolve(import.meta.dirname, '../src/main/agentIdentity.ts'))
const { withWork } = await import(path.resolve(import.meta.dirname, '../src/main/agentWork.ts'))

const agent = (sessionId, over = {}) => ({ sessionId, projectId: 'p1', projectName: 'p1', agent: 'claude-code', console: false, startedAt: '2026-10-27T09:00:00Z', lastSignAt: '2026-10-27T10:00:00Z', stale: false, doing: null, task: null, ...over })
const view = (live) => ({ live, inWork: [], review: [], done: [], projects: [{ projectId: 'p1', now: null, live: live.length, inWork: 0, review: 0, lastActivityAt: null }], readAt: '2026-10-27T10:00:00Z' })

function fakeStore(tables, fail = null) {
  const calls = []
  return {
    calls,
    async selectIn(table, columns, key, values, chunk, signal, eq = [], order) {
      calls.push({ table, key, values, eq, order })
      if (fail === table) return { rows: [], failed: 'database away' }
      const rows = (tables[table] ?? []).filter((r) => {
        const v = key.startsWith('payload->>') ? r.payload?.[key.slice(10)] : r[key]
        return values.includes(v) && eq.every(([c, x]) => r[c] === x)
      })
      return { rows, failed: null }
    }
  }
}

const tables = {
  journal: [
    { type: 'session.enrolled@1', payload: { session_id: 'old', runtime_session_id: 'rt-1' } },
    { type: 'session.enrolled@1', payload: { session_id: 'new', runtime_session_id: 'rt-1' } },
    { type: 'session.enrolled@1', payload: { session_id: 'stranger', runtime_session_id: 'rt-9' } }
  ],
  agent_stages: [{ session_id: 'old', project_id: 'p1', task_id: null, stage: 'Reading the journal', step: 1, of_steps: 3, note: null, reported_at: '2026-10-27T08:00:00Z' }],
  session_heartbeats: [],
  work_claims: [{ work_id: 't1', project_id: 'p1', owner_session: 'old', claimed_at: '2026-10-27T07:00:00Z', released_at: '2026-10-27T08:30:00Z', released_how: 'session-ended' }],
  project_tasks: [{ id: 't1', project_id: 'p1', title: 'The rhythm', brief_what: 'Read per day', status: 'running' }]
}
const held = [{ sessionId: 'new', projectId: 'p1', agent: 'claude-code', cameIn: 'enrolled', startedAt: 0, lastSignAt: 0, runtimeSessionId: 'rt-1' }]

test('an agent that re-enrolled keeps its stage report and running task from its earlier session id', async () => {
  const store = fakeStore(tables)
  const v = await withIdentity(view([agent('new')]), store, held, Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(v.live[0].doing.text, 'Reading the journal')
  assert.equal(v.live[0].task.id, 't1')
  assert.equal(v.live[0].task.title, 'The rhythm')
  assert.equal(v.live[0].task.fromEarlierSession, true)
  const enrol = store.calls[0]
  assert.equal(enrol.key, 'payload->>runtime_session_id')
  assert.deepEqual(enrol.eq, [['type', 'session.enrolled@1']])
  assert.ok(enrol.order && enrol.order.limit > 0, 'the enrolments read is bounded')
  assert.ok(!store.calls.some((c) => c.values.includes('stranger')), 'another runtime session is not joined')
})

test('a read that fails leaves the reading as it was, never a guessed task', async () => {
  const before = view([agent('new')])
  for (const t of ['journal', 'work_claims', 'agent_stages']) {
    const v = await withIdentity(before, fakeStore(tables, t), held)
    // ER-7 (the 0.3.15 review, iteration 2): the agents stay as they were, and the view says the join was not read.
    assert.deepEqual(v, { ...before, identityUnread: true }, `${t} failing changes nothing but the flag`)
    assert.equal(v.live, before.live)
  }
})

test('an agent with no runtime session id is looked up by its own enrolment only, and joins nothing without a folder key', async () => {
  const store = fakeStore(tables)
  const before = view([agent('new')])
  assert.equal(await withIdentity(before, store, [{ ...held[0], runtimeSessionId: null }]), before)
  assert.deepEqual(store.calls.map((c) => c.key), ['payload->>session_id'], 'its own enrolment, which names no folder key here')
})

// CO-473 (0.3.15 review, iteration 1, DA-6): Codex and Kimi enrol with no runtime session id; one agent is the same binding
// in the same folder, so its earlier enrolment's stage and running task come with it; a folder two live agents share is
// left alone, and an earlier enrolment that named a runtime id is another agent's.
test('CO-473: an agent with no runtime session id is joined by its binding and folder, never across two live agents', async () => {
  const codex = (session_id, over = {}) => ({ type: 'session.enrolled@1', payload: { session_id, runner: 'codex', binding_id: 'b-codex', cwd_sha256: 'f1', ...over } })
  const folderTables = {
    ...tables,
    journal: [codex('cx-new'), codex('cx-old'), codex('cx-claude', { runtime_session_id: 'rt-x' }), codex('cx-elsewhere', { cwd_sha256: 'f2' })],
    agent_stages: [{ session_id: 'cx-old', project_id: 'p1', task_id: null, stage: 'Fixing the sweep', step: 1, of_steps: 2, note: null, reported_at: '2026-10-27T08:00:00Z' }],
    work_claims: [{ work_id: 't1', project_id: 'p1', owner_session: 'cx-old', claimed_at: '2026-10-27T07:00:00Z', released_at: null, released_how: null }]
  }
  const bareHeld = [{ sessionId: 'cx-new', projectId: 'p1', agent: 'codex', cameIn: 'enrolled', startedAt: 0, lastSignAt: 0, runtimeSessionId: null }]
  const store = fakeStore(folderTables)
  const v = await withIdentity(view([agent('cx-new', { agent: 'codex' })]), store, bareHeld, Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(v.live[0].doing.text, 'Fixing the sweep')
  assert.equal(v.live[0].task.id, 't1')
  assert.deepEqual(v.live[0].aliases, ['cx-old'], 'only the same folder\'s enrolments with no runtime id')
  const byBinding = store.calls.find((c) => c.key === 'payload->>binding_id')
  assert.ok(byBinding.order && byBinding.order.limit > 0, 'the binding\'s enrolments read is bounded')
  // Two live agents of one binding in one folder: neither is joined.
  const two = await withIdentity(view([agent('cx-new', { agent: 'codex' }), agent('cx-old', { agent: 'codex' })]), fakeStore(folderTables),
    [...bareHeld, { ...bareHeld[0], sessionId: 'cx-old' }], Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(two.live[0].aliases, undefined)
  assert.equal(two.live[0].task, null)
})

test('withWork: a turn or console output makes an agent at work; the keep-alive ping alone does not', async () => {
  const now = Date.parse('2026-10-27T10:00:00Z')
  const turns = [{ occurred_at: '2026-10-27T09:58:00Z', payload: { session_id: 'turning' } }]
  const store = {
    select: () => {
      const chain = { eq: () => chain, gte: () => chain, order: () => chain, limit: () => Promise.resolve({ data: turns, error: null }) }
      return chain
    }
  }
  const consoleHeld = [{ sessionId: 'printing', console: true, outputAt: Date.parse('2026-10-27T09:59:00Z') }]
  const v = await withWork(view([agent('pinging'), agent('turning'), agent('printing', { console: true })]), store, consoleHeld, now)
  const at = Object.fromEntries(v.live.map((a) => [a.sessionId, a.atWork]))
  assert.deepEqual(at, { pinging: false, turning: true, printing: true })
  assert.deepEqual(v.atWork, { agents: 2, connectedIdle: 1, noTask: 2, noTaskSessions: ['printing', 'turning'] })
})

test('withWork: a turns read that fails judges by the other signals, never all at work', async () => {
  const store = { select: () => { const chain = { eq: () => chain, gte: () => chain, order: () => chain, limit: () => Promise.resolve({ data: null, error: { message: 'away' } }) }; return chain } }
  const v = await withWork(view([agent('a')]), store, [], Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(v.live[0].atWork, false)
})

test('ER-10 (0.3.15 review, iteration 2): a full turns read, or a full enrolment read, is said as partial on the view', async () => {
  const turns = Array.from({ length: 500 }, (_, i) => ({ occurred_at: '2026-10-27T09:59:00Z', payload: { session_id: `other-${i}` } }))
  const store = { select: () => { const chain = { eq: () => chain, gte: () => chain, order: () => chain, limit: () => Promise.resolve({ data: turns, error: null }) }; return chain } }
  const v = await withWork(view([agent('a')]), store, [], Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(v.atWork.turnsUnread, true)
  const many = { ...tables, journal: Array.from({ length: 1000 }, (_, i) => ({ type: 'session.enrolled@1', payload: { session_id: i ? `old-${i}` : 'new', runtime_session_id: 'rt-1' } })) }
  const w = await withIdentity(view([agent('new')]), fakeStore(many), held, Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(w.identityUnread, true)
})

test('CO-477 (0.3.15 review, ER-12, ER-13): earlier stage reports are read newest first and bounded; a full claims read is said as partial', async () => {
  const store = fakeStore(tables)
  const v = await withIdentity(view([agent('new')]), store, held, Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(v.identityUnread, undefined)
  assert.deepEqual(store.calls.find((c) => c.table === 'agent_stages').order, { column: 'reported_at', ascending: false, limit: 1000 })
  const claims = Array.from({ length: 1000 }, (_, i) => ({ work_id: 't1', project_id: 'p1', owner_session: 'old', claimed_at: `2026-10-26T${String(i % 24).padStart(2, '0')}:00:00Z`, released_at: null, released_how: null }))
  const w = await withIdentity(view([agent('new')]), fakeStore({ ...tables, work_claims: claims }), held, Date.parse('2026-10-27T10:00:00Z'))
  assert.equal(w.identityUnread, true)
})
