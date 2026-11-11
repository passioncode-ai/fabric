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
  const w = { requests: [request()], responder: false, session: false, on: true, folder: '/work/target', provider: 'claude-code',
    calls: [], launches: [], runs: new Map(), states: new Map(), saved: [], logs: [], refuse: null, remote: new Map(), relays: [], ...over }
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
    launch: async (args) => {
      w.launches.push(args)
      if (args.target && w.remoteRefuse) return { refused: w.remoteRefuse }
      return w.refuse ? { refused: w.refuse } : { launchId: `L${w.launches.length}` }
    },
    // CO-551: the machine named in Settings, `dispatch status` of a run there, and the operator's board reply.
    remoteTarget: () => w.target ?? null,
    remoteState: async (id) => w.remote.get(id) ?? { state: 'running', exitCode: null, result: null },
    relay: async (projectId, requestId, text, key) => {
      w.relays.push({ projectId, requestId, text, key })
      return w.relayRefuse ? { refused: w.relayRefuse } : { posted: true }
    },
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
  assert.deepEqual(w.calls[2][1].to, { provider: 'claude-code' })
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
  // The second empty run starts a third (CO-559: started again by force); after the third no fourth (§3.6, option (b)).
  w.runs.set('L2', 'ended')
  w.tick(3 * MIN)
  await d.onPass()
  assert.equal(w.launches.length, 3)
  w.runs.set('L3', 'ended')
  w.tick(3 * MIN)
  await d.onPass()
  assert.equal(d.records()[2].emptyRuns, 3)
  assert.equal(w.launches.length, 3)
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

test('PL-1: after three empty runs (CO-559) the request goes to the operator and its workflow is closed', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2', 'L3']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
  w.tick(3 * MIN); await d.onPass()
  assert.equal(w.launches.length, 3)
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

test('CO-512: a request that drops out of the read while each run is on it gets no fourth run; it goes to the operator', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  const read = w.deps.requestState
  for (const id of ['L1', 'L2', 'L3']) {
    await d.onPass()
    assert.equal(w.launches.length, Number(id.slice(1)), `${id} started`)
    // The run ends while its request sits past the read's pages, then the request is read again, still open.
    w.runs.set(id, 'ended'); w.requests = []; w.deps.requestState = async () => null
    w.tick(60 * MIN + UNKNOWN_AFTER_END_MS + MIN); await d.onPass()
    w.requests = [request()]; w.deps.requestState = read
    w.tick(3 * MIN)
  }
  await d.onPass()
  assert.equal(w.launches.length, 3, 'no fourth run')
  assert.ok(d.toOperator().has(request().id), 'the request is the operator\'s')
})

test('iteration 2, ER-2, ER-3: the empty runs give the request to the operator whatever path it takes now, even when closing fails', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2', 'L3']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
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

// CO-544: an open that keeps failing (Observatory does not know the project) waited a flat REFUSAL_BACKOFF_MS for the
// request's whole week, 87 tries in 15 hours on the operator's Mac; each failure in a row now doubles the wait.
test('CO-544: a workflow open that keeps failing waits longer each time, up to the refusal ceiling', async () => {
  const w = world()
  let opens = 0
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (name === 'observatory_handoff_create') { opens++; throw new Error('Observatory does not know this project') } return real(name, args) }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(opens, 1)
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 2, 'the first wait is the refusal back-off')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 2, 'the second failure in a row waits twice as long')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 3)
  w.tick(3 * REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 3, 'the third waits four times as long')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(opens, 4)
})

test('CO-544: a folder two Observatory projects measure is said as ambiguous, with the candidates', async () => {
  const w = world()
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => (name === 'observatory_resolve' ? { error: 'ambiguous', candidates: ['project:a', 'project:b'] } : real(name, args))
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  const failed = w.logs.find((l) => l.op === 'board.dispatch.started' && l.outcome === 'failed')
  assert.match(failed?.detail.note ?? '', /several projects for this folder \(project:a, project:b\)/)
})

test('a project Observatory knows by its Fabric name is resolved by it, before and instead of its folder', async () => {
  const w = world()
  const real = w.deps.observatory
  const asked = []
  w.deps.observatory = async (name, args) => {
    if (name !== 'observatory_resolve') return real(name, args)
    asked.push(args.id)
    return args.id.startsWith('fabric:') ? { canonical: 'project:by-name' } : { error: 'ambiguous', candidates: ['project:a', 'project:b'] }
  }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1, 'started although the folder is ambiguous')
  assert.deepEqual(asked, [`fabric:${request().target}`])
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.equal(open.projectId, 'project:by-name')
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
  for (const id of ['L1', 'L2', 'L3']) { w.runs.set(id, 'ended'); w.tick(3 * MIN); await d.onPass() }
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => { if (args.close) throw new Error('down'); return real(name, args) }
  for (let i = 0; i < CLOSE_ATTEMPTS + 5; i++) { w.tick(MIN); await d.onPass() }
  assert.equal(w.logs.filter((l) => l.op === 'board.dispatch.closed').length, CLOSE_ATTEMPTS)
  assert.ok(d.toOperator().has(request().id))
})

test('iteration 3, ER-2: runs Switchboard cannot report on count as empty, so the stop after three holds', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const id of ['L1', 'L2', 'L3']) {
    w.runs.set(id, 'unknown')
    w.tick(60 * MIN + UNKNOWN_AFTER_END_MS + MIN); await d.onPass()
    w.tick(3 * MIN); await d.onPass()
  }
  for (let i = 0; i < 5; i++) { w.tick(30 * MIN); await d.onPass() }
  assert.equal(w.launches.length, 3)
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
  for (let i = 0; i < 3; i++) { w.runs.set(`L${i + 1}`, 'ended'); w.tick(REFUSAL_BACKOFF_MS + MIN); await d.onPass() }
  w.tick(MIN); await d.onPass(); w.tick(MIN); await d.onPass()
  const given = d.records().find((r) => r.outcome === 'to-operator')
  assert.ok(given, 'three empty runs give the request to the operator')
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

test('CO-530 (fabric-agent-contract DEC-0152, SA-6): a run reads the slot first, leaves a live holder alone and asks no one, and accepts before it completes', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  const c = open.body.constraints
  const slot = c.findIndex((x) => x.startsWith('Read the slot with com.status first'))
  const claim = c.findIndex((x) => x.includes('com.enroll, com.claim'))
  assert.ok(slot >= 0 && claim > slot, 'the slot is read before the claim')
  assert.match(c[slot], /active[\s\S]*leave it, send nothing, ask no one and end/)
  assert.match(c[claim], /com\.progress[\s\S]*com\.accept before its effect begins[\s\S]*com\.complete/)
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
  // CO-556: the agent id itself, the one Switchboard's dispatch prompt tells the session to accept as (never 'claude').
  assert.equal(dispatchProvider({ default: null, dispatch_agent: 'claude-code' }), 'claude-code', 'no default set: Switchboard falls back to Claude Code')
  assert.equal(dispatchProvider({ default: 'codex', dispatch_agent: 'codex' }), 'codex')
  assert.equal(dispatchProvider({ default: 'claude-code', dispatch_agent: null }), null, 'Switchboard would start nothing: no hand-over')
  assert.equal(dispatchProvider({ default: 'claude-code' }), 'claude-code', 'an older Switchboard keeps the old rule')
  assert.equal(dispatchProvider({ default: null }), null)
  assert.equal(dispatchProvider({ default: 'hermes' }), null)
  assert.equal(dispatchProvider(undefined), null)
})

test('CO-556: the session Switchboard starts accepts the hand-over, because it is offered to the agent Switchboard reports', async () => {
  // Observed on 0.3.18 rc.2, 2026-11-10: the offer went to 'claude', Switchboard's dispatch prompt (0.7.40) accepts as
  // executor {provider: 'claude-code'}, and Observatory refused: "the handoff goes to claude, not claude-code".
  const { dispatchProvider } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  for (const agent of ['claude-code', 'codex']) {
    const status = { data: { default: null, dispatch_agent: agent } } // `switchboard --json agents status`
    const w = world()
    w.deps.defaultProvider = async () => dispatchProvider(status.data)
    const base = w.deps.observatory
    const offers = new Map()
    const accepted = []
    w.deps.observatory = async (name, args) => {
      const out = await base(name, args)
      if (name === 'observatory_handoff_create') offers.set(out.handoffId, args.to.provider)
      // Observatory's rule: an executor accepts only an offer made to its own provider.
      if (name === 'observatory_handoff_accept' && args.executor && offers.get(args.handoffId) !== args.executor.provider) {
        return { error: `InvalidInput: the handoff goes to ${offers.get(args.handoffId)}, not ${args.executor.provider}` }
      }
      return out
    }
    // The run Switchboard starts: its prompt accepts as the agent Switchboard named, then works.
    w.deps.launch = async (args) => {
      w.launches.push(args)
      const took = await w.deps.observatory('observatory_handoff_accept', { owner: `agent:${agent}`, idempotencyKey: 'run-accept', handoffId: args.handoff, executor: { provider: agent, accountRef: 'acct' } })
      accepted.push(took)
      return { launchId: `L${w.launches.length}` }
    }
    await createBoardDispatch(w.deps).onPass()
    assert.equal(w.launches.length, 1, agent)
    assert.equal(accepted[0].error, undefined, `${agent}: ${accepted[0].error}`)
    assert.equal(accepted[0].leaseId, 'lease-2', agent)
  }
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
  // CO-554: the same body too, the packet deadline included, though the retry is written later (Observatory's
  // idempotency compares the request).
  const bodies = v.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).map(([, a]) => a.body)
  assert.deepEqual(bodies[0], bodies[1])
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

test('CO-409 (ER-7): a request past due and one given up after three runs (CO-559) say which they are', async () => {
  const w = world({ requests: [request({ state: 'accepted', deadline: new Date(T0 - MIN).toISOString() })] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.toOperator().get(request().id), 'past-due')
  const { findAbandoned } = await import(path.resolve(import.meta.dirname, '../src/shared/abandonedSweep.ts'))
  const base = { requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'accepted', movedAt: new Date(T0 - DAY).toISOString(), answerUnreadSince: null, toOperator: true }
  const steps = (r) => findAbandoned({ now: T0, claims: [], tasks: [], requests: [r], terminals: [] }).filter((f) => f.kind === 'request-to-operator').map((f) => f.nextStep)
  assert.match(steps({ ...base, pastDue: true })[0], /passed its deadline/)
  assert.match(steps(base)[0], /Three runs/)
})

test('CO-409 (final candidate, NB-2): a start the switch ended after Switchboard was asked is asked again with the same dispatch id once the switch is back on', async () => {
  const w = world()
  let answer = { refused: 'failed' }
  w.deps.launch = async (args) => { w.launches.push(args); return answer }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.records()[0].state, 'starting', 'no answer: it may have started')
  w.on = false
  w.tick(MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'ended')
  assert.equal(d.records()[0].askAgain, true)
  // Back on: Switchboard is asked again with the same ids and answers the run it did start.
  w.on = true
  answer = { launchId: 'L1' }
  w.tick(MIN); await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.equal(w.launches[1].dispatchId, w.launches[0].dispatchId)
  assert.equal(w.launches[1].workflow, w.launches[0].workflow)
  assert.equal(d.records().length, 1)
  assert.equal(d.records()[0].state, 'running')
  // A request settled meanwhile is not asked about again.
  const v = world()
  v.deps.launch = async (args) => { v.launches.push(args); return { refused: 'failed' } }
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  v.on = false; v.tick(MIN); await e.onPass()
  v.on = true; v.requests = [request({ state: 'completed' })]; v.tick(MIN); await e.onPass()
  assert.equal(v.launches.length, 1)
})

test('CO-409 (final candidate, NB-5): a trim never drops a run started in the last day, so the day\'s count holds', async () => {
  const w = world({ requests: [] })
  const run = (i) => ({ requestId: 'r-busy', projectId: 'p-target', dispatchId: `d${i}`, workflowId: 'wf_0123456789abcdef', handoffId: 'h', launchId: `L${i}`, startedAt: T0 - 2 * 3600_000 + i, endsAt: new Date(T0).toISOString(), state: 'ended', outcome: 'exited-without-answer', closed: true, emptyRuns: 0 })
  w.deps.load = () => Array.from({ length: 600 }, (_, i) => run(i))
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(d.records().length, 600)
})

test('CO-409 (DO-5, §3.6): a run still running past its end is stopped through Switchboard and ends timed-out', async () => {
  const { STOP_GRACE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  const w = world()
  const stops = []
  let answer = 'failed'
  w.deps.stop = async (id) => { stops.push(id); return answer }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  // Within its hour and the grace nothing is stopped.
  w.tick(60 * MIN); await d.onPass()
  assert.equal(stops.length, 0)
  // Past them: Switchboard is asked to stop it. A stop that fails leaves it running and is said, then asked again.
  w.tick(STOP_GRACE_MS + MIN); await d.onPass()
  assert.deepEqual(stops, ['L1'])
  assert.equal(d.records()[0].state, 'running')
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.ended' && l.outcome === 'failed' && l.detail.outcome === 'timed-out'))
  answer = 'stopped'
  w.tick(MIN); await d.onPass()
  assert.equal(stops.length, 2)
  const r = d.records()[0]
  assert.deepEqual([r.state, r.outcome, r.emptyRuns], ['ended', 'timed-out', 1])
})

test('CO-409 (DO-5, §3.6): a request outside the read is followed through its own transitions, once a pass', async () => {
  const { createRequestFollower } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  let reads = 0
  let reply = { ok: true, more: false, steps: [{ op: 'submit', from: 'none', to: 'queued' }, { op: 'complete', from: 'in_progress', to: 'completed' }] }
  const f = createRequestFollower(async () => { reads++; return reply })
  assert.equal(await f.state('r'), 'completed', 'the newest transition says where it is')
  assert.equal(await f.state('r'), 'completed')
  assert.equal(reads, 1, 'read once a pass')
  f.reset()
  reply = { ok: true, more: true, steps: [{ op: 'submit', from: 'none', to: 'queued' }] }
  assert.equal(await f.state('r'), null, 'a first page alone does not say where it is now')
  f.reset()
  reply = { ok: false, error: { code: 'unavailable', message: 'down' } }
  assert.equal(await f.state('r'), null)
  const broken = createRequestFollower(async () => { throw new Error('down') })
  assert.equal(await broken.state('r'), null)
  assert.equal(await createRequestFollower().state('r'), null)
})

test('CO-409 (§3.4): a run that exited with a failure code is taken back as crash, any other as restart', async () => {
  const { runStateOf } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  assert.equal(runStateOf({ state: 'running' }), 'running')
  assert.equal(runStateOf({ state: 'ended', ended: { kind: 'exited', exit_code: 3, at: 1 } }), 'crashed')
  assert.equal(runStateOf({ state: 'ended', ended: { kind: 'exited', exit_code: 0, at: 1 } }), 'ended')
  assert.equal(runStateOf({ state: 'ended', ended: { kind: 'exited', at: 1 } }), 'ended', 'no code reaped: not a crash')
  assert.equal(runStateOf({ state: 'ended', ended: { kind: 'stopped', at: 1 } }), 'ended')
  assert.equal(runStateOf({ state: 'ended', ended: 'limit' }), 'ended')
  assert.equal(runStateOf(undefined), 'unknown')
  const w = world()
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'crashed')
  w.tick(3 * MIN); await d.onPass()
  assert.equal(d.records()[0].crashed, true)
  const back = w.calls.find(([n, a]) => n === 'observatory_handoff_create' && a.to?.provider === 'fabric')
  assert.equal(back[1].reason, 'crash')
})

test('CO-409 (§3.1): a request stored wakes the dispatcher once its grace ends; several together wake it once', async () => {
  const { createDispatchWake, GRACE_AFTER_MS } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  let now = 0
  const timers = []
  let passes = 0
  const wake = createDispatchWake(() => { passes++ }, {
    graceMs: GRACE_AFTER_MS, now: () => now,
    setTimer: (fn, ms) => { const t = { fn, at: now + ms, live: true }; timers.push(t); return t },
    clearTimer: (t) => { t.live = false }
  })
  wake.wake()
  now += 10_000; wake.wake()
  assert.equal(timers.filter((t) => t.live).length, 1, 'one wake covers both requests')
  assert.equal(timers[0].at, GRACE_AFTER_MS)
  now = timers[0].at; timers[0].live = false; timers[0].fn()
  assert.equal(passes, 1)
  wake.wake()
  wake.stop()
  assert.equal(timers.filter((t) => t.live).length, 0, 'stopped on quit')
  assert.ok(GRACE_AFTER_MS > 2 * 60_000, 'after the grace, so the pass can start it')
})

test('CO-409 (DEC-0125 MD-3): a request\'s mandate travels into the run\'s packet unchanged; without one the packet has none', async () => {
  const mandate = { kind: 'mandate/1', by: 'operator', task: 'Rotate the key', instruction: 'rotate it', at: '2026-11-05T09:00:00Z', expiresAt: '2026-11-08T09:00:00Z', scope: { effects: ['none'] }, chain: [{ agent: 'sender-agent', at: '2026-11-05T09:00:00Z' }] }
  const w = world({ requests: [request({ mandate })] })
  await createBoardDispatch(w.deps).onPass()
  const packet = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1].body
  const line = packet.constraints.find((c) => c.includes('mandate/1'))
  assert.ok(line, 'the mandate is in the constraints')
  assert.ok(line.includes(JSON.stringify(mandate)), 'unchanged')
  const v = world()
  await createBoardDispatch(v.deps).onPass()
  assert.equal(v.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1].body.constraints.some((c) => c.includes('mandate')), false)
})

/** An Observatory stand-in that keeps the rules of `dispatch_packet.py#check_write`: a packet deadline more than seven
 *  days after the write is refused, the packet is frozen at the opening write, and a later write that changes a frozen
 *  ref is refused (`packet-frozen`); a later write that leaves it out keeps it. */
function freezingObservatory(w, frozen = new Map()) {
  let n = 0
  return async (name, args) => {
    w.calls.push([name, args])
    if (name === 'observatory_resolve') return { canonical: 'project:target' }
    if (name === 'observatory_checkpoint_write') {
      const ref = args.body.artifacts?.find((a) => a.ref.startsWith('deadline:'))?.ref.slice('deadline:'.length)
      if (!args.workflowId) {
        if (ref && Date.parse(ref) > w.deps.now() + 7 * DAY) return { error: 'DeadlineTooFar' }
        frozen.set('wf_0123456789abcdef', ref)
        return { workflowId: 'wf_0123456789abcdef', leaseId: 'lease-1' }
      }
      if (ref !== undefined && ref !== frozen.get(args.workflowId)) return { error: 'PacketFrozen' }
      return { workflowId: args.workflowId, revision: 2 }
    }
    if (name === 'observatory_handoff_create') return { handoffId: `handoff:${String(++n).padStart(16, '0')}` }
    if (name === 'observatory_handoff_accept') return { leaseId: 'lease-2' }
    return {}
  }
}

test('CO-554: a request whose deadline is more than seven days out opens a workflow whose packet deadline Observatory takes (DeadlineTooFar, 2026-11-09)', async () => {
  // Observatory refuses a packet deadline more than seven days after the write (dispatch_packet.py#check_write).
  const w = world({ requests: [request({ submittedAt: new Date(T0 - 2 * DAY).toISOString(), deadline: new Date(T0 + 12 * DAY).toISOString() })] })
  w.deps.observatory = freezingObservatory(w)
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1, JSON.stringify(w.logs))
  const open = w.calls.find(([n]) => n === 'observatory_checkpoint_write')[1]
  assert.ok(open.body.artifacts.some((a) => a.ref === `deadline:${new Date(T0 + 7 * DAY - MIN).toISOString()}`))
})

test('CO-554 (0.3.18 review, DA-13, ER-24): the board\'s default deadline is written as it is, and a later write leaves the frozen deadline out', async () => {
  // A request with the board's default deadline (168 hours after it was sent): the packet carries the board's own
  // value, as 0.3.17 wrote it, so a workflow either version opened is taken back without a packet-frozen refusal.
  const submitted = T0 - 5 * MIN
  const raw = new Date(submitted + 7 * DAY).toISOString()
  const frozen = new Map()
  const w = world({ requests: [request({ submittedAt: new Date(submitted).toISOString(), deadline: raw })] })
  w.deps.observatory = freezingObservatory(w, frozen)
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(frozen.get('wf_0123456789abcdef'), raw)
  w.runs.set('L1', 'ended')
  w.tick(3 * MIN)
  await d.onPass()
  assert.equal(w.launches.length, 2, JSON.stringify(w.logs))
  const later = w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && a.workflowId)
  assert.ok(later.length > 0)
  for (const [, a] of later) assert.equal(a.body.artifacts.some((x) => x.ref.startsWith('deadline:')), false)
  // The same workflow opened by 0.3.17 with a value this version would cut (a far deadline) is taken back too.
  const old = new Map()
  const v = world({ requests: [request({ submittedAt: new Date(T0 - 2 * DAY).toISOString(), deadline: new Date(T0 + 12 * DAY).toISOString() })] })
  v.deps.observatory = freezingObservatory(v, old)
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  old.set('wf_0123456789abcdef', new Date(T0 + 5 * DAY).toISOString())
  v.runs.set('L1', 'ended')
  v.tick(3 * MIN)
  await e.onPass()
  assert.equal(v.launches.length, 2, JSON.stringify(v.logs))
})

test('CO-554 (0.3.18 review, DA-14, ER-25): a request sent more than a week ago gets a packet deadline still ahead', async () => {
  const w = world({ requests: [request({ submittedAt: new Date(T0 - 9 * DAY).toISOString(), deadline: new Date(T0 + 20 * DAY).toISOString() })] })
  w.deps.observatory = freezingObservatory(w)
  await createBoardDispatch(w.deps).onPass()
  assert.equal(w.launches.length, 1, JSON.stringify(w.logs))
  const ref = w.calls.find(([n]) => n === 'observatory_checkpoint_write')[1].body.artifacts.find((a) => a.ref.startsWith('deadline:')).ref
  assert.ok(Date.parse(ref.slice('deadline:'.length)) > T0 + 6 * DAY)
})

// CO-551, stage A: a run on another machine (the Mac Studio) answers through the dispatcher. Contract with
// fabric-switchboard 0.7.40 on the board, thread `14d6cb73` (`ac25c446`, `e6f33c33`, `13f00feb`): `dispatch --target`,
// `dispatch status --json` {state, exit_code, result}, refusals not_on_target, target_busy, target_unreachable.
const WF = 'wf_0123456789abcdef'
const HANDOFF = 'handoff:0000000000000001'
const resultFile = (over = {}) => {
  const o = { workflow: WF, handoff: HANDOFF, request: request().id, launch: 'L1', outcome: 'answered', branch: 'feat/x', commit: 'abc1234', body: 'Готово: ветка feat/x.', ...over }
  return [`fabric-dispatch/1 result workflow=${o.workflow} handoff=${o.handoff} request=${o.request} launch=${o.launch}`, `outcome=${o.outcome}`,
    ...(o.branch ? [`branch=${o.branch}`] : []), ...(o.commit ? [`commit=${o.commit}`] : []), '', o.body].join('\n')
}
const closes = (w) => w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true).map(([, a]) => a)

test('CO-551: with a machine named in Settings the run starts there, and Fabric keeps the workflow (nobody accepts the offer)', async () => {
  const w = world({ target: 'studio' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  assert.equal(w.launches[0].target, 'studio')
  assert.equal(d.records()[0].target, 'studio')
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.started' && l.detail.target === 'studio'))
  // Without a machine named, nothing changes: no target is passed.
  const v = world()
  await createBoardDispatch(v.deps).onPass()
  assert.equal('target' in v.launches[0], false)
})

test('CO-551 (D-2): not_on_target, target_busy and target_unreachable start the run on this machine in the same pass', async () => {
  for (const code of ['not_on_target', 'target_busy', 'target_unreachable']) {
    const w = world({ target: 'studio', remoteRefuse: code })
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    assert.equal(w.launches.length, 2, code)
    assert.equal(w.launches[1].target, undefined)
    assert.equal(w.launches[1].workflow, w.launches[0].workflow)
    const r = d.records()[0]
    assert.equal(r.state, 'running')
    assert.equal(r.target, undefined)
    assert.ok(w.logs.some((l) => l.op === 'board.dispatch.remote-refused' && l.detail.reason === code), code)
  }
  // Any other refusal is the run's refusal, as on this machine.
  const v = world({ target: 'studio', remoteRefuse: 'no_agent' })
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  assert.equal(v.launches.length, 1)
  assert.equal(e.records()[0].outcome, 'refused')
})

test('CO-551: a result whose ids match is posted in the request\'s thread as the target project, marked with the launch; the workflow closes once the request is answered', async () => {
  const w = world({ target: 'studio' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  // Running there: nothing posted, nothing closed.
  w.tick(MIN)
  await d.onPass()
  assert.equal(w.relays.length, 0)
  w.remote.set('L1', { state: 'exited', exitCode: 0, result: resultFile() })
  w.tick(MIN)
  await d.onPass()
  assert.equal(w.relays.length, 1)
  const posted = w.relays[0]
  assert.equal(posted.projectId, 'p-target')
  assert.equal(posted.requestId, request().id)
  assert.match(posted.text, /^_Ретрансляция запуска `L1` с машины `studio`/)
  assert.ok(posted.text.endsWith('Готово: ветка feat/x.'))
  assert.equal(closes(w).length, 0, 'not closed before the request reads answered')
  assert.equal(d.records()[0].state, 'running')
  // The next pass reads the request answered: the record ends finished and the workflow closes under Fabric's own lease.
  w.states.set(request().id, 'answered')
  w.requests = [request({ state: 'answered' })]
  w.tick(MIN)
  await d.onPass()
  assert.equal(w.relays.length, 1, 'posted once')
  const r = d.records()[0]
  assert.equal(r.outcome, 'finished')
  assert.equal(r.closed, true)
  const [close] = closes(w)
  assert.equal(close.leaseId, 'lease-1')
  assert.equal(close.status, 'done')
  assert.match(close.body.notes, /L1/)
  assert.match(close.body.notes, /abc1234/)
  // Nothing more starts for it.
  w.tick(10 * MIN)
  await d.onPass()
  assert.equal(w.launches.length, 1)
})

test('CO-551: a result from another run, or in another shape, is never posted; it is logged and the request shows in «На проверке»', async () => {
  for (const [text, reason] of [[resultFile({ launch: 'L9' }), 'other-run'], [resultFile({ request: '33333333-3333-4333-8333-333333333333' }), 'other-run'], ['hello', 'unreadable']]) {
    const w = world({ target: 'studio' })
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    w.remote.set('L1', { state: 'exited', exitCode: 0, result: text })
    w.tick(MIN)
    await d.onPass()
    assert.equal(w.relays.length, 0, reason)
    assert.ok(w.logs.some((l) => l.op === 'board.dispatch.relay' && l.outcome === 'failed' && l.detail.reason === reason), reason)
    assert.equal(JSON.stringify(w.logs).includes('hello'), false, 'the file\'s text never reaches the log')
    assert.equal(d.toOperator().get(request().id), 'relay')
    // No further run, and the workflow Fabric opened is closed.
    w.tick(10 * MIN)
    await d.onPass()
    assert.equal(w.launches.length, 1)
    assert.equal(closes(w).length, 1)
  }
})

test('CO-551 (D-2): lost and unknown close nothing; past the run\'s end the run shows in «На проверке», and a result read later is still posted', async () => {
  const w = world({ target: 'studio' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  for (const state of ['lost', 'unknown']) {
    w.remote.set('L1', { state, exitCode: null, result: null })
    w.tick(30 * MIN)
    await d.onPass()
    assert.equal(d.records()[0].state, 'running', state)
    assert.equal(closes(w).length, 0, state)
    assert.equal(d.toOperator().has(request().id), false, state)
  }
  // Past its end plus the margin: shown, still not closed, still asked.
  w.tick(UNKNOWN_AFTER_END_MS + MIN)
  await d.onPass()
  assert.equal(d.toOperator().get(request().id), 'remote-lost')
  assert.equal(d.records()[0].state, 'running')
  assert.equal(closes(w).length, 0)
  assert.equal(w.launches.length, 1, 'no second run while the first is lost')
  // The machine answers again: the result is posted and the mark leaves «На проверке».
  w.remote.set('L1', { state: 'timed_out', exitCode: null, result: resultFile() })
  w.tick(MIN)
  await d.onPass()
  assert.equal(w.relays.length, 1)
  assert.equal(d.toOperator().has(request().id), false)
})

test('CO-551 (D-2): outcome failed or blocked, or a run timed out or stopped without a result, counts an empty run, posts nothing and closes the workflow', async () => {
  const cases = [
    [{ state: 'exited', exitCode: 0, result: resultFile({ outcome: 'failed', body: '' }) }, 'exited-without-answer'],
    [{ state: 'exited', exitCode: 1, result: resultFile({ outcome: 'blocked', body: 'нужен оператор' }) }, 'exited-without-answer'],
    [{ state: 'timed_out', exitCode: null, result: null }, 'timed-out'],
    [{ state: 'stopped', exitCode: null, result: null }, 'exited-without-answer'],
    [{ state: 'exited', exitCode: 0, result: null }, 'exited-without-answer']
  ]
  for (const [status, outcome] of cases) {
    const w = world({ target: 'studio' })
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    w.remote.set('L1', status)
    w.tick(3 * MIN)
    await d.onPass()
    const r = d.records()[0]
    assert.equal(r.outcome, outcome, JSON.stringify(status))
    assert.equal(r.emptyRuns, 1)
    assert.equal(w.relays.length, 0)
    assert.equal(r.closed, true)
    const [close] = closes(w)
    assert.equal(close.leaseId, 'lease-1')
    assert.equal(close.status, 'blocked', 'Observatory takes in_progress, done or blocked; failed was refused live')
    // The next run opens a workflow of its own rather than taking a closed one back.
    assert.equal(w.launches.length, 2, JSON.stringify(w.logs.filter((l) => l.outcome !== 'ok')))
    assert.equal(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length, 2)
  }
})

test('CO-551: a reply the board refuses is asked again with the same key; one refused every time goes to the operator, unposted', async () => {
  const w = world({ target: 'studio', relayRefuse: 'unavailable' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.remote.set('L1', { state: 'exited', exitCode: 0, result: resultFile() })
  for (let i = 0; i < CLOSE_ATTEMPTS; i++) { w.tick(MIN); await d.onPass() }
  assert.equal(w.relays.length, CLOSE_ATTEMPTS)
  assert.equal(new Set(w.relays.map((x) => x.key)).size, 1)
  assert.match(w.relays[0].key, /^dispatch-relay:/)
  assert.equal(d.records()[0].outcome, 'to-operator')
  assert.equal(d.toOperator().get(request().id), 'relay')
  // A refusal for a request already settled elsewhere ends the run finished, with nothing more owed.
  const v = world({ target: 'studio', relayRefuse: 'invalid_arguments' })
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  v.remote.set('L1', { state: 'exited', exitCode: 0, result: resultFile() })
  v.states.set(request().id, 'completed')
  v.tick(MIN)
  await e.onPass()
  assert.equal(e.records()[0].outcome, 'finished')
})

test('CO-551: a record of a run on another machine survives the file, field by field', async () => {
  const { isDispatchRecord } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  const base = { requestId: 'r', projectId: 'p', dispatchId: 'd', workflowId: WF, handoffId: HANDOFF, launchId: 'L1', startedAt: T0, endsAt: new Date(T0).toISOString(), state: 'running', emptyRuns: 0 }
  assert.equal(isDispatchRecord({ ...base, target: 'studio', relayed: true, relayAttempts: 2, lost: false, unposted: 'other-run', result: { outcome: 'answered', branch: 'b', commit: null } }), true)
  assert.equal(isDispatchRecord({ ...base, target: '' }), false)
  assert.equal(isDispatchRecord({ ...base, result: { outcome: 'done', branch: null, commit: null } }), false)
  assert.equal(isDispatchRecord({ ...base, relayed: 'yes' }), false)
})

test('CO-551: the wiring passes --target, reads dispatch status and answers through the operator\'s board door', async () => {
  const { dispatchArgs, remoteStateOf, relayReply } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  const a = { dir: '/w/p', workflow: WF, handoff: HANDOFF, request: request().id, dispatchId: 'd-1', timeoutMinutes: 60 }
  assert.deepEqual(dispatchArgs(a).slice(-2), ['--timeout-minutes', '60'])
  assert.deepEqual(dispatchArgs({ ...a, target: 'studio' }).slice(-2), ['--target', 'studio'])
  // CO-559: `--reason inbox` only for an inbox run, only on a Switchboard that takes it, never with a target.
  const reasonOf = (args) => args[args.indexOf('--reason') + 1]
  assert.equal(reasonOf(dispatchArgs(a, true)), 'request')
  assert.equal(reasonOf(dispatchArgs({ ...a, reason: 'inbox' }, false)), 'request')
  assert.equal(reasonOf(dispatchArgs({ ...a, reason: 'inbox' }, true)), 'inbox')
  assert.equal(reasonOf(dispatchArgs({ ...a, reason: 'inbox', target: 'studio' }, true)), 'request')
  const { takesInboxReason } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  assert.deepEqual(['switchboard 0.7.54', 'switchboard 0.7.55', 'switchboard 0.7.56', 'switchboard 0.8.0', 'switchboard 1.0.0', 'switchboard 0.6.99', '', 'no version'].map(takesInboxReason),
    [false, false, true, true, true, false, false, false])
  assert.deepEqual(remoteStateOf({ data: { launch_id: 'L1', target: 'studio', state: 'exited', exit_code: 0, result: 'x', worktree: 'removed' } }), { state: 'exited', exitCode: 0, result: 'x' })
  assert.deepEqual(remoteStateOf({ data: { state: 'timed_out', exit_code: null, result: null } }), { state: 'timed_out', exitCode: null, result: null })
  // A state it does not know, or no data, is unknown: nothing is closed on it.
  assert.deepEqual(remoteStateOf({ data: { state: 'gone' } }), { state: 'unknown', exitCode: null, result: null })
  assert.deepEqual(remoteStateOf(null), { state: 'unknown', exitCode: null, result: null })
  const sent = []
  const board = { epoch: async () => 3, reply: async (input) => { sent.push(input); return { messageId: 'm1' } } }
  assert.deepEqual(await relayReply(board, request().id, 'text', 'dispatch-relay:d-1'), { posted: true })
  assert.deepEqual(sent[0], { idempotency: { epoch: 3, key: 'dispatch-relay:d-1' }, replyTo: request().id, body: { format: 'text/markdown', text: 'text' } })
  assert.deepEqual(await relayReply({ ...board, epoch: async () => null }, request().id, 'text', 'dispatch-relay:d-1'), { refused: 'no-epoch' })
  assert.deepEqual(await relayReply({ ...board, reply: async () => ({ error: { code: 'not_authorized', message: 'm' } }) }, request().id, 'text', 'dispatch-relay:d-1'), { refused: 'not_authorized' })
  assert.deepEqual(await relayReply({ ...board, reply: async () => { throw new Error('down') } }, request().id, 'text', 'dispatch-relay:d-1'), { refused: 'failed' })
})

test('CO-551: each reason a request is the operator\'s becomes the sweep\'s marks', async () => {
  const { toOperatorMarks } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))
  assert.deepEqual(toOperatorMarks('runs'), { pastDue: false })
  assert.deepEqual(toOperatorMarks('past-due'), { pastDue: true })
  assert.deepEqual(toOperatorMarks('relay'), { pastDue: false, remote: 'unposted' })
  assert.deepEqual(toOperatorMarks('remote-lost'), { pastDue: false, remote: 'lost' })
})

// CO-559 (§3.8 of the on-demand sessions spec): every addressee woken and watched. The operator, 2026-11-10: «Если нет
// кодинга агента в проекте, которому идет задача, значит агент поднимается… если он не поднялся, поднимать насильно еще
// раз. И валидация каждые 30 секунд.»
const shared559 = await import(path.resolve(import.meta.dirname, '../src/shared/boardDispatch.ts'))
const { ACCEPT_MS, SILENT_MS, KEEP_OPEN_MS, INBOX_CAPABILITY } = shared559
const inboxItem = (over = {}) => ({ id: '33333333-3333-4333-8333-333333333333', thread: '44444444-4444-4444-8444-444444444444', state: 'queued',
  target: 'p-target', capability: INBOX_CAPABILITY, submittedAt: new Date(T0 - 5 * MIN).toISOString(), deadline: new Date(T0 + 7 * DAY).toISOString(),
  inbox: { unread: 3, oldestAt: new Date(T0 - 60 * MIN).toISOString() }, ...over })

test('CO-559: an unread message to a project with no live session starts an inbox run with its own packet', async () => {
  const w = world({ requests: [inboxItem()] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  assert.equal(w.launches[0].request, inboxItem().id)
  assert.equal(w.launches[0].reason, 'inbox', 'an inbox run asks for the inbox exit contract (SB-338)')
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.match(open.body.goal, /Read every unread board message/)
  // Observatory keeps `board-message:` and `board-thread:` references and redacts a bare UUID (thread 7ae9ac3a).
  assert.ok(open.body.constraints.some((c) => c.includes(`message board-message:${inboxItem().id} in thread board-thread:`)))
  assert.ok(open.body.constraints.some((c) => /com\.read_ack/.test(c)))
  assert.ok(open.body.artifacts.some((a) => a.ref === `board-message:${inboxItem().id}`))
  assert.ok(open.body.artifacts.some((a) => a.ref === `capability:${INBOX_CAPABILITY}`))
  assert.ok(!open.body.artifacts.some((a) => a.ref.startsWith('board-request:')))
  assert.equal(d.records()[0].inbox, true)
  // A live session in the project, or the grace not yet passed, starts nothing.
  for (const over of [{ session: true }, { requests: [inboxItem({ submittedAt: new Date(T0 - MIN).toISOString() })] }]) {
    const v = world({ requests: [inboxItem()], ...over })
    await createBoardDispatch(v.deps).onPass()
    assert.equal(v.launches.length, 0, JSON.stringify(over))
  }
})

test('CO-559: an inbox run ends finished once its message is read; a newer message starts a fresh run with no empty runs carried', async () => {
  const w = world({ requests: [inboxItem()] })
  const read = new Map()
  w.deps.inboxState = async (id) => read.get(id) ?? 'queued'
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended'); read.set(inboxItem().id, 'answered')
  w.tick(3 * MIN); w.requests = []; await d.onPass()
  assert.equal(d.records()[0].outcome, 'finished')
  // A run that ends with its message still unread counts empty; one for another message of the project starts at 0.
  const next = inboxItem({ id: '55555555-5555-4555-8555-555555555555', submittedAt: new Date(T0).toISOString() })
  w.requests = [next]; w.tick(3 * MIN); await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.equal(d.records()[1].emptyRuns, 0)
  w.runs.set('L2', 'ended'); w.tick(3 * MIN); await d.onPass()
  assert.equal(d.records()[1].outcome, 'exited-without-answer')
  assert.equal(d.records()[1].emptyRuns, 1)
  assert.equal(w.launches.length, 3, 'started again for the same message')
})

test('0.3.19 review PL-2: an inbox run starts on this machine even with a dispatch target named; a request still goes there', async () => {
  const w = world({ requests: [inboxItem()], target: 'studio' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  assert.equal(w.launches[0].target, undefined, 'no fabric-mcp there: the inbox could not be read')
  assert.equal(d.records()[0].target, undefined)
  const r = world({ target: 'studio' })
  await createBoardDispatch(r.deps).onPass()
  assert.equal(r.launches[0].target, 'studio')
})

test('0.3.19 review ER-6 and PL-1: a retried inbox open sends the packet it sent first; the packet reads Switchboard\'s request as these messages', async () => {
  const w = world({ requests: [inboxItem()] })
  let fail = true
  const base = w.deps.observatory
  w.deps.observatory = async (name, args) => {
    if (name === 'observatory_checkpoint_write' && !args.workflowId && fail) { fail = false; w.calls.push([name, args]); throw new Error('lost answer') }
    return base(name, args)
  }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.requests = [inboxItem({ inbox: { unread: 9, oldestAt: '2026-11-09T00:00:00.000Z' } })]
  w.tick(10 * MIN); await d.onPass()
  const opens = w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)
  assert.equal(opens.length, 2)
  assert.equal(opens[1][1].idempotencyKey, opens[0][1].idempotencyKey)
  assert.deepEqual(opens[1][1].body, opens[0][1].body, 'the same body under the same key')
  assert.match(JSON.stringify(opens[0][1].body.constraints), /never call com\.claim, com\.accept or com\.complete/)
})

test('CO-559: a project runs one session at a time, a request and its inbox included', async () => {
  const w = world({ requests: [request(), inboxItem()] })
  await createBoardDispatch(w.deps).onPass()
  assert.equal(w.launches.length, 1)
})

test('0.3.19 review, iteration 3 run two, ER-15: the hand-over is judged from Switchboard\'s answer, not from the pass that asked', async () => {
  const w = world()
  const stops = []
  w.deps.stop = async (id) => { stops.push(id); return 'stopped' }
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status: 'offered' } : real(name, args))
  const launch = w.deps.launch
  w.deps.launch = async (args) => { w.tick(4 * MIN); return launch(args) } // the start answers four minutes after the pass began
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.tick(ACCEPT_MS - 2 * MIN); await d.onPass()
  assert.equal(stops.length, 0, 'three minutes after the answer is not ACCEPT_MS, whatever the pass began at')
  w.tick(3 * MIN); await d.onPass()
  assert.deepEqual(stops, ['L1'])
})

test('CO-559: a run whose session never took the hand-over is stopped and started again by force', async () => {
  const w = world()
  const stops = []
  w.deps.stop = async (id) => { stops.push(id); return 'stopped' }
  const real = w.deps.observatory
  let status = 'offered'
  w.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status } : real(name, args))
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.tick(ACCEPT_MS - MIN); await d.onPass()
  assert.equal(stops.length, 0, 'not before ACCEPT_MS')
  w.tick(2 * MIN); await d.onPass()
  assert.deepEqual(stops, ['L1'])
  const r = d.records()[0]
  assert.deepEqual([r.state, r.outcome, r.emptyRuns], ['ended', 'not-taken', 1])
  assert.ok(w.logs.some((l) => l.op === 'board.dispatch.restarted' && l.detail.why === 'not-taken'))
  w.tick(3 * MIN); await d.onPass()
  assert.equal(w.launches.length, 2, 'started again')
  // Observatory freezes the packet's board references at the opening write (OBS-323): every later write leaves them
  // out, or a later run's newer references are refused with PacketFrozen.
  const writes = w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && a.stepId === 'run-ends-at')
  assert.ok(writes.length >= 2)
  assert.ok(writes[0][1].body.artifacts.some((a) => a.ref.startsWith('board-request:')))
  for (const [, a] of writes.slice(1)) {
    assert.deepEqual(a.body.artifacts.map((x) => x.ref.split(':')[0]), ['run-ends-at'], 'only run-ends-at after the opening write')
  }
  // An accepted offer is alive: nothing is stopped.
  status = 'accepted'
  w.tick(ACCEPT_MS + MIN); await d.onPass()
  assert.equal(stops.length, 1)
})

test('CO-559: a run whose workflow stopped writing is stopped as silent; a fresh checkpoint or no evidence stops nothing', async () => {
  for (const [written, expect] of [[T0 - 2 * SILENT_MS, 'silent'], [null, null], ['fresh', null]]) {
    const w = world()
    const stops = []
    w.deps.stop = async (id) => { stops.push(id); return 'stopped' }
    const real = w.deps.observatory
    w.deps.observatory = async (name, args) => {
      if (name === 'observatory_handoff_get') return { status: 'accepted' }
      if (name === 'observatory_checkpoint_latest') return written === null ? {} : { checkpoint: { createdAt: new Date(written === 'fresh' ? w.deps.now() - MIN : written).toISOString() } }
      return real(name, args)
    }
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    w.tick(SILENT_MS + MIN); await d.onPass()
    assert.equal(stops.length, expect ? 1 : 0, String(written))
    if (expect) assert.equal(d.records()[0].outcome, 'silent')
  }
  // Without any read of the offer (a stand-in that names nothing), nothing is stopped either.
  const v = world(); const stops = []
  v.deps.stop = async (id) => { stops.push(id); return 'stopped' }
  const dv = createBoardDispatch(v.deps)
  await dv.onPass(); v.tick(2 * SILENT_MS); await dv.onPass()
  assert.equal(stops.length, 0)
})

test('CO-559: a settled item is never stopped as dead, and a stop Switchboard refuses is asked again', async () => {
  const w = world()
  let answer = 'failed'
  const stops = []
  w.deps.stop = async (id) => { stops.push(id); return answer }
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status: 'offered' } : real(name, args))
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.tick(ACCEPT_MS + MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'running', 'a refused stop leaves it running')
  answer = 'stopped'
  w.tick(MIN); await d.onPass()
  assert.equal(d.records()[0].outcome, 'not-taken')
  const v = world()
  v.deps.stop = async () => { throw new Error('must not stop') }
  v.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status: 'offered' } : w.deps.observatory(name, args))
  const dv = createBoardDispatch(v.deps)
  await dv.onPass()
  v.states.set(request().id, 'completed')
  v.tick(ACCEPT_MS + MIN); await dv.onPass()
  assert.equal(dv.records()[0].state, 'running', 'its own end, not the liveness check, ends it')
})

test('CO-559: the workflow of a run that ended with its item open is closed after KEEP_OPEN_MS, switch on or off, and the next run opens a new one', async () => {
  for (const on of [true, false]) {
    const w = world({ refuse: 'no_agent' })
    const d = createBoardDispatch(w.deps)
    await d.onPass()
    assert.equal(d.records()[0].outcome, 'refused')
    // The item leaves the read (no further run takes the workflow), unsettled.
    w.on = on; w.requests = []
    w.tick(KEEP_OPEN_MS - MIN); await d.onPass()
    assert.ok(!w.calls.some(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true), 'kept for the next run first')
    w.tick(2 * MIN); await d.onPass()
    const close = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true)
    assert.ok(close, `closed (switch ${on ? 'on' : 'off'})`)
    assert.equal(close[1].stepId, 'expired')
    assert.equal(d.records()[0].closed, true)
    if (!on) continue
    w.refuse = null; w.requests = [request()]
    const opensBefore = w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length
    w.tick(REFUSAL_BACKOFF_MAX_MS); await d.onPass()
    assert.equal(w.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).length, opensBefore + 1, 'a new workflow')
  }
})

test('CO-559: a refusal\'s back-off is the project\'s inbox, so a newer message does not start a run sooner', async () => {
  const w = world({ requests: [inboxItem()], refuse: 'no_agent' })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  assert.equal(w.launches.length, 1)
  w.requests = [inboxItem({ id: '55555555-5555-4555-8555-555555555555', submittedAt: new Date(T0 - 3 * MIN).toISOString() })]
  w.tick(MIN); await d.onPass()
  assert.equal(w.launches.length, 1, 'the back-off holds across the project\'s messages')
  w.tick(REFUSAL_BACKOFF_MS); await d.onPass()
  assert.equal(w.launches.length, 2)
})

test('CO-559: the inbox read becomes one item per project, its deadline the newest message plus the board\'s week; a failed read throws', async () => {
  const { readInboxItems } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  const newest = { id: '33333333-3333-4333-8333-333333333333', thread: '44444444-4444-4444-8444-444444444444', at: '2026-11-10T21:42:44.000Z', kind: 'message' }
  let since = null
  const { items } = await readInboxItems({ inbox: async (_e, s) => { since = s; return { ok: true, more: false, projects: [{ project: 'p-x', unread: 2, oldestAt: '2026-11-10T20:00:00.000Z', newest }] } } }, 'e1', T0)
  assert.equal(since, new Date(T0 - 7 * DAY).toISOString())
  assert.deepEqual(items, [{ id: newest.id, thread: newest.thread, state: 'queued', target: 'p-x', capability: INBOX_CAPABILITY, submittedAt: newest.at,
    deadline: new Date(Date.parse(newest.at) + 7 * DAY).toISOString(), inbox: { unread: 2, oldestAt: '2026-11-10T20:00:00.000Z' } }])
  await assert.rejects(readInboxItems({ inbox: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) }, 'e1', T0), /inboxes could not be read/)
})

test('CO-559: an inbox item given to the operator is handed to the sweep with its project, and marked as an inbox', async () => {
  const w = world({ requests: [inboxItem()] })
  const d = createBoardDispatch(w.deps)
  for (const id of ['L1', 'L2', 'L3']) { await d.onPass(); w.runs.set(id, 'ended'); w.tick(3 * MIN) }
  await d.onPass()
  assert.equal(w.launches.length, 3)
  assert.equal(d.toOperator().get(inboxItem().id), 'inbox')
  assert.deepEqual(d.inboxGiven().map((g) => [g.messageId, g.projectId]), [[inboxItem().id, 'p-target']])
  assert.match(d.inboxGiven()[0].at, /Z$/)
})

test('CO-559 review: the liveness checks count from the launch, not the record, and a live attempt is alive', async () => {
  const w = world()
  const stops = []
  w.deps.stop = async (id) => { stops.push(id); return 'stopped' }
  const real = w.deps.observatory
  w.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status: 'offered' } : real(name, args))
  let launches = 0
  w.deps.launch = async (args) => { w.launches.push(args); launches++; return launches < 3 ? { refused: 'failed' } : { launchId: 'L1' } }
  const d = createBoardDispatch(w.deps)
  await d.onPass(); w.tick(3 * MIN); await d.onPass(); w.tick(3 * MIN); await d.onPass()
  assert.equal(d.records()[0].state, 'running')
  w.tick(MIN); await d.onPass()
  assert.equal(stops.length, 0, 'six minutes after the record, one after the launch')
  w.tick(ACCEPT_MS); await d.onPass()
  assert.equal(stops.length, 1)
  // A request whose attempt holds its lease is never taken as dead.
  const v = world({ requests: [request({ state: 'accepted', attemptLive: true })] })
  const vstops = []
  v.deps.stop = async (id) => { vstops.push(id); return 'stopped' }
  v.deps.observatory = async (name, args) => (name === 'observatory_handoff_get' ? { status: 'offered' } : real(name, args))
  v.deps.load = () => [{ requestId: request().id, projectId: 'p-target', dispatchId: 'd', workflowId: 'wf_0123456789abcdef', handoffId: 'handoff:1', launchId: 'L9', startedAt: T0 - 30 * MIN, launchedAt: T0 - 30 * MIN, endsAt: new Date(T0 + 30 * MIN).toISOString(), state: 'running', emptyRuns: 0 }]
  const dv = createBoardDispatch(v.deps)
  await dv.onPass()
  assert.deepEqual(vstops, [])
  assert.equal(dv.records()[0].state, 'running')
})

test('CO-559 review: an inbox run that takes over the project\'s workflow is the only one that closes it', async () => {
  const w = world({ requests: [inboxItem()] })
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.runs.set('L1', 'ended'); w.tick(3 * MIN)
  w.requests = [inboxItem({ id: '55555555-5555-4555-8555-555555555555', submittedAt: new Date(T0 - 3 * MIN).toISOString() })]
  await d.onPass()
  assert.equal(w.launches.length, 2)
  assert.equal(d.records()[0].closed, true, 'the older record no longer closes the shared workflow')
  w.tick(KEEP_OPEN_MS + MIN); await d.onPass()
  assert.ok(!w.calls.some(([n, a]) => n === 'observatory_checkpoint_write' && a.close === true), 'nothing closed under the running run')
})

test('CO-559 review: a trickle of messages cannot start runs for ever, and the operator sees one row per project', async () => {
  const w = world()
  const d = createBoardDispatch(w.deps)
  const ids = ['55555555-5555-4555-8555-55555555555', '66666666-6666-4666-8666-66666666666', '77777777-7777-4777-8777-77777777777', '88888888-8888-4888-8888-88888888888']
  for (const [i, prefix] of ids.entries()) {
    w.requests = [inboxItem({ id: `${prefix}${i}`, submittedAt: new Date(w.deps.now() - 3 * MIN).toISOString() })]
    await d.onPass()
    w.runs.set(`L${i + 1}`, 'ended'); w.tick(3 * MIN)
  }
  await d.onPass()
  assert.equal(w.launches.length, 3, 'three empty runs across messages, then the operator')
  assert.equal(d.inboxGiven().length, 1, 'one row for the project')
  assert.equal(d.inboxGiven()[0].messageId, w.requests[0].id)
  // A newer message gets one more run, then is given too: still one row.
  w.requests = [inboxItem({ id: '99999999-9999-4999-8999-999999999999', submittedAt: new Date(w.deps.now() - 3 * MIN).toISOString() })]
  await d.onPass()
  assert.equal(w.launches.length, 4)
  w.runs.set('L4', 'ended'); w.tick(3 * MIN); await d.onPass(); w.tick(MIN); await d.onPass()
  assert.equal(w.launches.length, 4)
  assert.deepEqual(d.inboxGiven().map((g) => g.messageId), [w.requests[0].id])
  // A message read since leaves «На проверке».
  w.requests = []; await d.onPass()
  assert.equal(d.inboxGiven().length, 0)
})

test('CO-559 review: a start the switch ended is not asked again once its workflow was closed', async () => {
  const w = world()
  w.deps.launch = async (args) => { w.launches.push(args); return { refused: 'failed' } }
  const d = createBoardDispatch(w.deps)
  await d.onPass()
  w.on = false; w.tick(MIN); await d.onPass()
  w.tick(KEEP_OPEN_MS + MIN); await d.onPass()
  assert.equal(d.records()[0].closed, true)
  w.on = true; w.deps.launch = async (args) => { w.launches.push(args); return { launchId: 'L2' } }
  w.tick(MIN); await d.onPass()
  const started = d.records().filter((r) => r.launchId)
  assert.ok(started.every((r) => r.workflowId && !(r.closed && r.state !== 'ended')), 'no run on a closed workflow')
  assert.notEqual(d.records()[0].state, 'starting')
})

test('CO-559 review: an inbox message is answered once its project has nothing left unread, else by its read marks; an inbox not read says nothing', async () => {
  const { createInboxState } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  let reads = 0
  const s = createInboxState(async (ids) => { reads++; return { ok: true, requests: {}, messages: { [ids[0]]: { readBy: ids[0] === 'm-read' ? ['p1', 'p2'] : [] } } } })
  assert.equal(await s.state('m1', 'p1'), null, 'before any read')
  s.reset(null)
  assert.equal(await s.state('m1', 'p1'), null, 'the inbox read failed this pass')
  s.reset([inboxItem({ target: 'p1' })])
  assert.equal(await s.state('m1', 'p2'), 'answered', 'p2 has nothing unread')
  assert.equal(await s.state('m1', 'p1'), 'queued')
  assert.equal(await s.state('m-read', 'p1'), 'answered')
  await s.state('m1', 'p1')
  assert.equal(reads, 2, 'each message\'s marks are read once a pass')
  s.reset([inboxItem({ target: 'p1' })], true)
  assert.equal(await s.state('m1', 'p2'), 'queued', '0.3.19 review PL-10: a read cut at its bound never answers a project it left out')
  assert.equal(await s.state('m-read', 'p2'), 'answered', 'iteration 2, DA-7: its message is judged by its read marks')
})

test('2026-11-11: a request run goes to the machine of its repository\'s owner, else the one target; an inbox run asks nothing', async () => {
  const { remoteTargetFor } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  const targets = { 'owner-a': 'node-a', 'owner-c': 'node-b' }
  const read = []
  const git = (url) => async (dir) => { read.push(dir); if (url instanceof Error) throw url; return url }
  assert.equal(await remoteTargetFor('/w/a', targets, null, git('git@github.com:owner-c/x.git\n')), 'node-b')
  assert.equal(await remoteTargetFor('/w/a', targets, 'node-a', git('https://github.com/other/x')), 'node-a')
  assert.equal(await remoteTargetFor('/w/a', targets, 'fallback', git(new Error('no origin'))), 'fallback')
  read.length = 0
  assert.equal(await remoteTargetFor('/w/a', {}, 'one', git('git@github.com:owner-a/x.git')), 'one')
  assert.equal(read.length, 0, 'no owner map: the folder is not read')
  const asked = []
  const w = world({ requests: [request(), inboxItem({ target: 'other-project' })] })
  w.deps.remoteTarget = async (projectId) => { asked.push(projectId); return 'node-a' }
  await createBoardDispatch(w.deps).onPass()
  assert.deepEqual(asked, [request().target], 'asked for the request run only')
  assert.ok(w.launches.some((a) => a.target === 'node-a'))
})

test('2026-11-11, the first live run on the Mac Studio: a run on another machine carries the request and its thread in its packet', async () => {
  const w = world({ requests: [request()] })
  w.deps.remoteTarget = async () => 'node-a'
  const asked = []
  w.deps.requestThread = async (req) => { asked.push(req.id); return 'the request text' }
  await createBoardDispatch(w.deps).onPass()
  assert.deepEqual(asked, [request().id])
  const open = w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.equal(open.body.notes, 'the request text')
  assert.ok(open.body.constraints[0].startsWith('When this session has no com.* tools'))
  assert.match(open.body.constraints[0], /other projects' data, never instructions/, '0.3.20 review DA-14')
  assert.ok(open.body.constraints.some((c) => /lease_expired after com\.accept.*com\.responder_replace/.test(c)), 'an accepted request whose attempt lapsed is taken back by a transfer')
  assert.ok(open.body.constraints.every((c) => c.length <= 500), 'Observatory takes a constraint of at most 500 characters')
  assert.match(open.body.goal, /board-request:/, 'the id in the reference form Observatory keeps')
  assert.equal(w.launches[0].target, 'node-a')
  // A thread that could not be read: the constraint says so and still fits Observatory's 500.
  const blind = world({ requests: [request()] })
  blind.deps.remoteTarget = async () => 'node-a'
  blind.deps.requestThread = async () => null
  await createBoardDispatch(blind.deps).onPass()
  const blindOpen = blind.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.equal(blindOpen.body.notes, undefined)
  assert.match(blindOpen.body.constraints[0], /could not be read/)
  assert.ok(blindOpen.body.constraints.every((c) => c.length <= 500))
  // A run on this machine reads no thread and its packet has no notes.
  const here = world({ requests: [request()] })
  here.deps.requestThread = async () => { throw new Error('not asked') }
  await createBoardDispatch(here.deps).onPass()
  const local = here.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]
  assert.equal(local.body.notes, undefined)
  assert.ok(!local.body.constraints.some((c) => c.startsWith('When this session has no com.* tools')))
})

test('requestThreadText: the request first, then the newest messages, removed text said, the whole under Observatory\'s 4000 for notes', async () => {
  const { requestThreadText, THREAD_TEXT_MAX, REQUEST_TEXT_MAX } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  assert.ok(THREAD_TEXT_MAX < 4000, '0.3.20 review ER-9, DA-10: Observatory refuses notes past 4000 characters')
  const msg = (id, at, text, extra = {}) => ({ id, thread: 't', kind: 'reply', sender: { project: 'p', principal: null }, at, digest: 'd', body: { text }, ...extra })
  const one = (messages) => ({ list: async () => ({ ok: true, messages, lastSeq: messages.length, more: false }) })
  const messages = [msg('r', '1', 'ask', { kind: 'request' }), msg('a', '2', 'older'), msg('b', '3', 'newer'), msg('c', '4', 'x', { body: undefined, redacted: true })]
  const text = await requestThreadText(one(messages), 'e', { id: 'r', thread: 't' })
  assert.ok(text.includes('[1] request (the request) from fabric-project:p:\nask'), 'the project in the reference form Observatory keeps')
  assert.ok(text.indexOf('ask') < text.indexOf('(its text was removed)'))
  assert.ok(text.indexOf('(its text was removed)') < text.indexOf('newer') && text.indexOf('newer') < text.indexOf('older'))
  assert.ok(!text.includes('  '), 'no double space')
  assert.equal(await requestThreadText({ list: async () => ({ ok: false }) }, 'e', { id: 'r', thread: 't' }), null)
  // A request longer than its share is cut and says so; the newest messages still fit beside it.
  const long = await requestThreadText(one([msg('r', '1', 'z'.repeat(THREAD_TEXT_MAX * 2), { kind: 'request' }), msg('n', '2', 'the newest')]), 'e', { id: 'r', thread: 't' })
  assert.ok(long.length <= THREAD_TEXT_MAX)
  assert.ok(long.includes('z'.repeat(REQUEST_TEXT_MAX)) && long.includes('(cut: the request is longer)') && long.includes('the newest'))
  // Messages that do not fit are counted, never silently dropped.
  const many = await requestThreadText(one([msg('r', '1', 'ask', { kind: 'request' }), ...Array.from({ length: 40 }, (_, i) => msg(`m${i}`, String(i + 2), 'y'.repeat(200)))]), 'e', { id: 'r', thread: 't' })
  assert.ok(many.length <= THREAD_TEXT_MAX)
  assert.match(many, /\(\d+ older messages left out\)$/)
  // 0.3.20 review ER-13, DA-13: a thread longer than one page is read on, so a request past the first 100 is found.
  const pages = [[msg('o', '1', 'first page')], [msg('r', '2', 'the late request', { kind: 'request' })]]
  const after = []
  const paged = await requestThreadText({ list: async (_e, _t, afterSeq) => { after.push(afterSeq); const i = after.length - 1; return { ok: true, messages: pages[i], lastSeq: i + 1, more: i === 0 } } }, 'e', { id: 'r', thread: 't' })
  assert.deepEqual(after, [0, 1])
  assert.ok(paged.includes('the late request') && paged.includes('first page'))
})

test('0.3.20 review ER-10, DA-11: an open on another machine whose answer was lost is asked again with the same packet, the thread not read twice', async () => {
  const v = world({ requests: [request()] })
  v.deps.remoteTarget = async () => 'node-a'
  let reads = 0
  v.deps.requestThread = async () => `thread read ${++reads}`
  let lose = true
  const vbase = v.deps.observatory
  v.deps.observatory = async (name, args) => {
    const answer = await vbase(name, args)
    if (name === 'observatory_checkpoint_write' && !args.workflowId && lose) { lose = false; throw new Error('the connection dropped') }
    return answer
  }
  const e = createBoardDispatch(v.deps)
  await e.onPass()
  v.tick(REFUSAL_BACKOFF_MS); await e.onPass()
  assert.equal(reads, 1, 'the thread is read once')
  const bodies = v.calls.filter(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId).map(([, a]) => a.body)
  assert.equal(bodies.length, 2)
  assert.deepEqual(bodies[0], bodies[1])
  assert.equal(v.launches.length, 1)
  assert.equal(v.launches[0].target, 'node-a')
})

// 2026-11-11: the session a running dispatched run works in, from `sessions show`, and the runs the home reads.
test('launchSessionOf reads the coding agent\'s own session id of a running launch, nothing else', async () => {
  const { launchSessionOf, boardRunsOf } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchWiring.ts'))
  assert.equal(launchSessionOf({ state: 'running', provider_session_id: 'rt-1' }), 'rt-1')
  assert.equal(launchSessionOf({ state: 'starting', provider_session_id: 'rt-1' }), 'rt-1')
  assert.equal(launchSessionOf({ state: 'ended', provider_session_id: 'rt-1' }), null)
  assert.equal(launchSessionOf({ state: 'running', provider_session_id: '' }), null)
  assert.equal(launchSessionOf({ state: 'running' }), null)
  assert.equal(launchSessionOf(undefined), null)
  const records = [
    { requestId: 'r1', projectId: 'p', launchId: 'L1', state: 'running', startedAt: 1000, launchedAt: 2000 },
    { requestId: 'r2', projectId: 'p', launchId: 'L2', state: 'running', startedAt: 3000, inbox: true },
    { requestId: 'r3', projectId: 'p', launchId: 'L3', state: 'ended', startedAt: 3000 },
    { requestId: 'r4', projectId: 'p', launchId: 'L4', state: 'running', startedAt: 3000 },
    { requestId: 'r5', projectId: 'p', launchId: 'L5', state: 'running', startedAt: 3000, target: 'studio' }
  ]
  const seen = new Map([['L1', { runtimeSessionId: 'rt-1', at: 9000 }], ['L2', { runtimeSessionId: 'rt-2', at: 9000 }], ['L3', { runtimeSessionId: 'rt-3', at: 9000 }], ['L5', { runtimeSessionId: 'rt-5', at: 9000 }]])
  assert.deepEqual(boardRunsOf(records, seen), [
    { runtimeSessionId: 'rt-1', requestId: 'r1', inbox: false, since: new Date(2000).toISOString(), seenAt: new Date(9000).toISOString() },
    { runtimeSessionId: 'rt-2', requestId: 'r2', inbox: true, since: new Date(3000).toISOString(), seenAt: new Date(9000).toISOString() }
  ])
})
