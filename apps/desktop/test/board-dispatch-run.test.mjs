// CO-409 wave 1: the dispatcher wired. Spec: docs/evidence/specs/2026-11-04-on-demand-sessions.md §3. No board, no
// Observatory, no Switchboard: every call is a stand-in with the shape the real one answers.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createBoardDispatch, REFUSAL_BACKOFF_MS, REFUSAL_BACKOFF_MAX_MS, refusalBackoffMs, START_ATTEMPTS, UNKNOWN_AFTER_END_MS, CLOSE_ATTEMPTS, noteOf } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))

const T0 = Date.parse('2026-11-05T10:00:00Z')
const MIN = 60_000
const DAY = 24 * 60 * MIN
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
    quitting: () => w.quitting === true,
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
  // ER-5: the workflow's newest checkpoint is read first; this stand-in names no time, so Observatory decides.
  assert.deepEqual(names.slice(3), ['observatory_checkpoint_latest', 'observatory_handoff_create', 'observatory_handoff_accept', 'observatory_checkpoint_write', 'observatory_handoff_create'])
  assert.equal(w.calls[4][1].reason, 'restart')
  assert.equal(w.calls[4][1].leaseId, undefined)
  assert.equal(w.calls[6][1].leaseId, 'lease-2')
  assert.equal(w.calls[7][1].leaseId, 'lease-2')
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
  assert.deepEqual(d.records().map((r) => [r.state, r.outcome, r.refused]), [['ended', 'refused', 'no_agent']])
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.decided' && l.detail.check === 'deferred-no-agent'))
  // ER-1, DA-2: no new workflow, offer or start every minute after a refusal; after the back-off it asks again on the SAME workflow.
  const opened = w.calls.filter(([n]) => n === 'observatory_checkpoint_write' && !n.workflowId).length
  w.tick(MIN)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  w.tick(REFUSAL_BACKOFF_MS)
  await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.equal(w.launches[1].workflow, w.launches[0].workflow)
  assert.equal(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length, opened)
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

test('ER-1, ER-2: a start with no answer keeps its record and is asked again with the same workflow, never a second one', async () => {
  const w = world()
  let calls = 0
  w.deps.launch = async (args) => { w.launches.push(args); calls++; return calls < 3 ? { refused: 'failed' } : { launchId: 'L-late' } }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.records()[0].state, 'starting')
  assert.ok(w.saved.length >= 1 && w.saved[0][0].state === 'starting', 'the record is saved before Switchboard answers')
  w.tick(MIN); await d.onPass()
  w.tick(MIN); await d.onPass()
  assert.equal(d.records().length, 1)
  assert.equal(d.records()[0].state, 'running')
  assert.equal(new Set(w.launches.map((l) => `${l.workflow}|${l.handoff}|${l.dispatchId}`)).size, 1)
  // A start that never answers is recorded as failed after START_ATTEMPTS.
  const w2 = world()
  w2.deps.launch = async (args) => { w2.launches.push(args); return { refused: 'failed' } }
  const d2 = createBoardDispatch(w2.deps)
  for (let i = 0; i < START_ATTEMPTS + 2; i++) { await d2.onPass(); w2.tick(MIN) }
  assert.equal(w2.launches.length, START_ATTEMPTS)
  assert.equal(d2.records()[0].outcome, 'failed-to-start')
})

test('ER-2: quitting starts nothing and asks Switchboard nothing', async () => {
  const w = world({ quitting: true })
  await createBoardDispatch(w.deps).onPass()
  assert.equal(w.launches.length, 0)
  assert.equal(w.calls.length, 0)
})

test('ER-3: a run Switchboard cannot report on frees its place after its end; with its request unsettled it counts as empty (iteration 3, ER-2)', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'unknown')
  w.tick(30 * MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'running')
  w.tick(30 * MIN + UNKNOWN_AFTER_END_MS + MIN); w.requests = []; await d.onPass()
  assert.deepEqual([d.records()[0].state, d.records()[0].outcome, d.records()[0].emptyRuns], ['ended', 'unknown', 1])
})

test('ER-6: a run is not judged empty when the request cannot be read this pass', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended')
  w.deps.requestState = async () => null
  w.tick(MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'running')
})

test('ER-7: with the switch off and nothing in flight the board is not read', async () => {
  const w = world({ on: false })
  let reads = 0
  w.deps.readRequests = async () => { reads++; return w.requests }
  await createBoardDispatch(w.deps).onPass()
  assert.equal(reads, 0)
})

test('PL-1: after two empty runs the request goes to the operator and its workflow is closed', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
  w.tick(3 * MIN); await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.ok(d.toOperator().has(request().id))
  const close = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true)
  assert.ok(close, 'the workflow is closed')
  assert.equal(close[1].status, 'blocked')
})

test('iteration 2, ER-1: a run whose request is no longer read ends as unknown after its end, freeing its place', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended')
  w.requests = []
  w.deps.requestState = async () => null
  w.tick(30 * MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'running')
  w.tick(30 * MIN + UNKNOWN_AFTER_END_MS + MIN); await d.onPass()
  // CO-512: a run nobody can account for counts as empty (iteration 3, ER-2's rule), or a request moving in and out of
  // the read at its page bounds would be started again and again.
  assert.deepEqual([d.records()[0].state, d.records()[0].outcome, d.records()[0].emptyRuns], ['ended', 'unknown', 1])
})

test('CO-512: a request that drops out of the read while each run is on it gets no third run; it goes to the operator', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  const read = w.deps.requestState
  for (const id of ['L1', 'L2']) {
    await d.onPass()
    assert.equal(w.launches.length, Number(id.slice(1)), `${id} started`)
    // The run ends while its request sits past the read's pages, then the request is read again, still open.
    w.runs.set(id, 'ended'); w.requests = []; w.deps.requestState = async () => null
    w.tick(60 * MIN + UNKNOWN_AFTER_END_MS + MIN); await d.onPass()
    w.requests = [request()]; w.deps.requestState = read
    w.tick(3 * MIN)
  }
  await d.onPass()
  assert.equal(w.launches.length, 2, 'no third run')
  assert.ok(d.toOperator().has(request().id), 'the request is the operator\'s')
})

test('iteration 2, ER-2, ER-3: two empty runs give the request to the operator whatever path it takes now, even when closing fails', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
  // The project now has a live session: the decision would be live-session, yet the request is the operator's.
  w.session = true
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (args.close) throw new Error('down'); return real(name, args) }
  w.tick(3 * MIN); await d.onPass()
  assert.ok(d.toOperator().has(request().id))
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.closed' && l.outcome === 'failed'))
  w.deps.observatory = real
  w.tick(MIN); await d.onPass()
  assert.equal(d.records().find((r) => r.outcome === 'to-operator').closed, true)
})

test('iteration 2, ER-5: a workflow that could not be opened is not opened again every pass', async () => {
  const w = world()
  let opens = 0
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (name === 'observatory_handoff_create') { opens++; throw new Error('offer refused') } return real(name, args) }
  const d = createBoardDispatch(w.deps)
  await d.onPass(); w.tick(MIN); await d.onPass(); w.tick(MIN); await d.onPass()
  assert.equal(opens, 1)
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 2)
})

test('iteration 2, ER-6: with the switch off a start left without an answer is not asked again', async () => {
  const w = world()
  w.deps.launch = async (args) => { w.launches.push(args); return { refused: 'failed' } }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.on = false
  w.tick(MIN); await d.onPass()
  assert.equal(w.launches.length, 1)
})

test('iteration 2, ER-7, DA-3: the back-off counts from the refusal, and refusals do not use up the day', async () => {
  const w = world({ refuse: 'no_agent' })
  const d = createBoardDispatch(w.deps)
  for (let i = 0; i < 30; i++) { await d.onPass(); w.tick(REFUSAL_BACKOFF_MS + MIN) }
  assert.ok(!w.logs.some((l) => l.op === 'board.dispatch.decided' && l.detail.check === 'skipped-daily-cap'))
  const r = d.records()[0]
  assert.equal(typeof r.endedAt, 'number')
})

test('iteration 2, ER-8, DA-2: trimming never drops a record that gave its request to the operator', async () => {
  const w = world({ requests: [] })
  const old = (i, over = {}) => ({ requestId: `r${i}`, projectId: 'p', dispatchId: `d${i}`, workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: 'L', startedAt: T0 - DAY - i, endsAt: new Date(T0).toISOString(), state: 'ended', outcome: 'finished', emptyRuns: 0, ...over })
  w.deps.load = () => [old(0, { outcome: 'to-operator', closed: true, emptyRuns: 2 }), ...Array.from({ length: 600 }, (_, i) => old(i + 1))]
  w.requests = [request()]
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.ok(d.records().some((r) => r.outcome === 'to-operator'))
  // Iteration 3, DA-2: each request's newest record of the last eight days is kept too, so none of these is trimmed.
  assert.equal(d.records().filter((r) => r.state === 'ended').length, 601)
})

test('iteration 3, ER-1: closing a given-up request is tried CLOSE_ATTEMPTS times, then given up', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (args.close) throw new Error('down'); return real(name, args) }
  for (let i = 0; i < CLOSE_ATTEMPTS + 5; i++) { w.tick(MIN); await d.onPass() }
  assert.equal(w.logs.filter((l) => l.op === 'board.dispatch.closed').length, CLOSE_ATTEMPTS)
  assert.ok(d.toOperator().has(request().id))
})

test('iteration 3, ER-2: runs Switchboard cannot report on count as empty, so the stop after two holds', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2']) {
    w.runs.set(id, 'unknown')
    w.tick(60 * MIN + UNKNOWN_AFTER_END_MS + MIN); await d.onPass()
    w.tick(3 * MIN); await d.onPass()
  }
  for (let i = 0; i < 5; i++) { w.tick(30 * MIN); await d.onPass() }
  assert.equal(w.launches.length, 2)
  assert.ok(d.toOperator().has(request().id))
})

// CO-512: Observatory answers a closed workflow with its typed refusal `{error: "WorkflowClosed"}` (as the CO-409 test
// below stands it in); a transport that throws the same name is the second shape. Both open a new workflow.
for (const [shape, answer] of [
  ['Observatory\'s typed refusal', async () => ({ error: 'WorkflowClosed', detail: 'the workflow is closed' })],
  ['a thrown WorkflowClosed', async () => { throw new Error('WorkflowClosed') }]
]) {
  test(`iteration 3, ER-3: a workflow the run closed itself gives the request a new workflow, never a loop (${shape})`, async () => {
    const w = world()
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    w.runs.set('L1', 'ended'); w.tick(3 * MIN)
    const real = w.deps.observatory
    w.deps.observatory = async (name, args) => { if (name === 'observatory_handoff_create' && args.reason === 'restart') return answer(); return real(name, args) }
    await d.onPass()
    assert.equal(w.launches.length, 2)
    assert.ok(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length >= 2, 'a new workflow was opened')
  })
}

test('iteration 3, ER-4, DO-2: with the switch off a pending start ends and the board is no longer read', async () => {
  const w = world()
  w.deps.launch = async (args) => { w.launches.push(args); return { refused: 'failed' } }
  let reads = 0
  const rr = w.deps.readRequests
  w.deps.readRequests = async () => { reads++; return rr() }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.on = false
  const before = reads
  for (let i = 0; i < 5; i++) { w.tick(MIN); await d.onPass() }
  assert.equal(d.records()[0].state, 'ended')
  assert.equal(reads, before)
  assert.equal(w.launches.length, 1)
})

test('iteration 3, DA-2: trimming keeps a request\'s newest record, so its empty runs are not forgotten', async () => {
  const w = world()
  const filler = Array.from({ length: 600 }, (_, i) => ({ requestId: `r${i}`, projectId: 'p', dispatchId: `d${i}`, workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: 'L', startedAt: T0 - 9 * DAY + i, endsAt: new Date(T0).toISOString(), state: 'ended', outcome: 'finished', emptyRuns: 0 }))
  const mine = { requestId: request().id, projectId: 'p-target', dispatchId: 'dm', workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: 'L0', startedAt: T0 - 10 * DAY, endsAt: new Date(T0 - 10 * DAY).toISOString(), state: 'ended', outcome: 'exited-without-answer', emptyRuns: 1 }
  w.deps.load = () => [mine, ...filler]
  w.requests = []
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.ok(d.records().length <= 501)
  const recent = { ...mine, startedAt: T0 - DAY }
  const w2 = world()
  w2.deps.load = () => [recent, ...filler]
  w2.requests = []
  const d2 = createBoardDispatch(w2.deps)
  await d2.onPass()
  assert.ok(d2.records().some((r) => r.dispatchId === 'dm'), 'the request\'s newest record within the week is kept')
})

test('iteration 3, ER-10, DA-4: a note keeps no path, whatever comes before it', () => {
  const cases = [
    'spawn failed: /Users/example/work/fabric',
    'ENOENT, open \'/Users/example/x y/file.json\'',
    'no folder [/Users/example/a]',
    'cwd=/Users/example/a, then more',
    'see file:///Users/example/a/b.log',
    'read ~/Library/Application Support/x',
    'open C:\\Users\\example\\x',
    'list a,/Users/example/b',
    'at `/Users/example/a`',
    'see </Users/example/a>',
    'a;/Users/example/b',
    'piped |/Users/example/b',
    'obj {/Users/example/b}'
  ]
  for (const c of cases) {
    const n = noteOf(new Error(c))
    assert.doesNotMatch(n, /Users|Library|example/, c)
    assert.match(n, /<path>/, c)
  }
  assert.equal(noteOf(new Error('refused: no_agent')), 'refused: no_agent')
})

test('final candidate, B-1: a request given to the operator nine days ago, still on the board, is never dispatched again', async () => {
  const filler = Array.from({ length: 600 }, (_, i) => ({ requestId: `r${i}`, projectId: 'p', dispatchId: `d${i}`, workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: null, startedAt: T0 - 10 * DAY + i, endsAt: new Date(T0).toISOString(), state: 'ended', outcome: 'refused', emptyRuns: 0 }))
  const given = { requestId: request().id, projectId: 'p-target', dispatchId: 'dg', workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: 'L0', startedAt: T0 - 9 * DAY, endsAt: new Date(T0 - 9 * DAY).toISOString(), state: 'ended', outcome: 'to-operator', closed: true, emptyRuns: 2 }
  // The request is on the board this pass (its deadline 20 days out), and the record names no deadline of its own.
  const w = world({ requests: [request({ deadline: new Date(T0 + 20 * DAY).toISOString() })] })
  w.deps.load = () => [given, ...filler]
  const d = createBoardDispatch(w.deps)
  for (let i = 0; i < 3; i++) { await d.onPass(); w.tick(REFUSAL_BACKOFF_MS + MIN) }
  assert.equal(w.launches.length, 0)
  assert.ok(d.records().some((r) => r.dispatchId === 'dg' && r.outcome === 'to-operator'))
  assert.ok(d.toOperator().has(request().id))
})

test('final candidate, B-1: a record keeps its request\'s deadline, so it outlives the board\'s read window', async () => {
  const w = world({ requests: [request({ deadline: new Date(T0 + 20 * DAY).toISOString() })] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.records()[0].until, T0 + 20 * DAY)
})

test('final candidate, NB-1: a dropped connection is not a closed workflow, so no second workflow is opened', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended'); w.tick(3 * MIN)
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (name === 'observatory_handoff_create' && args.reason === 'restart') throw new Error('Connection closed'); return real(name, args) }
  await d.onPass()
  assert.equal(w.launches.length, 1)
  assert.equal(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length, 1)
})

test('CO-409 (FAA-215): the packet tells the run to close the workflow only once the request is settled', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.ok(open.body.constraints.includes('Write the final checkpoint and close the workflow only once the request is settled, then end.'))
  assert.ok(!open.body.constraints.includes('Write the final checkpoint, then end.'))
})

test('CO-409 (FAA-213): a run whose request ends outcome_unknown is finished, never an empty run', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended'); w.states.set(request().id, 'outcome_unknown'); w.requests = [request({ state: 'outcome_unknown' })]
  w.tick(MIN); await d.onPass()
  const r = d.records()[0]
  assert.equal(r.outcome, 'finished')
  assert.equal(r.emptyRuns, 0)
})

test('CO-409 (FAA-213): closing a workflow a run already closed counts as closed, with no retry and no failure', async () => {
  const w = world()
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => {
    if (name === 'observatory_handoff_create' && String(args.idempotencyKey).endsWith('-close-back')) return { error: 'WorkflowClosed', detail: 'closed' }
    return real(name, args)
  }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (let i = 0; i < 2; i++) { w.runs.set(`L${i + 1}`, 'ended'); w.tick(REFUSAL_BACKOFF_MS + MIN); await d.onPass() }
  w.tick(MIN); await d.onPass(); w.tick(MIN); await d.onPass()
  const given = d.records().find((r) => r.outcome === 'to-operator')
  assert.ok(given, 'two empty runs give the request to the operator')
  assert.equal(given.closed, true)
  assert.ok(!w.logs.some((l) => l.op === 'board.dispatch.closed' && l.outcome === 'failed'))
})

test('CO-409: a workflow a run left open is closed by Fabric once another session settles the request', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  // The run ends while another session holds the request: unsettled, so its workflow stays open.
  w.runs.set('L1', 'ended'); w.states.set(request().id, 'in_progress'); w.requests = [request({ state: 'in_progress', attemptLive: true })]
  w.tick(MIN); await d.onPass()
  assert.equal(d.records()[0].outcome, 'exited-without-answer')
  assert.ok(!w.calls.some(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true), 'nothing is closed while the request is open')
  // The other session completes it.
  w.states.set(request().id, 'completed'); w.requests = [request({ state: 'completed' })]
  w.tick(MIN); await d.onPass()
  const close = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true)
  assert.ok(close, 'the workflow is closed')
  assert.equal(close[1].stepId, 'settled')
  assert.equal(close[1].status, 'done')
  assert.equal(d.records()[0].closed, true)
  w.tick(MIN); await d.onPass()
  assert.equal(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true).length, 1, 'closed once')
  assert.equal(w.launches.length, 1)
})

test('a run told to claim is told what a refused com.enroll means, as the board rule says (fabric-agent-adapter FAA-247)', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  const refusal = open.body.constraints.find((c) => c.includes('not_authorized'))
  assert.ok(refusal, 'no constraint says what to do when com.enroll is refused')
  // A run that answers anyway takes the request from the project's service: the reply is only for a slot absent at
  // generation 0, and the operator is asked either way.
  assert.match(refusal, /absent at generation 0/)
  assert.match(refusal, /no com\.reply/)
  assert.match(refusal, /fabric_question_ask/)
  assert.match(refusal, /board\.read-at-start/)
})

test('CO-409 (the 0.3.16 review, ER-6): a refusal that keeps coming back waits twice as long each time, at most six hours', async () => {
  assert.equal(refusalBackoffMs(1), REFUSAL_BACKOFF_MS)
  assert.equal(refusalBackoffMs(2), 2 * REFUSAL_BACKOFF_MS)
  assert.equal(refusalBackoffMs(3), 4 * REFUSAL_BACKOFF_MS)
  assert.equal(refusalBackoffMs(50), REFUSAL_BACKOFF_MAX_MS)
  const w = world({ refuse: 'no_agent' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 2, 'the first refusal waits ten minutes')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 2, 'the second waits twenty')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 3)
  // Once Switchboard starts the run, the count starts again: a later refusal waits ten minutes.
  w.refuse = null
  w.tick(4 * REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 4)
  assert.equal(d.records().at(-1).state, 'running')
})

test('CO-409 (Switchboard SB-294): the hand-over goes to the agent dispatch will start; without the field, the default agent', async () => {
  const { dispatchProvider } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  assert.equal(dispatchProvider({ default: null, dispatch_agent: 'claude-code' }), 'claude', 'no default set: Switchboard falls back to Claude Code')
  assert.equal(dispatchProvider({ default: 'codex', dispatch_agent: 'codex' }), 'codex')
  assert.equal(dispatchProvider({ default: 'claude-code', dispatch_agent: null }), null, 'Switchboard would start nothing: no hand-over')
  assert.equal(dispatchProvider({ default: 'claude-code' }), 'claude', 'an older Switchboard keeps the old rule')
  assert.equal(dispatchProvider({ default: null }), null)
  assert.equal(dispatchProvider({ default: 'hermes' }), null)
  assert.equal(dispatchProvider(undefined), null)
})

test('CO-409 (the 0.3.16 review, ER-5): a workflow is taken back only once it has been silent 120 s, with no back-off meanwhile', async () => {
  const { TAKE_BACK_SILENCE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  const w = world()
  const base = w.deps.observatory
  let lastWrite = null
  w.deps.observatory = async (name, args) => {
    if (name === 'observatory_checkpoint_latest') { w.calls.push([name, args]); return { checkpoint: { createdAt: new Date(lastWrite).toISOString() } } }
    return base(name, args)
  }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  // The run wrote its last checkpoint just before it ended without settling the request.
  w.tick(30 * MIN)
  lastWrite = w.deps.now() - 30_000
  w.runs.set('L1', 'ended')
  await d.onPass()
  assert.equal(w.launches.length, 1, 'not silent yet: nothing is taken back')
  assert.ok(!w.calls.some(([n, a]) => n === 'observatory_handoff_create' && a.reason === 'restart'))
  assert.ok(!w.logs.some((l) => l.op === 'board.dispatch.started' && l.outcome === 'failed'), 'a wait, not a failure')
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.decided' && l.detail.check === 'workflow-not-silent'))
  // One pass later the checkpoint is past the silence: the workflow is taken back and the next run starts, with no back-off.
  w.tick(TAKE_BACK_SILENCE_MS)
  await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.ok(w.calls.some(([n, a]) => n === 'observatory_handoff_create' && a.reason === 'restart'))
})

test('CO-409 (the 0.3.16 review, ER-8): the records file is read record by record, and a record that could not be saved is never started', async () => {
  const { isDispatchRecord } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  const good = { requestId: 'r', projectId: 'p', dispatchId: 'd', workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: null, startedAt: T0, endsAt: new Date(T0).toISOString(), state: 'ended', outcome: 'refused', emptyRuns: 0 }
  assert.equal(isDispatchRecord(good), true)
  for (const bad of [null, [], { ...good, state: 'lost' }, { ...good, startedAt: 'yesterday' }, { ...good, workflowId: '' }, { ...good, projectId: undefined }, { ...good, dispatchId: 5 }, { ...good, emptyRuns: -1 }, { ...good, outcome: 'won' }, { ...good, endsAt: 'soon' }, { ...good, launchId: 7 }])
    assert.equal(isDispatchRecord(bad), false, JSON.stringify(bad))
  // The save that would record a new start fails once: nothing is started now, and no later pass starts that record.
  const w = world()
  let fail = true
  const save = w.deps.save
  w.deps.save = (records) => { if (fail) { fail = false; throw new Error('disk full') } save(records) }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 0)
  assert.equal(d.records().length, 0)
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.started' && l.outcome === 'failed' && /could not be saved/.test(l.detail.note)))
  const closed = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true)
  assert.ok(closed, 'the workflow opened for it is closed')
  assert.equal(closed[1].leaseId, 'lease-1')
  w.tick(MIN); await d.onPass()
  assert.equal(w.launches.length, 0, 'not on the next pass either')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 1, 'after the back-off it is opened and started anew')
})

test('CO-409 (the 0.3.16 review, ER-9): a quit after the workflow opened closes it; an open whose answer was lost is asked again with the same key', async () => {
  // The app starts quitting while the hand-over is offered: nothing starts and the workflow Fabric holds is closed.
  const w = world()
  const base = w.deps.observatory
  w.deps.observatory = async (name, args) => {
    if (name === 'observatory_handoff_create' && args.reason === 'plan_route') w.quitting = true
    return base(name, args)
  }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 0)
  assert.equal(d.records().length, 0)
  const closed = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true)
  assert.ok(closed, 'the workflow is closed, not left open')
  assert.equal(closed[1].leaseId, 'lease-1')
  // The first checkpoint's answer is lost once: the next attempt sends the same idempotency key, so Observatory
  // answers the workflow it opened rather than a second one.
  const v = world()
  let lose = true
  const vbase = v.deps.observatory
  v.deps.observatory = async (name, args) => {
    const answer = await vbase(name, args)
    if (name === 'observatory_checkpoint_write' && !args.workflowId && lose) { lose = false; throw new Error('the connection dropped') }
    return answer
  }
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  assert.equal(v.launches.length, 0)
  v.tick(REFUSAL_BACKOFF_MS); await e.onPass()
  assert.equal(v.launches.length, 1)
  const opens = v.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).map(([, a]) => a.idempotencyKey)
  assert.equal(opens.length, 2)
  assert.equal(opens[0], opens[1], 'the same key both times')
  assert.equal(v.launches[0].dispatchId, opens[0].replace(/^dispatch-|-open$/g, ''))
})

test('CO-409 (the 0.3.16 review, ER-7): an accepted request past its deadline that Fabric never started for is shown in «На проверке»', async () => {
  const w = world({ requests: [request({ state: 'accepted', deadline: new Date(T0 - MIN).toISOString() })] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 0)
  assert.equal(d.records().length, 0, 'no record: nothing was started')
  assert.ok(d.toOperator().has(request().id))
  // Settled, or gone from the board: it leaves «На проверке».
  w.requests = []
  w.tick(MIN); await d.onPass()
  assert.equal(d.toOperator().has(request().id), false)
})

test('CO-409 (ER-7): a request past due and one given up after two runs say which they are', async () => {
  const w = world({ requests: [request({ state: 'accepted', deadline: new Date(T0 - MIN).toISOString() })] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.toOperator().get(request().id), 'past-due')
  const { findAbandoned } = await import(path.resolve(import.meta.dirname, '../src/shared/abandonedSweep.ts'))
  const base = { requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'accepted', movedAt: new Date(T0 - DAY).toISOString(), answerUnreadSince: null, toOperator: true }
  const steps = (r) => findAbandoned({ now: T0, claims: [], tasks: [], requests: [r], terminals: [] }).filter((f) => f.kind === 'request-to-operator').map((f) => f.nextStep)
  assert.match(steps({ ...base, pastDue: true })[0], /passed its deadline/)
  assert.match(steps(base)[0], /Two runs/)
})
