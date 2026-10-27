// 0.3.13 wave 2, CO-427: the sweep of abandoned work wired into the main process (SW-1, SW-2, SW-4, SW-5, SW-7 interim,
// SW-8). Spec: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md. No database: every read, the terminal
// write, the release and the ops log are stand-ins with the shapes index.ts gives them.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createAbandonedSweep, readBoardRequests, LAPSED_REASON } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
const { registerWorkTools } = await import(path.resolve(import.meta.dirname, '../src/main/workTools.ts'))
const { prepareEventPayload } = await import(path.resolve(import.meta.dirname, '../src/shared/commandIngress.ts'))

const MIN = 60_000
const T0 = Date.parse('2026-10-26T12:00:00Z')
const iso = (ms) => new Date(ms).toISOString()

/** A world the sweep reads: claims, running tasks, requests, terminals; the writes it makes are counted. */
function world(over = {}) {
  let now = T0
  const w = {
    claims: [], held: [], heldSessions: [], tasks: [], requests: [], terminals: [], turns: [], running: new Set(), activity: new Map(),
    claimsCapped: false, requestsCapped: [], unresolved: [], quit: false, started: T0 - 60 * MIN, reads: 0,
    delivered: [], refused: [], released: [], failed: [], records: [], receipts: [], receiptFails: false, fail: new Set(),
    tick(ms) { now += ms },
    deps: null
  }
  Object.assign(w, over)
  const read = (name, value) => async () => { if (w.fail.has(name)) throw new Error(`${name} refused`); return value() }
  w.deps = {
    now: () => now,
    readClaims: read('claims', () => { w.reads++; return { claims: w.claims, heldTaskIds: w.held, heldSessionIds: w.heldSessions, ...(w.claimsCapped ? { capped: true } : {}) } }),
    readTurns: read('turns', () => ({ turns: w.turns, capped: w.turnsCapped === true })),
    readRunningTasks: read('tasks', () => w.tasks),
    readRequests: read('requests', () => ({ requests: w.requests, capped: w.requestsCapped })),
    terminals: () => {
      if (w.fail.has('terminals')) throw new Error('terminals refused')
      return w.terminals.map((t) => ({ lastActivityAt: w.activity.get(t.sessionId) ?? now - 20 * MIN, ...t }))
    },
    terminalRunning: (id) => w.running.has(id),
    terminalActivity: (id) => w.activity.get(id) ?? null,
    deliver: async (sessionId, text, options) => {
      if (options?.beforeWrite && !(await options.beforeWrite())) { w.refused.push({ sessionId, text }); return { state: 'failed_before_write', reason: 'write_gate_refused' } }
      w.delivered.push({ sessionId, text })
      return { state: 'written' }
    },
    releaseLapsed: async (claimId, reason) => { w.released.push({ claimId, reason }); return { released: true } },
    unresolvedRuns: async (taskIds) => taskIds.filter((id) => w.unresolved.includes(id)),
    recordSwept: async (receipt) => { if (w.receiptFails) throw new Error('journal refused'); w.receipts.push(receipt) },
    quitting: () => w.quit,
    processStartedAt: w.started,
    ops: {
      failed: (op, e, detail) => { w.failed.push({ op, message: e instanceof Error ? e.message : String(e), detail }) },
      record: (r) => { w.records.push(r) },
      correlate: () => 'test'
    }
  }
  return w
}

/** Three passes: the third sweeps (SW-1). */
async function sweepOnce(sweep) {
  let out = null
  for (let i = 0; i < 3; i++) out = await sweep.onPass()
  return out
}

const silentClaim = (id, sessionId, at = T0 - 20 * MIN) => ({
  claimId: id, taskId: `task-${id}`, projectId: 'p1', sessionId, claimedAt: iso(at), renewedAt: null,
  expiresAt: iso(at + 5 * MIN), session: { lastSignAt: at }
})
/** A Fabric terminal stalled on a running task, quiet for 20 minutes: the one finding written into a terminal (R3). */
const stalledWorld = (over = {}) => {
  const w = world({
    tasks: [{ taskId: 't-run', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) }], held: ['t-run'], running: new Set(['s-term']),
    terminals: [{ sessionId: 's-term', projectId: 'p1', taskId: 't-run', liveness: 'stalled', since: iso(T0 - 20 * MIN) }], ...over
  })
  w.activity.set('s-term', T0 - 20 * MIN)
  return w
}
const lapsedClaim = (id) => ({
  claimId: id, taskId: `task-${id}`, projectId: 'p1', sessionId: `gone-${id}`, claimedAt: iso(T0 - 20 * MIN), renewedAt: null,
  expiresAt: iso(T0 + 10 * MIN), session: null
})

test('(a) passes 1 and 2 sweep nothing; pass 3 sweeps', async () => {
  const w = stalledWorld()
  const sweep = createAbandonedSweep(w.deps)
  assert.equal(await sweep.onPass(), null, 'pass 1 does not sweep')
  assert.equal(await sweep.onPass(), null, 'pass 2 does not sweep')
  assert.equal(w.delivered.length, 0)
  const third = await sweep.onPass()
  assert.ok(third, 'pass 3 sweeps')
  assert.deepEqual(third.findings.map((f) => f.kind), ['terminal-stalled'])
  await new Promise((r) => setImmediate(r))
  assert.equal(sweep.takeNudges('s-term', 'p1').length, 1)
})

test('ER-2: a stalled Fabric terminal is never typed into; its finding waits as a nudge, told once in 30 minutes', async () => {
  // 0.3.13 review, iteration 1, ER-2: the line ended in Enter, and a terminal quiet on a running task may be a coding
  // agent waiting on a permission prompt, where Enter approves.
  const w = stalledWorld()
  w.activity.set('s-term', T0 - 20 * MIN)
  const sweep = createAbandonedSweep(w.deps)
  const settle = () => new Promise((r) => setImmediate(r))
  await sweepOnce(sweep); await settle()
  assert.equal(w.delivered.length + w.refused.length, 0, 'nothing reached the terminal')
  const lines = sweep.takeNudges('s-term', 'p1')
  assert.equal(lines.length, 1)
  assert.match(lines[0], /^Fabric: task t-run in this session has been still for 20 min\./)
  for (let i = 0; i < 9; i++) { w.tick(3 * MIN); await sweepOnce(sweep); await settle() }
  assert.deepEqual(sweep.takeNudges('s-term', 'p1'), [], 'nine more sweeps inside 30 minutes tell nothing again')
  w.tick(30 * MIN)
  await sweepOnce(sweep); await settle()
  assert.equal(sweep.takeNudges('s-term', 'p1').length, 1, 'past the quiet period it is told again')
  assert.equal(w.delivered.length, 0)
})

test('(c) a finding for an enrolled session lands in its nudges, and taking them clears them', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(w.delivered.length, 0, 'an enrolled session has no terminal to write into')
  const first = sweep.takeNudges('s-enrolled', 'p1')
  assert.equal(first.length, 1)
  assert.match(first[0], /task task-c1 you claimed/)
  assert.deepEqual(sweep.takeNudges('s-enrolled', 'p1'), [], 'taken once, gone')
  assert.deepEqual(sweep.takeNudges('s-other', 'p1'), [], 'another session never gets a session nudge')
})

test('(c) a project-level finding reaches every session of the project once each', async () => {
  const w = world({ tasks: [{ taskId: 't9', projectId: 'p1', movedAt: iso(T0 - 10 * MIN) }] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const a = sweep.takeNudges('s-a', 'p1')
  assert.equal(a.length, 1)
  assert.match(a[0], /task t9 has been still for 10 min/)
  assert.deepEqual(sweep.takeNudges('s-a', 'p1'), [], 'the same session is told once')
  assert.equal(sweep.takeNudges('s-b', 'p1').length, 1, 'another session of the project is told too')
  assert.deepEqual(sweep.takeNudges('s-c', 'p2'), [], 'another project hears nothing')
})

test('task-unclaimed: a task held by a claim, a lease or a Fabric terminal is not unclaimed', async () => {
  const w = world({
    claims: [lapsedClaim('c1')], held: ['t-held'],
    tasks: [
      { taskId: 'task-c1', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) },
      { taskId: 't-held', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) },
      { taskId: 't-term', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) },
      { taskId: 't-free', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) }
    ],
    terminals: [{ sessionId: 's-t', projectId: 'p1', taskId: 't-term', liveness: 'working', since: iso(T0) }]
  })
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.findings.filter((f) => f.kind === 'task-unclaimed').map((f) => f.taskId), ['t-free'])
})

test('(d) a lapsed claim is released only on the second sweep that finds it', async () => {
  const w = world({ claims: [lapsedClaim('c1')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0, 'the first sight releases nothing')
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(w.released, [{ claimId: 'c1', reason: LAPSED_REASON }])
  assert.match(LAPSED_REASON, /^lapsed: its session ended and two sweeps found it/)
})

test('(d) a lapsed claim gone between two sweeps is not released', async () => {
  const w = world({ claims: [lapsedClaim('c1')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.claims = []
  await sweepOnce(sweep)
  w.claims = [lapsedClaim('c1')]
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0, 'not in a row: nothing released')
})

test('(e) a failing read does not throw out of the sweep, is reported, and keeps the rest', async () => {
  const w = world({ requests: [{ requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'queued', movedAt: iso(T0 - 5 * MIN), answerUnreadSince: null }] })
  w.fail.add('claims')
  w.fail.add('terminals')
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.failedReads.sort(), ['claims', 'terminals'])
  assert.deepEqual(out.findings.map((f) => f.kind), ['request-unmoved'], 'the requests were still swept')
  assert.ok(w.failed.some((f) => f.op === 'work.sweep-read' && f.detail?.read === 'claims'))
  assert.ok(w.failed.some((f) => f.op === 'work.sweep-read' && f.detail?.read === 'terminals'))
})

test('(e) a failed claims read neither calls running tasks unclaimed nor forgets what was told', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')], tasks: [{ taskId: 'task-c1', projectId: 'p1', movedAt: iso(T0 - 30 * MIN) }] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.takeNudges('s-enrolled', 'p1').length, 1)
  w.fail.add('claims')
  const blind = await sweepOnce(sweep)
  assert.deepEqual(blind.findings, [], 'with the claims unread, no running task is called unclaimed')
  w.fail.delete('claims')
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-enrolled', 'p1'), [], 'the unread sweep did not make Fabric forget it had told')
})

test('(f) SW-7: an idle sweep writes no receipt; a sweep that found something appends one work.swept@1', async () => {
  const w = world()
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(w.receipts, [], 'idle: nothing written')
  assert.deepEqual(w.records, [], 'and no ops line either')
  w.claims = [lapsedClaim('c1')]
  await sweepOnce(sweep)
  assert.equal(w.receipts.length, 1)
  assert.deepEqual(w.receipts[0].found, { 'claim-lapsed': 1 })
  assert.equal('capped' in w.receipts[0], false, 'nothing capped, no field')
  assert.equal(w.receipts[0].told, 1)
  assert.equal(w.receipts[0].released, 0)
  assert.equal('delivered' in w.receipts[0], false, 'nothing is ever typed into a terminal (ER-2)')
  assert.equal(w.receipts[0].queued, 1)
  assert.deepEqual(w.records, [], 'the journal holds the receipt, not the ops log')
  // DA-1: the app's journal takes it only through the ingress rules; a refused shape never reaches it.
  assert.equal(prepareEventPayload('work.swept@1', w.receipts[0]).state, 'prepared')
  assert.equal(prepareEventPayload('work.swept@1', { ...w.receipts[0], title: 'x' }).state, 'rejected')
})

test('DA-2: a sweep that finds only what it has already told writes no receipt', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(w.receipts.length, 1, 'the first telling is recorded')
  for (let i = 0; i < 5; i++) { w.tick(3 * MIN); await sweepOnce(sweep) }
  assert.equal(w.receipts.length, 1, 'the same stuck item does not write a receipt every three minutes')
})

test('ER-5: a sweep that runs into a quit writes no receipt', async () => {
  const w = world({ claims: [lapsedClaim('c1')] })
  const read = w.deps.readRequests
  w.deps.readRequests = async (now) => { const r = await read(now); w.quit = true; return r }
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(w.receipts, [])
})

test('(f) SW-7: a receipt the journal refused is said in the ops log, and the sweep still answers', async () => {
  const w = world({ claims: [lapsedClaim('c1')], receiptFails: true })
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.equal(out.findings.length, 1)
  assert.equal(w.failed.filter((f) => f.op === 'work.sweep-receipt').length, 1)
})

// ── SW-2's board reading, through the operator's read door (commsOperatorRead's shapes) ───────────────────────
test('readBoardRequests: open requests by their last move, answered ones by whether the requester read the answer', async () => {
  const now = T0
  const requester = '11111111-1111-4111-8111-111111111111'
  const target = '22222222-2222-4222-8222-222222222222'
  const msg = (id, kind, sender, at, extra = {}) => ({ id, thread: 'th1', kind, sender: { project: sender, principal: null }, at: iso(at), digest: 'x', ...extra })
  const messages = [
    msg('req-open', 'request', requester, now - 20 * MIN, { request: { id: 'req-open', target, capability: 'c', state: 'queued', effect: 'not_started', revision: 1 } }),
    msg('req-ans', 'request', requester, now - 30 * MIN, { request: { id: 'req-ans', target, capability: 'c', state: 'answered', effect: 'not_started', revision: 2 } }),
    msg('reply-1', 'reply', target, now - 10 * MIN, { replyTo: 'req-ans' }),
    msg('req-read', 'request', requester, now - 30 * MIN, { request: { id: 'req-read', target, capability: 'c', state: 'answered', effect: 'not_started', revision: 2 } }),
    msg('reply-2', 'reply', target, now - 9 * MIN, { replyTo: 'req-read' })
  ]
  const asked = []
  const comms = {
    threadPage: async (estate, filter) => { asked.push(filter); return { ok: true, threads: [{ id: 'th1' }], more: false, before: null } },
    list: async () => ({ ok: true, messages, lastSeq: 5, more: false }),
    facts: async (estate, ids) => ({
      ok: true,
      messages: Object.fromEntries(ids.map((id) => [id, { readBy: id === 'reply-2' ? [requester] : [] }])),
      requests: { 'req-open': { attemptLive: false, outcomes: [], lastAt: iso(now - 4 * MIN) } }
    })
  }
  const read = await readBoardRequests(comms, 'estate', now)
  assert.deepEqual(read.capped, [], 'every read ended before its cap')
  const rows = read.requests
  assert.equal(asked[0].kind, 'request')
  assert.ok(asked[0].activeSince, 'a bounded window of threads')
  const by = Object.fromEntries(rows.map((r) => [r.requestId, r]))
  assert.equal(by['req-open'].movedAt, iso(now - 4 * MIN), 'an open request moved when it last changed state')
  assert.equal(by['req-open'].targetProjectId, target)
  assert.equal(by['req-open'].requesterProjectId, requester)
  assert.equal(by['req-ans'].answerUnreadSince, iso(now - 10 * MIN), 'an answer the requester has not read, since it came')
  assert.equal(by['req-read'].answerUnreadSince, null, 'an answer the requester read')
})

test('readBoardRequests: a door that answers unavailable throws, never an empty reading', async () => {
  const comms = { threadPage: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) }
  await assert.rejects(readBoardRequests(comms, 'estate', T0), /down/)
})

// ── SW-4: fabric_work_list carries this session's nudges ──────────────────────────────────────────────────────
/** A query builder that answers every chain with no rows. */
function emptyStore() {
  const q = new Proxy({}, {
    get: (_, k) => (k === 'then' ? (resolve) => resolve({ data: [], error: null }) : k === 'maybeSingle' ? async () => ({ data: null, error: null }) : () => q)
  })
  return { select: () => q, selectIn: async () => ({ rows: [], failed: null }) }
}

async function workList(nudges) {
  const tools = new Map()
  const server = { registerTool: (name, _def, handler) => tools.set(name, handler) }
  registerWorkTools(server, {
    scope: { estateId: 'e', projectId: 'p1', sessionId: 's1', agent: 'claude-code', cameIn: 'enrolled' },
    store: emptyStore(), append: async () => ({ seq: 1 }), appendObserved: async () => ({ seq: 1 }), checkReference: () => {},
    sessions: () => [], session: () => null, resolveSource: async () => ({ ok: false }), leaseRefs: async () => null,
    onClaimed: () => {}, endSession: () => {}, now: () => T0, ...(nudges ? { nudges } : {})
  })
  const r = await tools.get('fabric_work_list')({})
  return JSON.parse(r.content[0].text)
}

test('fabric_work_list carries the session\'s nudges when there are any, and no field when there are none', async () => {
  let taken = 0
  const answer = await workList(() => { taken++; return ['Fabric: task t1 has been still for 5 min. Claim it.'] })
  assert.deepEqual(answer.nudges, ['Fabric: task t1 has been still for 5 min. Claim it.'])
  assert.equal(taken, 1)
  assert.equal('nudges' in (await workList(() => [])), false)
  assert.equal('nudges' in (await workList(null)), false)
})

// ── SW-8: the release itself, as lapsed, and the task back to backlog ──────────────────────────────────────────
const { releaseLapsedClaim } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))

/** work_claims, leases, project_tasks and the journal's task moves, as the projector would leave them after each append. */
function releaseWorld({ claimMovedTask = true, otherClaim = false, otherLease = false } = {}) {
  const claim = { id: 'c1', work_id: 't1', project_id: 'p1', owner_session: 's-gone', released_at: null }
  const claims = [claim, ...(otherClaim ? [{ id: 'c2', work_id: 't1', project_id: 'p1', owner_session: 's-live', released_at: null }] : [])]
  const leases = otherLease ? [{ work_id: 't1', owner_session: 's-launch', expires_at: '2099-01-01T00:00:00Z' }] : []
  const task = { id: 't1', status: 'running' }
  const moves = claimMovedTask ? [{ payload: { task_id: 't1', to: 'running', claim_id: 'c1' } }] : []
  const appended = []
  const one = (rows) => {
    let filters = []
    const q = {
      eq: (k, v) => { filters.push((r) => r[k] === undefined || r[k] === v); return q },
      is: (k, v) => { filters.push((r) => (r[k] ?? null) === v); return q },
      order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: rows().filter((r) => filters.every((f) => f(r)))[0] ?? null, error: null }),
      then: (res) => res({ data: rows().filter((r) => filters.every((f) => f(r))), error: null })
    }
    return q
  }
  const store = {
    select: (table) => one(() => (table === 'work_claims' ? claims : table === 'leases' ? leases : table === 'project_tasks' ? [task] : [...moves].reverse()))
  }
  const append = async (e) => {
    appended.push(e)
    if (e.type === 'work.released@1') claim.released_at = '2026-10-26T12:00:00Z'
    if (e.type === 'task.moved@1') { task.status = e.payload.to; moves.push({ payload: e.payload }) }
    return { seq: appended.length }
  }
  return { store, append, appended, task }
}

test('releaseLapsedClaim: released as lapsed with the reason, and the task its claim moved goes back to backlog', async () => {
  const w = releaseWorld()
  const r = await releaseLapsedClaim(w.store, w.append, 'c1', LAPSED_REASON)
  assert.deepEqual(r, { released: true, task_moved_to: 'backlog' })
  const rel = w.appended.find((e) => e.type === 'work.released@1')
  assert.deepEqual(rel.payload, { work: 't1', owner: 's-gone', outcome: 'expired', how: 'lapsed', claim_id: 'c1', note: LAPSED_REASON })
  assert.deepEqual(rel.actor, { kind: 'system', id: 'work-sweep' })
  assert.equal(w.task.status, 'backlog')
})

// 0.3.14 wave 2 (task f0ca028a): before, a task another hand moved to running stayed there with nobody on it.
test('releaseLapsedClaim: a running task nobody else holds goes back to backlog whoever moved it, and the move says why', async () => {
  const w = releaseWorld({ claimMovedTask: false })
  const r = await releaseLapsedClaim(w.store, w.append, 'c1', LAPSED_REASON)
  assert.equal(r.released, true)
  assert.equal(r.task_moved_to, 'backlog')
  assert.equal(w.task.status, 'backlog')
  const move = w.appended.find((e) => e.type === 'task.moved@1')
  assert.match(move.payload.note, /^the claim on this task ended \(lapsed\) and nothing else holds it, so it goes back to the backlog: lapsed/)
})

test('releaseLapsedClaim: a task another live claim or another session\'s live lease holds stays in running', async () => {
  for (const over of [{ otherClaim: true }, { otherLease: true }]) {
    const w = releaseWorld(over)
    const r = await releaseLapsedClaim(w.store, w.append, 'c1', LAPSED_REASON)
    assert.equal(r.released, true)
    assert.equal(r.task_moved_to, null, JSON.stringify(over))
    assert.equal(w.task.status, 'running')
  }
})

test('releaseByOperator: the task the released claim leaves with nobody on it goes back to backlog', async () => {
  const { releaseByOperator } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))
  const w = releaseWorld({ claimMovedTask: false })
  const r = await releaseByOperator(w.store, w.append, { kind: 'person', id: 'operator' }, 'c1')
  assert.equal(r.released, true)
  assert.equal(w.task.status, 'backlog')
  const held = releaseWorld({ otherClaim: true })
  await releaseByOperator(held.store, held.append, { kind: 'person', id: 'operator' }, 'c1')
  assert.equal(held.task.status, 'running')
})

// ── Review of 8e43e043 (three-tier): what the wiring got wrong ────────────────────────────────────────────────
const stalledTerm = (over = {}) => ({ sessionId: 's-term', projectId: 'p1', taskId: 't-run', liveness: 'stalled', since: iso(T0 - 20 * MIN), ...over })
const runningTask = (taskId = 't-run') => ({ taskId, projectId: 'p1', movedAt: iso(T0 - 30 * MIN) })
const settle = () => new Promise((r) => setImmediate(r))

test('finding 1: a project nudge whose finding is gone is dropped before another session takes it', async () => {
  const w = world({ tasks: [runningTask('t9')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.takeNudges('s-a', 'p1').length, 1, 'told while it stood unclaimed')
  w.held = ['t9']
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-b', 'p1'), [], 'claimed since: another session is not told a stale line')
})

test('finding 1: a session nudge whose finding is gone is dropped; one a failed read could not see is kept', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.fail.add('claims')
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  w.fail.delete('claims')
  assert.equal(sweep.takeNudges('s-enrolled', 'p1').length, 1, 'a blind sweep keeps what it could not judge')
  w.tick(30 * MIN)
  await sweepOnce(sweep)
  w.claims = [{ ...silentClaim('c1', 's-enrolled'), session: { lastSignAt: w.deps.now() } }]
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-enrolled', 'p1'), [], 'the claim moved again: its line is gone')
})

test('finding 2: a session that takes nothing for an hour gets one line per finding', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  for (let i = 0; i < 21; i++) { await sweepOnce(sweep); w.tick(3 * MIN) }
  const lines = sweep.takeNudges('s-enrolled', 'p1')
  assert.equal(lines.length, 1, `one line for one key, got ${lines.length}`)
})

test('finding 3: a terminal stalled by its heartbeat but with fresh output is not written into', async () => {
  const w = world({ tasks: [runningTask()], held: ['t-run'], terminals: [stalledTerm()], running: new Set(['s-term']) })
  w.activity.set('s-term', T0 - MIN)
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  await settle()
  assert.deepEqual(out.findings, [])
  assert.equal(w.delivered.length, 0)
})

test('finding 3: a terminal whose task is in review is not called stalled', async () => {
  const w = world({ tasks: [], terminals: [stalledTerm()], running: new Set(['s-term']) })
  w.activity.set('s-term', T0 - 20 * MIN)
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.findings, [])
})

test('finding 6: a capped claims read judges no task unclaimed', async () => {
  const w = world({ tasks: [runningTask('t-free')], claimsCapped: true })
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.findings.filter((f) => f.kind === 'task-unclaimed'), [])
})

// The 0.3.14 review, iteration 3, ER-23, DA-9: a task a full claims chunk left unjudged keeps its earlier finding and
// telling (never told again next sweep), and the receipt names the cut as `tasks`, which the ingress takes.
test('ER-23, DA-9: tasks left unjudged by a full claims chunk keep their finding, are not told again, and the cut is named', async () => {
  const w = world({ tasks: [runningTask('t-free')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings.map((f) => [f.kind, f.taskId]), [['task-unclaimed', 't-free']])
  const toldBefore = w.receipts.reduce((n, r) => n + r.told, 0)
  w.tasks = { tasks: [], capped: true }
  for (let i = 0; i < 2; i++) { w.tick(3 * MIN); await sweepOnce(sweep) }
  assert.deepEqual(sweep.current().findings.map((f) => [f.kind, f.taskId]), [['task-unclaimed', 't-free']], 'kept while unjudged')
  w.tasks = [runningTask('t-free')]
  w.tick(3 * MIN); await sweepOnce(sweep)
  assert.equal(w.receipts.reduce((n, r) => n + r.told, 0), toldBefore, 'judged again, not told again within its quiet window')
  const cut = w.receipts.find((r) => r.capped?.includes('tasks'))
  assert.ok(cut, 'the receipt names the cut')
  assert.equal(prepareEventPayload('work.swept@1', cut).state, 'prepared')
})

test('finding 6: a task a person moved to running is not unclaimed', async () => {
  const w = world({ tasks: [{ ...runningTask('t-hand'), movedByKind: 'person' }, runningTask('t-free')] })
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.findings.map((f) => f.taskId), ['t-free'])
})

test('finding 6: readRunningTasks reads who last moved each task', async () => {
  const { readRunningTasks } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
  let columns = ''
  const rows = [{ id: 't1', project_id: 'p1', moved_at: iso(T0), started_at: null, moved_by_kind: 'person' }]
  const q = { eq: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) }
  const { tasks: out } = await readRunningTasks({ select: (_t, c) => { columns = c; return q }, selectIn: async () => ({ rows: [], failed: null }) })
  assert.match(columns, /moved_by_kind/)
  assert.deepEqual(out, [{ taskId: 't1', projectId: 'p1', movedAt: iso(T0), movedByKind: 'person', movedBy: null, lastClaimedAt: null, lastClaim: null }])
})

test('finding 8: a pass while a sweep is in flight starts no second sweep', async () => {
  const w = world()
  let open
  const gate = new Promise((r) => { open = r })
  const read = w.deps.readClaims
  w.deps.readClaims = async (now) => { await gate; return read(now) }
  const sweep = createAbandonedSweep(w.deps)
  await sweep.onPass(); await sweep.onPass()
  const first = sweep.onPass()
  const during = [sweep.onPass(), sweep.onPass(), sweep.onPass()]
  open()
  assert.ok(await first)
  assert.deepEqual(await Promise.all(during), [null, null, null], 'in flight: no second sweep')
  assert.equal(w.reads, 1, 'one sweep read the claims')
})

test('finding 8: quitting during a sweep releases nothing, and a pass while quitting does nothing', async () => {
  const w = world({ claims: [lapsedClaim('c1')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  const read = w.deps.readClaims
  w.deps.readClaims = async (now) => { const r = await read(now); w.quit = true; return r }
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0, 'quitting began during the sweep: no release')
  const reads = w.reads
  for (let i = 0; i < 3; i++) assert.equal(await sweep.onPass(), null, 'quitting: the pass does nothing')
  assert.equal(w.reads, reads)
})

test('finding 8: quitting during a sweep writes into no terminal', async () => {
  const w = stalledWorld()
  const read = w.deps.readClaims
  w.deps.readClaims = async (now) => { const r = await read(now); w.quit = true; return r }
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  await settle()
  assert.equal(w.delivered.length, 0)
})

test('finding 9: a lapsed claim from before this process started is left to its own expiry', async () => {
  const w = world({ claims: [lapsedClaim('c1')], started: T0 - 5 * MIN })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0)
})

test('finding 9: a lapsed claim minted after this process started is released on the second sweep', async () => {
  const w = world({ claims: [lapsedClaim('c1')], started: T0 - 30 * MIN })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(w.released.map((r) => r.claimId), ['c1'])
})

test('finding 9: a claim from before the start whose session this process saw live is released once it lapses', async () => {
  const w = world({ claims: [{ ...silentClaim('c1', 's-x', T0 - 20 * MIN), session: { lastSignAt: T0 - MIN } }], started: T0 - 5 * MIN })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.claims = [{ ...w.claims[0], session: null }]
  w.tick(3 * MIN); await sweepOnce(sweep)
  w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(w.released.map((r) => r.claimId), ['c1'])
})

test('finding 9: a lapsed claim whose task has an unresolved run is not released', async () => {
  const w = world({ claims: [lapsedClaim('c1')], unresolved: ['task-c1'] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0)
})

test('finding 10: the board read says when it stopped at its thread cap, and the sweep records it', async () => {
  let pages = 0
  const comms = {
    threadPage: async () => { pages++; return { ok: true, threads: [{ id: `th${pages}` }], more: true, before: `b${pages}` } },
    list: async () => ({ ok: true, messages: [], lastSeq: 0, more: false }),
    facts: async () => ({ ok: true, messages: {}, requests: {} })
  }
  const read = await readBoardRequests(comms, 'estate', T0)
  assert.deepEqual(read.capped, ['threads'])
  const w = world({ requests: [{ requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'queued', movedAt: iso(T0 - 5 * MIN), answerUnreadSince: null }], requestsCapped: ['threads'], claimsCapped: true })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(w.receipts.at(-1).capped, ['claims', 'threads'])
})

// ── Review round 2 (B1, B2, R3) ─────────────────────────────────────────────────────────────────────────────
/** A claim from before this process started (T0 - 60 min by default), its session gone, expiring at `expiresAt`. */
const preStartClaim = (id, expiresAt) => ({
  claimId: id, taskId: `task-${id}`, projectId: 'p1', sessionId: `gone-${id}`, claimedAt: iso(T0 - 90 * MIN), renewedAt: null,
  expiresAt: iso(expiresAt), session: null
})

test('B1: an expired claim from before this process started, with no run, is released on the second sweep', async () => {
  const w = world({ claims: [preStartClaim('c1', T0 - 30 * MIN)] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0, 'the first sight releases nothing')
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(w.released.map((r) => r.claimId), ['c1'])
})

test('B1: an unexpired claim from before this process started is not released', async () => {
  const w = world({ claims: [preStartClaim('c1', T0 + 60 * MIN)] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0)
})

test('B1: an expired claim from before this process started whose task has an unresolved run is not released', async () => {
  const w = world({ claims: [preStartClaim('c1', T0 - 30 * MIN)], unresolved: ['task-c1'] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.equal(w.released.length, 0)
})

test('B2: a task a person moved to running is unclaimed again once a claim opened on it since that move', async () => {
  const moved = T0 - 40 * MIN
  const task = { taskId: 't-hand', projectId: 'p1', movedAt: iso(moved), movedByKind: 'person' }
  const w = world({ tasks: [{ ...task, lastClaimedAt: iso(moved + 5 * MIN) }] })
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  assert.deepEqual(out.findings.map((f) => [f.kind, f.taskId]), [['task-unclaimed', 't-hand']], 'the claim since the move ended: nobody holds it')
  const quiet = world({ tasks: [{ ...task, lastClaimedAt: iso(moved - 5 * MIN) }, { ...task, taskId: 't-none', lastClaimedAt: null }] })
  const none = await sweepOnce(createAbandonedSweep(quiet.deps))
  assert.deepEqual(none.findings, [], 'no claim since the person\'s move: still the person\'s')
})

test('B2: readRunningTasks reads the newest claim of each running task, bounded to those tasks', async () => {
  const { readRunningTasks } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
  const rows = [
    { id: 't1', project_id: 'p1', moved_at: iso(T0 - 40 * MIN), started_at: null, moved_by_kind: 'person' },
    { id: 't2', project_id: 'p1', moved_at: iso(T0 - 40 * MIN), started_at: null, moved_by_kind: 'agent' }
  ]
  const asked = []
  const q = { eq: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) }
  let claimRows = [
    { work_id: 't1', claimed_at: iso(T0 - 35 * MIN), released_at: null, released_how: null, owner_session: 's1' },
    { work_id: 't1', claimed_at: iso(T0 - 50 * MIN), released_at: iso(T0 - 45 * MIN), released_how: 'let-go', owner_session: 's0' },
    { work_id: 't2', claimed_at: iso(T0 - 60 * MIN), released_at: iso(T0 - 30 * MIN), released_how: 'done', owner_session: 's2' }
  ]
  let claimError = null
  const store = {
    select: () => q,
    selectIn: async (table, columns, column, values, _chunk, _signal, _eq, order) => {
      asked.push({ table, columns, column, values, order: order ? [order.column, order.ascending] : null, limit: order?.limit })
      return claimError ? { rows: [], failed: claimError } : { rows: claimRows, failed: null }
    }
  }
  const { tasks: out, capped: whole } = await readRunningTasks(store)
  assert.equal(whole, false)
  assert.deepEqual(asked.map((a) => [a.table, a.column, a.values]), [['work_claims', 'work_id', ['t1', 't2']]], 'the running tasks read, no more')
  assert.match(asked[0].columns, /released_how/)
  assert.deepEqual([asked[0].order, asked[0].limit], [['claimed_at', false], 1000], 'DA-3: newest first, at the gateway\'s 1 000 rows')
  assert.equal(out.find((t) => t.taskId === 't1').lastClaimedAt, iso(T0 - 35 * MIN), 'the newest claim, released ones included')
  assert.deepEqual(out.find((t) => t.taskId === 't1').lastClaim, { claimedAt: iso(T0 - 35 * MIN), releasedAt: null, how: null, owner: 's1' })
  assert.deepEqual(out.find((t) => t.taskId === 't2').lastClaim, { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'done', owner: 's2' })
  // DA-3: a chunk that came back full may miss a task's newest claim; that task is not judged, never "no claim".
  claimRows = Array.from({ length: 1000 }, (_, i) => ({ work_id: 't1', claimed_at: iso(T0 - (i + 1) * MIN), released_at: iso(T0 - i * MIN), released_how: 'let-go', owner_session: 's1' }))
  const capped = await readRunningTasks(store)
  assert.deepEqual(capped.tasks.map((t) => t.taskId), ['t1'], 't2 has no row in a full answer: left out this sweep')
  assert.equal(capped.capped, true, 'ER-23, DA-9: the cut is said')
  claimError = 'refused'
  await assert.rejects(readRunningTasks(store), /refused/, 'an unread claim history is never "no claim since"')
})

// CO-439 (1): the running tasks read stops at SWEEP_READ_LIMIT rows. A full read may leave running tasks out, so it is
// said as capped (the receipt names `tasks` and their kinds keep their earlier tellings), never taken as the whole set.
test('CO-439: a running tasks read that comes back at its bound is said as capped', async () => {
  const { readRunningTasks, SWEEP_READ_LIMIT } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
  const full = Array.from({ length: SWEEP_READ_LIMIT }, (_, i) => ({ id: `t${i}`, project_id: 'p1', moved_at: iso(T0 - 40 * MIN), started_at: null, moved_by_kind: 'agent' }))
  let rows = full
  const ordered = []
  const q = { eq: () => q, order: (column, opts) => { ordered.push([column, opts?.ascending]); return q }, limit: async () => ({ data: rows, error: null }) }
  const store = { select: () => q, selectIn: async () => ({ rows: [], failed: null }) }
  const cut = await readRunningTasks(store)
  assert.equal(cut.tasks.length, SWEEP_READ_LIMIT)
  assert.equal(cut.capped, true, 'a read at its bound may have left running tasks out')
  assert.deepEqual(ordered.slice(0, 2), [['moved_at', true], ['id', true]], 'DA-4: a stable order, oldest first')
  rows = full.slice(1)
  assert.equal((await readRunningTasks(store)).capped, false, 'one row under the bound is the whole set')
})

test('R3: a silent claim held by a Fabric terminal session is queued as a nudge, never typed into the terminal', async () => {
  const w = world({ claims: [silentClaim('c1', 's-term')], running: new Set(['s-term']) })
  w.activity.set('s-term', T0 - 20 * MIN)
  const sweep = createAbandonedSweep(w.deps)
  const out = await sweepOnce(sweep)
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(out.findings.map((f) => f.kind), ['claim-silent'])
  assert.equal(w.delivered.length + w.refused.length, 0, 'nothing reached the terminal')
  const lines = sweep.takeNudges('s-term', 'p1')
  assert.equal(lines.length, 1)
  assert.match(lines[0], /task task-c1 you claimed/)
})

// SW-9: the operator's attention queue reads the latest sweep's findings (`current`), one per finding key.
test('SW-9: current() is null before the first sweep, then lists what the latest sweep found with since when', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  assert.equal(sweep.current(), null, 'no sweep yet: nothing is claimed about abandoned work')
  await sweepOnce(sweep)
  const now = sweep.current()
  assert.equal(now.at, T0)
  assert.deepEqual(now.findings.map((f) => f.key), ['claim-silent:c1'])
  assert.equal(now.findings[0].stillSince, T0 - now.findings[0].stillMs)
  now.findings.length = 0
  assert.equal(sweep.current().findings.length, 1, 'a copy: the caller cannot change what the sweep holds')
})

test('SW-9: a finding the next sweep no longer finds leaves current()', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.claims = []
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings, [])
})

test('SW-9: a read that failed keeps its kinds\' last findings, at their first since', async () => {
  const w = world({ claims: [silentClaim('c1', 's-enrolled')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const since = sweep.current().findings[0].stillSince
  w.fail.add('claims')
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings.map((f) => [f.key, f.stillSince]), [['claim-silent:c1', since]])
})

test('SW-9: a lapsed claim this sweep released is gone from current() at once', async () => {
  const w = world({ claims: [lapsedClaim('c1'), lapsedClaim('c2')], started: T0 - 30 * MIN, unresolved: ['task-c2'] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.tick(3 * MIN)
  await sweepOnce(sweep)
  assert.deepEqual(w.released.map((r) => r.claimId), ['c1'])
  assert.deepEqual(sweep.current().findings.map((f) => f.key), ['claim-lapsed:c2'], 'c2 is held by its run and stays')
})

test('iteration 2 DA-1: a read that stays blind is recorded once, and again when it changes', async () => {
  const w = world()
  const sweep = createAbandonedSweep(w.deps)
  w.fail.add('claims')
  for (let i = 0; i < 5; i++) { await sweepOnce(sweep); w.tick(3 * MIN) }
  assert.equal(w.receipts.length, 1, 'five blind sweeps in a row write one receipt')
  assert.deepEqual(w.receipts[0].unread, ['claims'])
  w.fail.delete('claims')
  await sweepOnce(sweep)
  w.fail.add('claims')
  await sweepOnce(sweep)
  assert.equal(w.receipts.length, 2, 'blind again after a clear read is a change, recorded')
})

test('iteration 2 DA-2: the receipt\'s capped names are the reads\' own, never free text', async () => {
  assert.equal(prepareEventPayload('work.swept@1', { found: {}, told: 0, queued: 0, released: 0, capped: ['anything at all here'] }).state, 'rejected')
  assert.equal(prepareEventPayload('work.swept@1', { found: {}, told: 0, queued: 0, released: 0, capped: ['claims', 'threads'] }).state, 'prepared')
})

// The 0.3.13 review, iteration 3: ER-3 and DA-1, a blind read's receipt the journal refused is tried again; DA-5, the
// receipt's read and bound names are the sweep's own lists, so a read the sweep marks is never refused at the door.
test('iteration 3 ER-3: a blind read whose one receipt the journal refused is recorded at the next sweep', async () => {
  const w = world()
  const sweep = createAbandonedSweep(w.deps)
  w.fail.add('claims')
  w.receiptFails = true
  await sweepOnce(sweep); w.tick(3 * MIN)
  assert.equal(w.receipts.length, 0)
  w.receiptFails = false
  await sweepOnce(sweep); w.tick(3 * MIN)
  assert.equal(w.receipts.length, 1, 'the refused receipt is written once the journal takes it')
  await sweepOnce(sweep)
  assert.equal(w.receipts.length, 1, 'and only once')
})

test('iteration 3 DA-5: every read and bound name the sweep can mark passes the receipt\'s ingress', async () => {
  const { SWEEP_READS, SWEEP_CAPS } = await import(path.resolve(import.meta.dirname, '../src/shared/abandonedSweep.ts'))
  assert.equal(prepareEventPayload('work.swept@1', { found: {}, told: 0, queued: 0, released: 0, unread: [...SWEEP_READS], capped: [...SWEEP_CAPS] }).state, 'prepared')
  assert.ok(SWEEP_READS.includes('tasks') && SWEEP_CAPS.includes('claims'))
})

// ── 0.3.14 wave 2: nudges on every turn ───────────────────────────────────────────────────────────────────────
test('takeNudgeItems: each nudge as {kind, says, task_id | request_id}, from the same queue takeNudges reads, once', async () => {
  const w = world({
    claims: [silentClaim('c1', 's-enrolled')],
    requests: [{ requestId: 'r1', targetProjectId: 'p1', requesterProjectId: 'p2', state: 'queued', movedAt: iso(T0 - 10 * MIN), answerUnreadSince: null }]
  })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const items = sweep.takeNudgeItems('s-enrolled', 'p1')
  assert.deepEqual(items.map((n) => Object.keys(n).sort()), [['kind', 'says', 'task_id'], ['kind', 'request_id', 'says']])
  assert.deepEqual(items.map((n) => n.kind), ['claim-silent', 'request-unmoved'])
  assert.equal(items[0].task_id, 'task-c1')
  assert.equal(items[1].request_id, 'r1')
  assert.match(items[0].says, /^Fabric: task task-c1 you claimed has been still for 20 min\./)
  assert.deepEqual(sweep.takeNudgeItems('s-enrolled', 'p1'), [], 'taken once')
  assert.deepEqual(sweep.takeNudges('s-enrolled', 'p1'), [], 'and gone from the strings fabric_work_list reads too')
  assert.equal(sweep.takeNudges('s-other', 'p1').length, 1, 'the project nudge still reaches another session')
  assert.deepEqual(sweep.takeNudgeItems('s-other', 'p1'), [], 'once per session, whichever answer took it')
})

// ── The 0.3.14 review, iteration 1: PL-1, DA-1, ER-1, DO-1, ER-2. A turn's answer SHOWS nudges, it takes none ──────
test('PL-1: a turn\'s answer shows the nudges and takes none, so an adapter that ignores the answer loses nothing', async () => {
  const w = world({
    claims: [silentClaim('c1', 's-enrolled')],
    requests: [{ requestId: 'r1', targetProjectId: 'p1', requesterProjectId: 'p2', state: 'queued', movedAt: iso(T0 - 10 * MIN), answerUnreadSince: null }]
  })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const turn = sweep.showTurnNudges('s-enrolled', 'p1', 'k1')
  assert.deepEqual(turn.map((n) => n.kind), ['claim-silent', 'request-unmoved'])
  // An adapter before 0.51.2 throws that answer away; the agent's next fabric_work_list still gets both, once.
  assert.equal(sweep.takeNudges('s-enrolled', 'p1').length, 2, 'fabric_work_list still takes what the turn showed')
  assert.deepEqual(sweep.takeNudges('s-enrolled', 'p1'), [], 'and takes each once')
})

test('PL-1: each nudge is shown on a session\'s turns at most once, and at most five per turn', async () => {
  const w = world({ claims: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((id) => silentClaim(id, 's-many')) })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const first = sweep.showTurnNudges('s-many', 'p1', 'k1')
  assert.equal(first.length, 5, 'at most five on one turn')
  const second = sweep.showTurnNudges('s-many', 'p1', 'k2')
  assert.equal(second.length, 2, 'the rest on the next turn')
  assert.equal(new Set([...first, ...second].map((n) => n.task_id)).size, 7, 'none twice')
  assert.deepEqual(sweep.showTurnNudges('s-many', 'p1', 'k3'), [], 'shown once on turns')
  assert.equal(sweep.takeNudges('s-many', 'p1').length, 7, 'every one still waits for fabric_work_list')
})

test('ER-2: a repeat of a turn answers the nudges the first answer showed, even once fabric_work_list took them', async () => {
  const w = world({ claims: [silentClaim('c1', 's-r')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  const first = sweep.showTurnNudges('s-r', 'p1', 'k1')
  assert.equal(first.length, 1)
  sweep.takeNudges('s-r', 'p1')
  assert.deepEqual(sweep.showTurnNudges('s-r', 'p1', 'k1'), first, 'the same key, the same answer')
  assert.deepEqual(sweep.showTurnNudges('s-r', 'p1', 'k2'), [], 'another turn shows nothing new')
  assert.deepEqual(sweep.showTurnNudges('s-other', 'p1', 'k1'), [], 'a key is its session\'s own')
})

test('PL-1: a project nudge is shown once to each session\'s turns, and a new telling is shown again', async () => {
  const w = world({ requests: [{ requestId: 'r1', targetProjectId: 'p1', requesterProjectId: 'p2', state: 'queued', movedAt: iso(T0 - 10 * MIN), answerUnreadSince: null }] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.showTurnNudges('s-a', 'p1', 'a1').length, 1)
  assert.deepEqual(sweep.showTurnNudges('s-a', 'p1', 'a2'), [])
  assert.equal(sweep.showTurnNudges('s-b', 'p1', 'b1').length, 1, 'another session of the project is shown it too')
  assert.equal(sweep.takeNudges('s-a', 'p1').length, 1, 'still there for fabric_work_list')
  w.tick(31 * MIN); await sweepOnce(sweep)
  assert.equal(sweep.showTurnNudges('s-a', 'p1', 'a3').length, 1, 'told again after 30 minutes: shown again')
})

// ── 0.3.14 wave 2: a session changing files with no claim ─────────────────────────────────────────────────────
const { readRecentTurns } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
const changedTurn = (sessionId, agoMin, filesChanged = 3) => ({ sessionId, projectId: 'p1', at: iso(T0 - agoMin * MIN), filesChanged })
/** Two turns of a session whose working tree changed between them (the review, iteration 1, DA-2). */
const changing = (sessionId, fromMin = 3, toMin = 1) => [changedTurn(sessionId, fromMin, 3), changedTurn(sessionId, toMin, 5)]

test('work-unclaimed: a session changing files with no claim is nudged once in 30 minutes, in its own queue', async () => {
  const w = world({ turns: changing('s-free', 6, 1) })
  const sweep = createAbandonedSweep(w.deps)
  const r = await sweepOnce(sweep)
  assert.deepEqual(r.findings.map((f) => f.kind), ['work-unclaimed'])
  const items = sweep.takeNudgeItems('s-free', 'p1')
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'work-unclaimed')
  assert.match(items[0].says, /holds no claim\. Claim the task you are working on \(fabric_work_claim\)/)
  assert.deepEqual(sweep.takeNudgeItems('s-other', 'p1'), [], 'another session of the project is not told')
  w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudgeItems('s-free', 'p1'), [], 'not again inside 30 minutes')
  assert.equal(w.receipts[0].found['work-unclaimed'], 1)
  assert.equal(prepareEventPayload('work.swept@1', w.receipts[0]).state, 'prepared', 'the receipt with the new kind passes the ingress')
})

test('work-unclaimed: a session that holds a claim or a managed launch is not nudged', async () => {
  const claim = { ...silentClaim('c1', 's-claim'), expiresAt: iso(T0 + 10 * MIN), session: { lastSignAt: T0 } }
  const w = world({ claims: [claim], heldSessions: ['s-lease'], turns: [...changing('s-claim'), ...changing('s-lease')] })
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(r.findings, [])
})

test('work-unclaimed: no session is judged unclaimed when the claims or terminals read failed or stopped at its cap', async () => {
  for (const over of [{ fail: new Set(['claims']) }, { fail: new Set(['terminals']) }, { claimsCapped: true }]) {
    const w = world({ turns: changing('s-free'), ...over })
    const r = await sweepOnce(createAbandonedSweep(w.deps))
    assert.deepEqual(r.findings.filter((f) => f.kind === 'work-unclaimed'), [], JSON.stringify(Object.keys(over)))
  }
})

test('work-unclaimed: a failed turns read is named in the receipt, and its receipt passes the ingress', async () => {
  const w = world({ fail: new Set(['turns']) })
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(r.failedReads, ['turns'])
  assert.deepEqual(w.receipts[0].unread, ['turns'])
  assert.equal(prepareEventPayload('work.swept@1', w.receipts[0]).state, 'prepared')
})

test('work-unclaimed is the agent\'s reminder, not the operator\'s queue: current() leaves it out', async () => {
  const w = world({ turns: changing('s-free'), tasks: [{ taskId: 't9', projectId: 'p1', movedAt: iso(T0 - 10 * MIN) }] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings.map((f) => f.kind), ['task-unclaimed'])
})

test('0.3.14, the simple Fabric: current() counts the sessions working without a task for the home, and says unknown when it could not see them', async () => {
  const w = world({ turns: [...changing('s-free'), ...changing('s-free-2')] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.current().unclaimed, 2, 'two sessions change files and hold no claim')
  assert.deepEqual(sweep.current().findings.filter((f) => f.kind === 'work-unclaimed'), [], 'still not in the operator\'s queue')
  for (const over of [{ fail: new Set(['turns']) }, { fail: new Set(['claims']) }, { claimsCapped: true }]) {
    const blindWorld = world({ turns: changing('s-free'), ...over })
    const blindSweep = createAbandonedSweep(blindWorld.deps)
    await sweepOnce(blindSweep)
    assert.equal(blindSweep.current().unclaimed, null, `unknown, never 0, when ${JSON.stringify(Object.keys(over))} kept it from seeing`)
  }
})

test('readRecentTurns: the turns of the last 15 minutes, newest first and bounded, by the database\'s time', async () => {
  const calls = []
  const rows = [
    { project_id: 'p1', occurred_at: iso(T0 - MIN), payload: { session_id: 's1', files_changed: 2, lines_added: 7, lines_removed: 1 } },
    { project_id: 'p2', occurred_at: iso(T0 - 2 * MIN), payload: { session_id: 's2', files_changed: null } },
    { project_id: 'p2', occurred_at: iso(T0 - 3 * MIN), payload: {} }
  ]
  const q = new Proxy({}, { get: (_t, prop) => prop === 'then' ? (res) => res({ data: rows, error: null }) : (...args) => { calls.push([prop, ...args]); return q } })
  const store = { select: (table, cols) => { calls.push(['select', table, cols]); return q } }
  const { turns, capped } = await readRecentTurns(store, T0)
  assert.deepEqual(turns, [
    { sessionId: 's1', projectId: 'p1', at: iso(T0 - MIN), filesChanged: 2, linesAdded: 7, linesRemoved: 1 },
    { sessionId: 's2', projectId: 'p2', at: iso(T0 - 2 * MIN), filesChanged: null, linesAdded: null, linesRemoved: null }
  ])
  assert.equal(capped, false)
  assert.deepEqual(calls.find((c) => c[0] === 'eq'), ['eq', 'type', 'session.turn.observed@1'])
  assert.deepEqual(calls.find((c) => c[0] === 'gte'), ['gte', 'occurred_at', iso(T0 - 15 * MIN)])
  assert.ok(calls.some((c) => c[0] === 'limit'), 'bounded')
  const failing = { select: () => new Proxy({}, { get: (_t, prop) => prop === 'then' ? (res) => res({ data: null, error: { message: 'refused' } }) : () => failing.select() }) }
  await assert.rejects(readRecentTurns(failing, T0), /turns could not be read/)
})

// ── 0.3.14 wave 2: a done release that left its task running (task b2c42b88) is repaired ─────────────────────
const doneTask = (over = {}) => ({ taskId: 't-done', projectId: 'p1', movedAt: iso(T0 - 40 * MIN),
  lastClaim: { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'done' }, ...over })

test('done left running: the sweep moves a running task whose last claim ended done, with no move since, to review', async () => {
  const moved = []
  const w = world({ tasks: [doneTask()] })
  w.deps.moveDoneToReview = async (taskId) => { moved.push(taskId); return { task_moved_to: 'review', task_status: 'review' } }
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(moved, ['t-done'])
  assert.equal(r.findings.some((f) => f.taskId === 't-done' && f.kind === 'task-unclaimed'), false, 'repaired, not called unclaimed')
})

test('done left running: not for a task moved since the release, one held now, one released otherwise, or a blind claims read', async () => {
  const cases = [
    world({ tasks: [doneTask({ movedAt: iso(T0 - 20 * MIN), movedByKind: 'person' })] }),
    world({ tasks: [doneTask()], held: ['t-done'] }),
    world({ tasks: [doneTask({ lastClaim: { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'let-go' } })] }),
    world({ tasks: [doneTask({ lastClaim: { claimedAt: iso(T0 - 20 * MIN), releasedAt: null, how: null } })] }),
    world({ tasks: [doneTask()], fail: new Set(['claims']) })
  ]
  for (const [i, w] of cases.entries()) {
    const moved = []
    w.deps.moveDoneToReview = async (taskId) => { moved.push(taskId); return { task_moved_to: 'review', task_status: 'review' } }
    await sweepOnce(createAbandonedSweep(w.deps))
    assert.deepEqual(moved, [], `case ${i}`)
  }
})

test('done left running: a repair that fails is said in the ops log and the sweep goes on', async () => {
  const w = world({ tasks: [doneTask()] })
  w.deps.moveDoneToReview = async () => { throw new Error('append refused') }
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.ok(r)
  assert.ok(w.failed.some((f) => f.op === 'work.sweep-done-review' && /append refused/.test(f.message)))
})

// ── The 0.3.14 review, iteration 1: ER-4, ER-5, ER-6 (the sweep's repairs), ER-3, ER-12 (blind and capped reads) ───
test('ER-4: a done release made from backlog, whose task then went to running and stopped there, is moved to review', async () => {
  const moved = []
  // TR-3: the release is appended, then backlog to running by the releasing session, then running to review failed.
  const w = world({ tasks: [doneTask({ movedAt: iso(T0 - 30 * MIN + 2000), movedByKind: 'agent', movedBy: 's-rel', movedFrom: 'backlog',
    lastClaim: { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'done', owner: 's-rel' } })] })
  w.deps.moveDoneToReview = async (taskId) => { moved.push(taskId); return { task_moved_to: 'review' } }
  await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(moved, ['t-done'])
})

// The 0.3.14 review, iteration 3, ER-22: the 60 s exception is the release's own step from backlog, never a move after
// the release. The probe's case: released done at T0 (the move to review landed), then 30 s later the same session
// moved it back from review to running on purpose; and a move whose `from` could not be read.
test('ER-22: the releasing session\'s take-back from review within the minute is a move since the release, never repaired', async () => {
  const released = { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'done', owner: 's-rel' }
  const cases = [
    doneTask({ taskId: 't-taken-back', movedAt: iso(T0 - 30 * MIN + 30_000), movedByKind: 'agent', movedBy: 's-rel', movedFrom: 'review', lastClaim: released }),
    doneTask({ taskId: 't-from-unread', movedAt: iso(T0 - 30 * MIN + 2000), movedByKind: 'agent', movedBy: 's-rel', movedFrom: null, lastClaim: released })
  ]
  const moved = []
  const w = world({ tasks: cases })
  w.deps.moveDoneToReview = async (taskId) => { moved.push(taskId); return { task_moved_to: 'review' } }
  await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(moved, [])
})

test('ER-22: readRunningTasks reads the last move\'s from only for a possible release step, and an unread one stays unread', async () => {
  const { readRunningTasks } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
  const rows = [
    { id: 't-step', project_id: 'p1', moved_at: iso(T0 - 30 * MIN + 2000), started_at: null, moved_by_kind: 'agent', moved_by: 's-rel' },
    { id: 't-other', project_id: 'p1', moved_at: iso(T0 - 40 * MIN), started_at: null, moved_by_kind: 'agent', moved_by: 's-rel' }
  ]
  const claims = [
    { work_id: 't-step', claimed_at: iso(T0 - 60 * MIN), released_at: iso(T0 - 30 * MIN), released_how: 'done', owner_session: 's-rel' },
    { work_id: 't-other', claimed_at: iso(T0 - 60 * MIN), released_at: iso(T0 - 30 * MIN), released_how: 'done', owner_session: 's-rel' }
  ]
  const journalAsked = []
  let journal = { data: [{ payload: { task_id: 't-step', from: 'review', to: 'running' } }], error: null }
  const store = {
    select: (table) => {
      const filters = []
      const q = { eq: (c, v) => { filters.push([c, v]); return q }, order: () => q,
        limit: async () => { if (table === 'journal') { journalAsked.push(filters); return journal } return { data: rows, error: null } } }
      return q
    },
    selectIn: async () => ({ rows: claims, failed: null })
  }
  const { tasks: out } = await readRunningTasks(store)
  assert.deepEqual(journalAsked, [[['type', 'task.moved@1'], ['payload->>task_id', 't-step']]], 'only the possible step is read')
  assert.equal(out.find((t) => t.taskId === 't-step').movedFrom, 'review')
  assert.equal('movedFrom' in out.find((t) => t.taskId === 't-other'), false)
  journal = { data: null, error: { message: 'deadline' } }
  const { tasks: unread } = await readRunningTasks(store)
  assert.equal(unread.find((t) => t.taskId === 't-step').movedFrom, null)
})

test('ER-13: a done release is not repaired after ANY move since it: an agent\'s rework, a relaunch, a person, the owner much later', async () => {
  const H = 60 * MIN
  const released = { claimedAt: iso(T0 - 50 * H), releasedAt: iso(T0 - 48 * H), how: 'done', owner: 's-rel' }
  const cases = [
    doneTask({ taskId: 't-rework', movedAt: iso(T0 - MIN), movedByKind: 'agent', movedBy: 's-other', lastClaim: released }),
    doneTask({ taskId: 't-relaunch', movedAt: iso(T0 - MIN), movedByKind: 'system', movedBy: 'launch', lastClaim: released }),
    doneTask({ taskId: 't-person', movedAt: iso(T0 - MIN), movedByKind: 'person', movedBy: 'operator', lastClaim: released }),
    doneTask({ taskId: 't-owner-later', movedAt: iso(T0 - MIN), movedByKind: 'agent', movedBy: 's-rel', lastClaim: released })
  ]
  const moved = []
  const w = world({ tasks: cases })
  w.deps.moveDoneToReview = async (taskId) => { moved.push(taskId); return { task_moved_to: 'review' } }
  await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(moved, [], 'every move since the release is left alone')
})

test('ER-5: a done repair that fails keeps its task in the operator\'s queue as task-unclaimed; a repair that lands does not', async () => {
  const w = world({ tasks: [doneTask()] })
  w.deps.moveDoneToReview = async () => ({ task_moved_to: null, failed: 'append refused' })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings.map((f) => [f.kind, f.taskId]), [['task-unclaimed', 't-done']], 'the operator sees it')
  assert.ok(w.failed.some((f) => f.op === 'work.sweep-done-review'))
  w.deps.moveDoneToReview = async () => ({ task_moved_to: 'review' })
  w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings, [], 'gone once the repair read back')
})

test('ER-6: a running task whose last claim ended other than done, with no move since and nothing holding it, goes back to backlog', async () => {
  const left = (how, over = {}) => ({ taskId: `t-${how}`, projectId: 'p1', movedAt: iso(T0 - 40 * MIN),
    lastClaim: { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how }, ...over })
  const moved = []
  const w = world({ tasks: ['let-go', 'lapsed', 'session-ended', 'operator', 'handed-over'].map((h) => left(h)) })
  w.deps.moveReleasedToBacklog = async (taskId) => { moved.push(taskId); return { task_moved_to: 'backlog' } }
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(moved, ['t-let-go', 't-lapsed', 't-session-ended', 't-operator', 't-handed-over'])
  assert.deepEqual(sweep.current().findings, [], 'moved, not called unclaimed')
  for (const [i, c] of [
    world({ tasks: [left('let-go', { movedAt: iso(T0 - 20 * MIN) })] }),
    world({ tasks: [left('let-go')], held: ['t-let-go'] }),
    world({ tasks: [left('done')] }),
    world({ tasks: [left('let-go')], fail: new Set(['claims']) })
  ].entries()) {
    const none = []
    c.deps.moveReleasedToBacklog = async (taskId) => { none.push(taskId); return { task_moved_to: 'backlog' } }
    await sweepOnce(createAbandonedSweep(c.deps))
    assert.deepEqual(none, [], `case ${i}`)
  }
  const failing = world({ tasks: [left('let-go')] })
  failing.deps.moveReleasedToBacklog = async () => ({ task_moved_to: null, failed: 'refused' })
  const s2 = createAbandonedSweep(failing.deps)
  await sweepOnce(s2)
  assert.deepEqual(s2.current().findings.map((f) => f.kind), ['task-unclaimed'], 'a retry that fails stays in the operator\'s queue')
  assert.ok(failing.failed.some((f) => f.op === 'work.sweep-released-backlog'))
})

test('ER-3: a failed claims read keeps brief-missing\'s quiet window and its queued nudge', async () => {
  const w = world({ claims: [liveClaim()] })
  w.deps.readBriefGaps = async () => ({ t1: ['why'] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  w.fail.add('claims'); w.tick(3 * MIN); await sweepOnce(sweep)
  assert.equal(sweep.takeNudges('s-work', 'p1').length, 1, 'still queued across the blind sweep')
  w.fail.delete('claims'); w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-work', 'p1'), [], 'not told again inside 30 minutes')
})

test('ER-3: a capped claims read keeps work-unclaimed\'s quiet window', async () => {
  const w = world({ turns: changing('s-free') })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.takeNudges('s-free', 'p1').length, 1)
  w.claimsCapped = true; w.tick(3 * MIN); await sweepOnce(sweep)
  w.claimsCapped = false; w.turns = changing('s-free', 4, 1); w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-free', 'p1'), [], 'not told again 6 minutes later')
})

test('DA-7, ER-12: a turns read stopped at its bound is named capped, judges no session and keeps the quiet window', async () => {
  const w = world({ turns: changing('s-free') })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.equal(sweep.takeNudges('s-free', 'p1').length, 1)
  w.turnsCapped = true; w.tick(3 * MIN)
  const r = await sweepOnce(sweep)
  assert.deepEqual(r.findings, [])
  assert.ok(w.receipts.at(-1).capped.includes('turns'))
  assert.equal(prepareEventPayload('work.swept@1', w.receipts.at(-1)).state, 'prepared')
  w.turnsCapped = false; w.tick(3 * MIN); await sweepOnce(sweep)
  assert.deepEqual(sweep.takeNudges('s-free', 'p1'), [], 'not told again')
  const rows = Array.from({ length: 500 }, (_, i) => ({ project_id: 'p1', occurred_at: iso(T0 - MIN), payload: { session_id: `s${i}`, files_changed: 1 } }))
  const q = new Proxy({}, { get: (_t, prop) => prop === 'then' ? (res) => res({ data: rows, error: null }) : () => q })
  assert.equal((await readRecentTurns({ select: () => q }, T0)).capped, true)
})

test('ER-8: taskHeldElsewhere counts another session\'s lapsed lease whose run is not proved stopped, as readWork does', async () => {
  const { taskHeldElsewhere } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))
  const storeWith = (lease, runs) => {
    const q = (rows) => { const c = { eq: () => c, is: () => c, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), then: (res) => res({ data: rows, error: null }) }; return c }
    return {
      select: (table) => q(table === 'leases' && lease ? [lease] : []),
      selectIn: async (table) => ({ rows: table === 'task_runs' ? runs : [], failed: null })
    }
  }
  const lapsed = { owner_session: 's-launch', expires_at: iso(T0 - MIN) }
  const run = { task_run_id: 'run1', task_id: 't1', session_id: 's-launch', state: 'running', outcome: null, ended_seq: null, created_at: iso(T0 - 30 * MIN) }
  const claim = { id: 'c1', owner_session: 's-gone' }
  assert.equal(await taskHeldElsewhere(storeWith(lapsed, [run]), 't1', claim, T0), true, 'a run not proved stopped holds its task')
  assert.equal(await taskHeldElsewhere(storeWith(lapsed, []), 't1', claim, T0), false, 'a lapsed lease with no run holds nothing')
  assert.equal(await taskHeldElsewhere(storeWith({ ...lapsed, expires_at: iso(T0 + MIN) }, []), 't1', claim, T0), true, 'a live lease holds')
  assert.equal(await taskHeldElsewhere(storeWith({ ...lapsed, owner_session: 's-gone' }, [run]), 't1', claim, T0), false, 'the claim\'s own session is not elsewhere')
})

test('ER-6: moveReleasedLeftRunningToBacklog moves running to backlog as the sweep, read back; not while a claim holds it', async () => {
  const { moveReleasedLeftRunningToBacklog, RELEASED_LEFT_RUNNING_NOTE } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))
  const held = releaseWorld()
  assert.deepEqual(await moveReleasedLeftRunningToBacklog(held.store, held.append, 't1', 'p1'), { task_moved_to: null, task_status: 'running' }, 'an open claim holds it')
  const w = releaseWorld()
  await w.append({ type: 'work.released@1', payload: {} })
  const r = await moveReleasedLeftRunningToBacklog(w.store, w.append, 't1', 'p1')
  assert.deepEqual(r, { task_moved_to: 'backlog', task_status: 'backlog' })
  const move = w.appended.find((e) => e.type === 'task.moved@1')
  assert.deepEqual(move.actor, { kind: 'system', id: 'work-sweep' })
  assert.deepEqual(move.payload, { task_id: 't1', from: 'running', to: 'backlog', note: RELEASED_LEFT_RUNNING_NOTE })
})

test('moveDoneLeftRunningToReview: running to review as the sweep, read back, with the note saying why', async () => {
  const { moveDoneLeftRunningToReview, DONE_LEFT_RUNNING_NOTE } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))
  const held = releaseWorld()
  assert.deepEqual(await moveDoneLeftRunningToReview(held.store, held.append, 't1', 'p1'), { task_moved_to: null, task_status: 'running' },
    'ER-13: a claim open at the moment of the move holds it')
  assert.equal(held.appended.length, 0)
  const w = releaseWorld()
  await w.append({ type: 'work.released@1', payload: {} })
  const r = await moveDoneLeftRunningToReview(w.store, w.append, 't1', 'p1')
  assert.deepEqual(r, { task_moved_to: 'review', task_status: 'review' })
  const move = w.appended.find((e) => e.type === 'task.moved@1')
  assert.deepEqual(move.actor, { kind: 'system', id: 'work-sweep' })
  assert.deepEqual(move.payload, { task_id: 't1', from: 'running', to: 'review', note: DONE_LEFT_RUNNING_NOTE })
})

// ── 0.3.14 wave 2: briefs filled ─────────────────────────────────────────────────────────────────────────────
const { readBriefGaps } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
const liveClaim = (over = {}) => ({ claimId: 'c1', taskId: 't1', projectId: 'p1', sessionId: 's-work', claimedAt: iso(T0 - 12 * MIN), renewedAt: null,
  expiresAt: iso(T0 + 20 * MIN), session: { lastSignAt: T0 }, ...over })

test('brief-missing: a claimed task with an incomplete brief is nudged to its session, from the claims\' own tasks', async () => {
  const asked = []
  const w = world({ claims: [liveClaim()] })
  w.deps.readBriefGaps = async (ids) => { asked.push(ids); return { t1: ['why', 'expected'] } }
  const sweep = createAbandonedSweep(w.deps)
  const r = await sweepOnce(sweep)
  assert.deepEqual(asked, [['t1']])
  assert.deepEqual(r.findings.map((f) => f.kind), ['brief-missing'])
  const items = sweep.takeNudgeItems('s-work', 'p1')
  assert.deepEqual(items.map((n) => [n.kind, n.task_id]), [['brief-missing', 't1']])
  assert.match(items[0].says, /missing why, expected: write each with fabric_task_brief/)
  assert.deepEqual(sweep.current().findings, [], 'a reminder to the agent, not the operator\'s queue')
  assert.equal(prepareEventPayload('work.swept@1', w.receipts[0]).state, 'prepared')
})

test('brief-missing: a briefs read that fails is named in the receipt, and judges no brief', async () => {
  const w = world({ claims: [liveClaim()] })
  w.deps.readBriefGaps = async () => { throw new Error('refused') }
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(r.failedReads, ['briefs'])
  assert.deepEqual(r.findings, [])
  assert.deepEqual(w.receipts[0].unread, ['briefs'])
  assert.equal(prepareEventPayload('work.swept@1', w.receipts[0]).state, 'prepared')
})

test('readBriefGaps: each task\'s missing sections; a closed task none; a read that fails throws', async () => {
  const asked = []
  const store = { selectIn: async (table, columns, column, values) => { asked.push([table, column, values]); return { rows: [
    { id: 't1', status: 'running', brief_what: 'Do it', brief_why: null, brief_expected: ' ' },
    { id: 't2', status: 'running', brief_what: 'a', brief_why: 'b', brief_expected: 'c' },
    { id: 't3', status: 'done', brief_what: null, brief_why: null, brief_expected: null }
  ], failed: null } } }
  assert.deepEqual(await readBriefGaps(store, ['t1', 't2', 't3']), { t1: ['why', 'expected'], t2: [], t3: [] })
  assert.deepEqual(asked, [['project_tasks', 'id', ['t1', 't2', 't3']]])
  await assert.rejects(readBriefGaps({ selectIn: async () => ({ rows: [], failed: 'refused' }) }, ['t1']), /briefs could not be read/)
})

/** A store a claim can run against: the task, and the claim the projection writes for the append. */
function claimStore(task) {
  let claim = null
  const table = (name) => {
    const q = new Proxy({}, {
      get: (_, k) => {
        if (k === 'then') return (resolve) => resolve({ data: [], error: null })
        if (k === 'maybeSingle') return async () => ({ data: name === 'project_tasks' ? task : name === 'work_claims' ? claim : null, error: null })
        return () => q
      }
    })
    return q
  }
  return {
    store: { select: (name) => table(name), selectIn: async () => ({ rows: [], failed: null }) },
    onAppend: (e) => {
      if (e.type === 'work.claimed@1') claim = { id: e.payload.claim_id, work_id: e.payload.work, released_at: null, expires_at: e.payload.expires_at, touches: [] }
      if (e.type === 'task.moved@1') task.status = e.payload.to
    }
  }
}

async function claimWith(task) {
  const tools = new Map()
  const server = { registerTool: (name, _def, handler) => tools.set(name, handler) }
  const c = claimStore(task)
  registerWorkTools(server, {
    scope: { estateId: 'e', projectId: 'p1', sessionId: 's1', agent: 'claude-code', cameIn: 'enrolled' },
    store: c.store, append: async (e) => { c.onAppend(e); return { seq: 1 } }, appendObserved: async () => ({ seq: 1 }), checkReference: () => {},
    sessions: () => [], session: () => null, resolveSource: async () => ({ ok: false }), leaseRefs: async () => null,
    onClaimed: () => {}, endSession: () => {}, now: () => T0
  })
  return JSON.parse((await tools.get('fabric_work_claim')({ taskId: task.id })).content[0].text)
}

test('fabric_work_claim names the brief\'s missing sections and fabric_task_brief, and still claims', async () => {
  const answer = await claimWith({ id: 'b1000000-0000-4000-8000-000000000001', status: 'backlog', title: 'Fix it', instruction: 'Fix it', brief_what: 'Fix it', brief_why: null, brief_expected: '' })
  assert.equal(answer.claimed, true)
  assert.deepEqual(answer.brief_missing, ['why', 'expected'])
  assert.match(answer.brief_next, /^Its brief is missing why, expected: write each with fabric_task_brief/)
  const whole = await claimWith({ id: 'b1000000-0000-4000-8000-000000000002', status: 'backlog', title: 'Fix it', instruction: 'Fix it', brief_what: 'a', brief_why: 'b', brief_expected: 'c' })
  assert.equal(whole.claimed, true)
  assert.equal('brief_missing' in whole, false)
  assert.equal('brief_next' in whole, false)
})
