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
    readTurns: read('turns', () => w.turns),
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
  const q = { eq: () => q, limit: async () => ({ data: rows, error: null }) }
  const out = await readRunningTasks({ select: (_t, c) => { columns = c; return q }, selectIn: async () => ({ rows: [], failed: null }) })
  assert.match(columns, /moved_by_kind/)
  assert.deepEqual(out, [{ taskId: 't1', projectId: 'p1', movedAt: iso(T0), movedByKind: 'person', lastClaimedAt: null, lastClaim: null }])
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
  const q = { eq: () => q, limit: async () => ({ data: rows, error: null }) }
  const store = {
    select: () => q,
    selectIn: async (table, columns, column, values) => {
      asked.push({ table, columns, column, values })
      return { rows: [
        { work_id: 't1', claimed_at: iso(T0 - 35 * MIN), released_at: null, released_how: null },
        { work_id: 't1', claimed_at: iso(T0 - 50 * MIN), released_at: iso(T0 - 45 * MIN), released_how: 'let-go' },
        { work_id: 't2', claimed_at: iso(T0 - 60 * MIN), released_at: iso(T0 - 30 * MIN), released_how: 'done' }
      ], failed: null }
    }
  }
  const out = await readRunningTasks(store)
  assert.deepEqual(asked.map((a) => [a.table, a.column, a.values]), [['work_claims', 'work_id', ['t1', 't2']]], 'the running tasks read, no more')
  assert.match(asked[0].columns, /released_how/)
  assert.equal(out.find((t) => t.taskId === 't1').lastClaimedAt, iso(T0 - 35 * MIN), 'the newest claim, released ones included')
  assert.deepEqual(out.find((t) => t.taskId === 't1').lastClaim, { claimedAt: iso(T0 - 35 * MIN), releasedAt: null, how: null })
  assert.deepEqual(out.find((t) => t.taskId === 't2').lastClaim, { claimedAt: iso(T0 - 60 * MIN), releasedAt: iso(T0 - 30 * MIN), how: 'done' })
  const failing = { ...store, selectIn: async () => ({ rows: [], failed: 'refused' }) }
  await assert.rejects(readRunningTasks(failing), /refused/, 'an unread claim history is never "no claim since"')
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

// ── 0.3.14 wave 2: a session changing files with no claim ─────────────────────────────────────────────────────
const { readRecentTurns } = await import(path.resolve(import.meta.dirname, '../src/main/abandonedSweepRun.ts'))
const changedTurn = (sessionId, agoMin, filesChanged = 3) => ({ sessionId, projectId: 'p1', at: iso(T0 - agoMin * MIN), filesChanged })

test('work-unclaimed: a session changing files with no claim is nudged once in 30 minutes, in its own queue', async () => {
  const w = world({ turns: [changedTurn('s-free', 6), changedTurn('s-free', 1)] })
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
  const w = world({ claims: [claim], heldSessions: ['s-lease'], turns: [changedTurn('s-claim', 2), changedTurn('s-lease', 2)] })
  const r = await sweepOnce(createAbandonedSweep(w.deps))
  assert.deepEqual(r.findings, [])
})

test('work-unclaimed: no session is judged unclaimed when the claims or terminals read failed or stopped at its cap', async () => {
  for (const over of [{ fail: new Set(['claims']) }, { fail: new Set(['terminals']) }, { claimsCapped: true }]) {
    const w = world({ turns: [changedTurn('s-free', 2)], ...over })
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
  const w = world({ turns: [changedTurn('s-free', 2)], tasks: [{ taskId: 't9', projectId: 'p1', movedAt: iso(T0 - 10 * MIN) }] })
  const sweep = createAbandonedSweep(w.deps)
  await sweepOnce(sweep)
  assert.deepEqual(sweep.current().findings.map((f) => f.kind), ['task-unclaimed'])
})

test('readRecentTurns: the turns of the last 15 minutes, newest first and bounded, by the database\'s time', async () => {
  const calls = []
  const rows = [
    { project_id: 'p1', occurred_at: iso(T0 - MIN), payload: { session_id: 's1', files_changed: 2 } },
    { project_id: 'p2', occurred_at: iso(T0 - 2 * MIN), payload: { session_id: 's2', files_changed: null } },
    { project_id: 'p2', occurred_at: iso(T0 - 3 * MIN), payload: {} }
  ]
  const q = new Proxy({}, { get: (_t, prop) => prop === 'then' ? (res) => res({ data: rows, error: null }) : (...args) => { calls.push([prop, ...args]); return q } })
  const store = { select: (table, cols) => { calls.push(['select', table, cols]); return q } }
  const turns = await readRecentTurns(store, T0)
  assert.deepEqual(turns, [
    { sessionId: 's1', projectId: 'p1', at: iso(T0 - MIN), filesChanged: 2 },
    { sessionId: 's2', projectId: 'p2', at: iso(T0 - 2 * MIN), filesChanged: null }
  ])
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
    world({ tasks: [doneTask({ movedAt: iso(T0 - 20 * MIN) })] }),
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

test('moveDoneLeftRunningToReview: running to review as the sweep, read back, with the note saying why', async () => {
  const { moveDoneLeftRunningToReview, DONE_LEFT_RUNNING_NOTE } = await import(path.resolve(import.meta.dirname, '../src/main/workRelease.ts'))
  const w = releaseWorld()
  const r = await moveDoneLeftRunningToReview(w.store, w.append, 't1', 'p1')
  assert.deepEqual(r, { task_moved_to: 'review', task_status: 'review' })
  const move = w.appended.find((e) => e.type === 'task.moved@1')
  assert.deepEqual(move.actor, { kind: 'system', id: 'work-sweep' })
  assert.deepEqual(move.payload, { task_id: 't1', from: 'running', to: 'review', note: DONE_LEFT_RUNNING_NOTE })
})
