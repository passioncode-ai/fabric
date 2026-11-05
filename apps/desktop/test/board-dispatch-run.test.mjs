// CO-409 wave 1: the dispatcher wired. Spec: docs/evidence/specs/2026-11-04-on-demand-sessions.md §3. No board, no
// Observatory, no Switchboard: every call is a stand-in with the shape the real one answers.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createBoardDispatch } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))

const T0 = Date.parse('2026-11-05T10:00:00Z')
const MIN = 60_000
const request = (over = {}) => ({ id: '11111111-1111-4111-8111-111111111111', thread: '22222222-2222-4222-8222-222222222222', state: 'queued',
  target: 'p-target', capability: 'updates.auto-default', submittedAt: new Date(T0 - 5 * MIN).toISOString(), deadline: new Date(T0 + 7 * 24 * 60 * MIN).toISOString(), ...over })

function world(over = {}) {
  let now = T0
  const w = { requests: [request()], responder: false, session: false, on: true, folder: '/work/target', provider: 'claude',
    calls: [], launches: [], runs: new Map(), states: new Map(), saved: [], logs: [], refuse: null, ...over }
  let n = 0
  w.deps = {
    now: () => now,
    switchOn: () => w.on,
    readRequests: async () => w.requests,
    responderLive: async () => w.responder,
    sessionLive: () => w.session,
    folderOf: async () => w.folder,
    defaultProvider: async () => w.provider,
    observatory: async (name, args) => {
      w.calls.push([name, args])
      if (name === 'observatory_resolve') return { canonical: 'project:target' }
      if (name === 'observatory_checkpoint_write') return args.workflowId ? { workflowId: args.workflowId, revision: 2 } : { workflowId: 'wf_0123456789abcdef', leaseId: 'lease-1' }
      if (name === 'observatory_handoff_create') return { handoffId: `handoff:${String(++n).padStart(16, '0')}` }
      if (name === 'observatory_handoff_accept') return { leaseId: 'lease-2' }
      return {}
    },
    launch: async (args) => { w.launches.push(args); return w.refuse ? { refused: w.refuse } : { launchId: `L${w.launches.length}` } },
    runState: async (id) => w.runs.get(id) ?? 'running',
    requestState: async (id) => w.states.get(id) ?? 'queued',
    load: () => [],
    save: (records) => { w.saved.push(JSON.parse(JSON.stringify(records))) },
    log: (op, outcome, detail) => w.logs.push({ op, outcome, detail })
  }
  w.tick = (ms) => { now += ms }
  return w
}

test('a queued request with nobody on it opens a workflow, offers it to the default agent and starts the run', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.deepEqual(w.calls.map(([n]) => n), ['observatory_resolve', 'observatory_checkpoint_write', 'observatory_handoff_create'])
  const open = w.calls[1][1]
  assert.equal(open.owner, 'service:fabric')
  assert.equal(open.projectId, 'project:target')
  assert.ok(open.body.artifacts.some((a) => a.ref === `board-request:${request().id}`))
  assert.ok(open.body.artifacts.some((a) => a.ref.startsWith('run-ends-at:')))
  assert.deepEqual(w.calls[2][1].to, { provider: 'claude' })
  assert.equal(w.calls[2][1].reason, 'plan_route')
  assert.equal(w.calls[2][1].leaseId, 'lease-1')
  assert.equal(w.launches.length, 1)
  assert.equal(w.launches[0].dir, '/work/target')
  assert.equal(w.launches[0].workflow, 'wf_0123456789abcdef')
  assert.equal(w.launches[0].timeoutMinutes, 60)
  assert.equal(d.records()[0].state, 'running')
  // A second pass while it runs starts nothing more.
  await d.onPass()
  assert.equal(w.launches.length, 1)
})

test('nothing starts with the switch off, with a live responder, or with a live session inside the grace', async () => {
  for (const over of [{ on: false }, { responder: true }, { session: true, requests: [request({ submittedAt: new Date(T0 - MIN).toISOString() })] }]) {
    const w = world(over)
    await createBoardDispatch(w.deps).onPass()
    assert.equal(w.launches.length, 0, JSON.stringify(over))
  }
})

test('a run that ends with the request settled is finished; one that ends without is counted, and the next run takes the workflow back', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended')
  w.states.set(request().id, 'queued')
  w.tick(3 * MIN)
  await d.onPass()
  const first = d.records()[0]
  assert.equal(first.outcome, 'exited-without-answer')
  assert.equal(first.emptyRuns, 1)
  // The second run: back to Fabric (restart, no lease), accepted, run-ends-at under the new lease, offered on.
  const names = w.calls.map(([n]) => n)
  assert.deepEqual(names.slice(3), ['observatory_handoff_create', 'observatory_handoff_accept', 'observatory_checkpoint_write', 'observatory_handoff_create'])
  assert.equal(w.calls[3][1].reason, 'restart')
  assert.equal(w.calls[3][1].leaseId, undefined)
  assert.equal(w.calls[5][1].leaseId, 'lease-2')
  assert.equal(w.calls[6][1].leaseId, 'lease-2')
  assert.equal(w.launches.length, 2)
  // After the second empty run no third starts (§3.6, option (b)).
  w.runs.set('L2', 'ended')
  w.tick(3 * MIN)
  await d.onPass()
  assert.equal(d.records()[1].emptyRuns, 2)
  assert.equal(w.launches.length, 2)
  // A settled request: finished.
  const w2 = world()
  const d2 = createBoardDispatch(w2.deps)
  await d2.onPass()
  w2.runs.set('L1', 'ended')
  w2.states.set(request().id, 'completed')
  w2.requests = []
  await d2.onPass()
  assert.equal(d2.records()[0].outcome, 'finished')
})

test('a Switchboard refusal starts nothing and is named; a failure to open the workflow is logged and starts nothing', async () => {
  const w = world({ refuse: 'no_agent' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.records().length, 0)
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.decided' && l.detail.check === 'deferred-no-agent'))
  const broken = world()
  broken.deps.observatory = async () => { throw new Error('Project Observatory is not installed on this computer') }
  await createBoardDispatch(broken.deps).onPass()
  assert.equal(broken.launches.length, 0)
  assert.ok(broken.logs.some((l) => l.op === 'board.dispatch.started' && l.outcome === 'failed'))
})

test('a run is cut to the deadline when it is nearer than the hour, and nothing starts within five minutes of it', async () => {
  const w = world({ requests: [request({ deadline: new Date(T0 + 20 * MIN).toISOString() })] })
  await createBoardDispatch(w.deps).onPass()
  assert.equal(w.launches[0].timeoutMinutes, 20)
  const late = world({ requests: [request({ deadline: new Date(T0 + 4 * MIN).toISOString() })] })
  await createBoardDispatch(late.deps).onPass()
  assert.equal(late.launches.length, 0)
})

test('what was started survives a restart: a running record is not started again', async () => {
  const w = world()
  w.deps.load = () => [{ requestId: request().id, projectId: 'p-target', dispatchId: 'd', workflowId: 'wf_0123456789abcdef', handoffId: 'handoff:1', launchId: 'L9', startedAt: T0 - MIN, endsAt: new Date(T0 + 59 * MIN).toISOString(), state: 'running', emptyRuns: 0 }]
  await createBoardDispatch(w.deps).onPass()
  assert.equal(w.launches.length, 0)
})

const { readOpenRequests } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))

test('the board read: each request with its thread, deadline and attempt fact; a request with no deadline is left out', async () => {
  const msg = (id, state, deadline) => ({ id, thread: 't1', kind: 'request', sender: { project: 'p-asker', principal: null }, at: new Date(T0).toISOString(), digest: 'd',
    request: { id, target: 'p-target', capability: 'c.x', state, ...(deadline ? { deadline } : {}) } })
  const comms = {
    threadPage: async () => ({ ok: true, threads: [{ id: 't1' }], more: false, before: null }),
    list: async () => ({ ok: true, messages: [msg('r1', 'queued', '2026-11-12T00:00:00Z'), msg('r2', 'accepted', '2026-11-12T00:00:00Z'), msg('r3', 'queued', null),
      { id: 'm4', thread: 't1', kind: 'reply', sender: { project: 'p-target', principal: null }, at: 'x', digest: 'd', replyTo: 'r1' }], lastSeq: 4, more: false }),
    facts: async (_e, ids) => ({ ok: true, messages: {}, requests: Object.fromEntries(ids.map((id) => [id, { attemptLive: id === 'r2', outcomes: [] }])) })
  }
  const r = await readOpenRequests(comms, 'e1', T0)
  assert.deepEqual(r.requests.map((x) => [x.id, x.state, x.attemptLive]), [['r1', 'queued', false], ['r2', 'accepted', true]])
  assert.equal(r.states.get('r3'), 'queued')
})

test('the board read throws when a door does not answer: an unread board is never "nothing waits"', async () => {
  const comms = { threadPage: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }), list: async () => { throw new Error('unused') }, facts: async () => { throw new Error('unused') } }
  await assert.rejects(readOpenRequests(comms, 'e1', T0), /threads could not be read/)
})

test('a request whose attempt is alive is not taken over even when the slot looks empty', async () => {
  const w = world({ requests: [request({ state: 'accepted', attemptLive: true })], responder: false })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 0)
})
