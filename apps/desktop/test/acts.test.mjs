// The act log and its inverse, pure: no database, no Electron (0.3.7 wave 2, ADR-0160 §2, SCN-168, SCN-169).
// The real executors (task, folder, claim, project, question) are probed against a disposable stack in
// acts-db.test.mjs; here the logic that is the same for every act: one record shape, do → undo → redo, the
// refusals, the reading of a page with its undo state, and the two executors that touch no database (a console, a draft).
import test from 'node:test'
import assert from 'node:assert/strict'
import { ACT_KINDS, WHY_NOT, buildRecord, validateActRecord, analyseActs, undoStateOf, categoryOf } from '../src/shared/acts.ts'
import { createActs } from '../src/main/acts.ts'
import { createSessionExecutors, sessionStopOutcome } from '../src/main/actSessionExecutors.ts'
import { createDrafts } from '../src/main/onboardingDrafts.ts'
import { actQueryOf, answerOf } from '../src/main/actIpc.ts'
import { createActLog } from '../src/main/actLog.ts'

const ME = { kind: 'person', id: 'operator' }
const outcome = (over = {}) => ({
  kind: 'task.move', projectId: 'p1', subject: { type: 'task', id: 't1', label: 'Сборка' },
  said: { key: 'act.task.move', params: { from: 'running', to: 'review' } },
  inverse: { kind: 'task.move', args: { task_id: 't1', to: 'running', expect: 'review' } }, refSeq: 11, ...over
})

// An in-memory journal of act.recorded rows, shaped like the real log (actLog.ts).
function memoryLog() {
  const rows = []
  let seq = 100
  return {
    rows,
    async append(record, projectId, actor) { const row = { seq: ++seq, occurredAt: new Date(1e12 + seq * 1000).toISOString(), actor, projectId, record }; rows.push(row); return { seq: row.seq } },
    async page(q) {
      let r = [...rows].sort((a, b) => b.seq - a.seq)
      if (q.before) r = r.filter((x) => x.seq < q.before)
      if (q.actorKind) r = r.filter((x) => x.actor.kind === q.actorKind)
      if (q.projectId) r = r.filter((x) => x.projectId === q.projectId)
      if (q.category) r = r.filter((x) => x.record.category === q.category)
      if (q.text) r = r.filter((x) => (x.record.subject.label ?? '').toLowerCase().includes(q.text.toLowerCase()))
      return r.slice(0, q.limit)
    },
    async reversersOf(seqs) { return rows.filter((x) => x.record.undoes !== null && seqs.includes(x.record.undoes)) },
    async get(seq) { return rows.find((x) => x.seq === seq) ?? null }
  }
}

// A world of tasks, and the same inverse the real executor builds: moving a task records how to move it back.
function taskWorld() {
  const tasks = new Map([['t1', 'running']])
  const moves = []
  const executors = {
    'task.move': {
      async check({ task_id, to, expect }) {
        const now = tasks.get(task_id)
        if (!now) return { ok: false, why: 'task_gone' }
        if (now === to) return { ok: false, why: 'already_there' }
        return { ok: true, ...(expect && expect !== now ? { changedSince: `now ${now}` } : {}) }
      },
      async run({ task_id, to }) {
        const from = tasks.get(task_id)
        tasks.set(task_id, to); moves.push([task_id, from, to])
        return outcome({ said: { key: 'act.task.move', params: { from, to } }, inverse: { kind: 'task.move', args: { task_id, to: from, expect: to } } })
      }
    }
  }
  return { tasks, moves, executors }
}

const acts = (world, log = memoryLog()) => ({ log, a: createActs({ log, executors: world.executors, actor: ME, onRecordFailed: () => {} }) })

test('the record: one shape, a category from the kind, and an act that cannot be undone says why', () => {
  const r = buildRecord(outcome(), null)
  assert.equal(r.category, 'tasks'); assert.equal(r.v, 1); assert.equal(r.undoes, null); assert.equal(r.why_not, null)
  assert.deepEqual(validateActRecord(JSON.parse(JSON.stringify(r))), r)
  assert.throws(() => buildRecord(outcome({ inverse: null }), null), /must say why/)
  assert.throws(() => buildRecord(outcome({ whyNot: 'published' }), null), /both an inverse and a reason/)
  const nothing = buildRecord(outcome({ kind: 'release.record', inverse: null, whyNot: 'published' }), null)
  assert.equal(nothing.inverse, null); assert.equal(nothing.why_not, 'published'); assert.equal(nothing.category, 'releases')
  for (const k of ACT_KINDS) assert.ok(categoryOf(k))
  assert.ok(WHY_NOT.includes('published'))
})

test('the record is validated on the way out of the journal: another shape is not shown', () => {
  const good = buildRecord(outcome(), null)
  for (const bad of [null, [], { ...good, v: 2 }, { ...good, kind: 'task.explode' }, { ...good, category: 'folders' },
    { ...good, inverse: null }, { ...good, why_not: 'published' }, { ...good, undoes: 0 }, { ...good, subject: { type: 'task' } },
    { ...good, inverse: { kind: 'task.move', args: { a: { nested: 1 } } } }, { ...good, said: { key: 'k', params: { x: {} } } }])
    assert.equal(validateActRecord(bad), null, JSON.stringify(bad)?.slice(0, 80))
})

test('analysis: the last word on an act is what it is now (undone, redone, undone again)', () => {
  const row = (seq, undoes) => ({ seq, occurredAt: '', actor: ME, projectId: null, record: buildRecord(outcome(), undoes) })
  const a = row(5, null), u = row(6, 5), r = row(7, 6), r2 = row(8, 7)
  assert.deepEqual([...analyseActs([a]).undone], [])
  assert.deepEqual([...analyseActs([a, u]).undone], [5])
  assert.deepEqual([...analyseActs([a, u, r]).undone], [6])        // the undo was undone: the act is in force
  assert.deepEqual([...analyseActs([a, u, r, r2]).undone].sort(), [5, 7])  // and again: the act is undone, the redo is too
  assert.equal(undoStateOf(a, analyseActs([a, u])).state, 'undone')
  assert.equal(undoStateOf(u, analyseActs([a, u])).state, 'available')
  const fixed = row(9, null); fixed.record = buildRecord(outcome({ inverse: null, whyNot: 'delivered' }), null)
  assert.deepEqual(undoStateOf(fixed, analyseActs([fixed])), { state: 'cannot', why: 'delivered' })
})

test('do, undo, redo: each is an act with its actor, and the world is back each time', async () => {
  const world = taskWorld(); const { log, a } = acts(world)
  const done = await a.perform('task.move', { task_id: 't1', to: 'review' })
  assert.equal(done.ok, true); assert.equal(world.tasks.get('t1'), 'review')
  assert.equal(log.rows.length, 1); assert.deepEqual(log.rows[0].actor, ME); assert.equal(log.rows[0].record.undoes, null)

  const undone = await a.undo(done.seq)
  assert.equal(undone.ok, true); assert.equal(world.tasks.get('t1'), 'running')
  assert.equal(log.rows.length, 2); assert.equal(log.rows[1].record.undoes, done.seq)
  assert.deepEqual(log.rows[1].actor, ME)

  const redone = await a.undo(undone.seq)       // undo of an undo is allowed: it does the act again
  assert.equal(redone.ok, true); assert.equal(world.tasks.get('t1'), 'review')
  assert.equal(log.rows[2].record.undoes, undone.seq)
  assert.deepEqual(world.moves.map((m) => m[2]), ['review', 'running', 'review'])
})

test('a second press does not double the inverse: the act is already undone', async () => {
  const world = taskWorld(); const { log, a } = acts(world)
  const done = await a.perform('task.move', { task_id: 't1', to: 'review' })
  const [first, second] = await Promise.all([a.undo(done.seq), a.undo(done.seq)])
  assert.equal([first, second].filter((r) => r.ok).length, 1)
  assert.equal(log.rows.length, 2)
  const third = await a.undo(done.seq)
  assert.deepEqual([third.ok, third.reason], [false, 'already_undone'])
  assert.equal(world.moves.length, 2)
})

test('an act with no inverse is refused with its reason, before and after', async () => {
  const world = taskWorld(); const { a } = acts(world)
  const noted = await a.note(outcome({ kind: 'release.record', inverse: null, whyNot: 'published' }))
  assert.equal(noted.recorded, true)
  const refused = await a.undo(noted.seq)
  assert.deepEqual([refused.ok, refused.reason], [false, 'published'])
  const view = (await a.history({})).rows[0]
  assert.deepEqual(view.undo, { state: 'cannot', why: 'published' })
  const missing = await a.undo(99999)
  assert.deepEqual([missing.ok, missing.reason], [false, 'not_an_act'])
})

test('changed since: the undo still says what it would do now and does it; gone: nothing changes', async () => {
  const world = taskWorld(); const { log, a } = acts(world)
  const done = await a.perform('task.move', { task_id: 't1', to: 'review' })
  world.tasks.set('t1', 'backlog')                      // another agent moved it since
  const view = (await a.history({})).rows[0]
  assert.equal(view.undo.state, 'available'); assert.match(view.undo.changedSince, /backlog/)
  assert.equal((await a.undo(done.seq)).ok, true); assert.equal(world.tasks.get('t1'), 'running')

  const w2 = taskWorld(); const { log: l2, a: a2 } = acts(w2)
  const d2 = await a2.perform('task.move', { task_id: 't1', to: 'review' })
  w2.tasks.delete('t1')
  assert.deepEqual((await a2.history({})).rows[0].undo, { state: 'cannot', why: 'task_gone' })
  const gone = await a2.undo(d2.seq)
  assert.deepEqual([gone.ok, gone.reason], [false, 'task_gone']); assert.equal(l2.rows.length, 1)
  assert.equal(log.rows.length, 2)
})

test('a failed act records nothing and a record that fails to write does not undo the act', async () => {
  const world = taskWorld()
  world.executors['task.move'].run = async () => { throw new Error('the database is away') }
  const { log, a } = acts(world)
  const failed = await a.perform('task.move', { task_id: 't1', to: 'review' })
  assert.deepEqual([failed.ok, failed.reason], [false, 'failed']); assert.match(failed.says, /database is away/); assert.equal(log.rows.length, 0)

  const w2 = taskWorld(); const broken = memoryLog(); broken.append = async () => { throw new Error('journal down') }
  const seen = []
  const a2 = createActs({ log: broken, executors: w2.executors, actor: ME, onRecordFailed: (k, e) => seen.push([k, e.message]) })
  const done = await a2.perform('task.move', { task_id: 't1', to: 'review' })
  assert.equal(done.ok, true); assert.equal(done.seq, null); assert.equal(w2.tasks.get('t1'), 'review')
  assert.deepEqual(seen, [['task.move', 'journal down']])
})

test('history: newest first, paged, filtered by actor, project, kind and words; undone acts carry their reversal', async () => {
  const world = taskWorld(); const { log, a } = acts(world)
  await a.note(outcome({ kind: 'repo.detach', projectId: 'p2', subject: { type: 'repo', id: 'r1', label: 'api-server' }, said: { key: 'act.repo.detach', params: {} }, inverse: { kind: 'repo.attach', args: { repo_id: 'r1' } } }))
  const moved = await a.perform('task.move', { task_id: 't1', to: 'review' })
  await a.undo(moved.seq)
  await a.note(outcome({ kind: 'release.record', projectId: 'p1', inverse: null, whyNot: 'published', subject: { type: 'release', id: 'v1', label: '0.3.7' } }), { actor: { kind: 'system', id: 'fabric' } })

  const all = await a.history({ limit: 2 })
  assert.deepEqual(all.rows.map((r) => r.record.kind), ['release.record', 'task.move']); assert.equal(all.rows[1].record.undoes, moved.seq); assert.equal(typeof all.next, 'number')
  const rest = await a.history({ limit: 10, before: all.next })
  assert.deepEqual(rest.rows.map((r) => r.record.kind), ['task.move', 'repo.detach']); assert.equal(rest.next, null)
  const original = rest.rows.find((r) => r.seq === moved.seq)
  assert.deepEqual(original.undo, { state: 'undone', by: original.undo.by }); assert.ok(original.undo.by > moved.seq)
  assert.equal((await a.history({ category: 'folders' })).rows.length, 1)
  assert.equal((await a.history({ projectId: 'p2' })).rows[0].record.subject.label, 'api-server')
  assert.equal((await a.history({ actorKind: 'system' })).rows.length, 1)
  assert.equal((await a.history({ text: 'API' })).rows.length, 1)
  assert.equal((await a.history({ text: 'нет такого' })).rows.length, 0)
  assert.equal(log.rows.length, 4)
})

test('a console: stop records how it stood; start again opens it where it stood and records how to stop it', async () => {
  const snapshot = { sessionId: 's1', projectId: 'p1', optionId: 'claude-code', permissionMode: 'ask', cwd: '/work/api', label: 'Claude Code' }
  const stopped = sessionStopOutcome(snapshot, { sessionId: 's1', state: 'stopped', reasonCode: 'ok', taskId: 't9' }, 'Проект')
  assert.equal(stopped.kind, 'session.stop'); assert.deepEqual(stopped.inverse.args, { project_id: 'p1', option_id: 'claude-code', permission_mode: 'ask', cwd: '/work/api', task_id: 't9', from_session: 's1' })
  assert.equal(sessionStopOutcome(snapshot, { sessionId: 's1', state: 'refused', reasonCode: 'x' }, 'Проект'), null)   // nothing was stopped: nothing to record
  assert.equal(sessionStopOutcome(snapshot, { sessionId: 's1', state: 'outcome_unknown', reasonCode: 'x' }, 'Проект'), null)

  const opened = []; const ended = []
  const ex = createSessionExecutors({
    runnerAvailable: async (id) => id !== 'gone',
    startAgain: async (args) => { opened.push(args); return { sessionId: 's2', label: 'Claude Code' } },
    stop: async (sessionId) => { ended.push(sessionId); return { sessionId, state: 'stopped', reasonCode: 'ok' } },
    snapshot: (id) => (id === 's2' ? { ...snapshot, sessionId: 's2' } : null),
    projectName: async () => 'Проект'
  })
  const world = { executors: ex }; const { log, a } = acts(world)
  const first = await a.note(stopped)
  const back = await a.undo(first.seq)
  assert.equal(back.ok, true); assert.deepEqual(opened, [stopped.inverse.args])
  assert.deepEqual(log.rows[1].record.inverse, { kind: 'session.stop', args: { session_id: 's2' } })
  const again = await a.undo(back.seq)             // undo of the start: stop the new console
  assert.equal(again.ok, true); assert.deepEqual(ended, ['s2'])

  const gone = await a.note({ ...stopped, inverse: { kind: 'session.start', args: { ...stopped.inverse.args, option_id: 'gone' } } })
  const refused = await a.undo(gone.seq)
  assert.deepEqual([refused.ok, refused.reason], [false, 'runner_gone'])
})

test('a draft: discard keeps it where the person keeps their own state, restore puts it back, both are acts', async () => {
  let file = {}, trash = {}
  const mk = (get, set) => ({ read: () => ({ status: 'ready', value: get() }), update: (change) => { set(change(get())); return { status: 'committed' } } })
  const drafts = createDrafts(mk(() => file, (v) => { file = v }), mk(() => trash, (v) => { trash = v }), () => new Date(1e12).toISOString(), () => 'd-1')
  const draft = { projectId: 'p9', name: 'Новый проект', purpose: 'про что', repoPaths: ['/x'], memory: 'local', agent: 'claude-code' }
  file = { 'tab-1': draft }
  const { createDraftExecutors } = await import('../src/main/actDraftExecutors.ts')
  const { log, a } = acts({ executors: createDraftExecutors(drafts) })
  const done = await a.perform('draft.discard', { tab_id: 'tab-1' })
  assert.equal(done.ok, true); assert.deepEqual(file, {}); assert.equal(trash['d-1'].draft.name, 'Новый проект')
  assert.equal(log.rows[0].record.subject.label, 'Новый проект'); assert.equal(JSON.stringify(log.rows[0].record).includes('про что'), false) // the words stay local
  const back = await a.undo(done.seq)
  assert.equal(back.ok, true); assert.deepEqual(file['tab-1'], draft); assert.deepEqual(trash, {})
  const again = await a.undo(back.seq)             // discarded again: restorable again
  assert.equal(again.ok, true); assert.deepEqual(file, {}); assert.equal(Object.keys(trash).length, 1)
  // a tab that was opened in its place meanwhile: the draft comes back under its own id, nothing is overwritten
  file = { 'tab-1': { ...draft, name: 'другой' } }
  const third = await a.undo(again.seq)
  assert.equal(third.ok, true); assert.equal(file['tab-1'].name, 'другой'); assert.equal(Object.values(file).filter((d) => d.name === 'Новый проект').length, 1)
  const none = await a.perform('draft.discard', { tab_id: 'no-such' })
  assert.deepEqual([none.ok, none.reason], [false, 'draft_gone'])
})

test('the renderer\'s query is read defensively and an answer carries no internals', () => {
  assert.deepEqual(actQueryOf(undefined), {}); assert.deepEqual(actQueryOf([]), {}); assert.deepEqual(actQueryOf('x'), {})
  assert.deepEqual(actQueryOf({ limit: 5000, before: 12.5, actorKind: 'root', projectId: 'nope', category: 'secrets', text: '   ', extra: 1 }), { limit: 100 })
  assert.deepEqual(actQueryOf({ limit: 20, before: 40, actorKind: 'person', category: 'tasks', text: ' api ', projectId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA' }),
    { limit: 20, before: 40, actorKind: 'person', category: 'tasks', text: 'api', projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
  assert.deepEqual(answerOf({ ok: true, seq: 7, outcome: outcome() }), { ok: true, seq: 7 })
  assert.deepEqual(answerOf({ ok: false, reason: 'ladder', says: 'closed' }), { ok: false, reason: 'ladder', says: 'closed' })
  assert.deepEqual(answerOf({ ok: false, reason: 'task_gone' }), { ok: false, reason: 'task_gone' })
})

// 0.3.7 release review DA-7: История's reversal read is served by migration 112's partial index
// `journal_acts_reversals` only when the query says `type = act.recorded@1`; without it PostgreSQL scans the estate's
// journal per chunk (measured at 200 000 events: a sequential scan, 24 ms, against 0.06 ms on the index).
test('the reversal read names the act type in its query, chunk by chunk, and still reads only acts', async () => {
  const undoing = (seq, undoes) => ({ seq, occurred_at: '2026-10-20T10:00:00Z', actor: ME, project_id: 'p1', type: 'act.recorded@1', payload: buildRecord(outcome(), undoes) })
  const journal = [
    undoing(501, 11), undoing(502, 260),
    // Another event type whose payload also carries `undoes` (a revoked run-over attestation): never an act.
    { seq: 503, occurred_at: '2026-10-20T10:00:00Z', actor: ME, project_id: 'p1', type: 'run.stop_attestation_revoked@1', payload: { undoes: '12' } }
  ]
  const reads = []
  const field = (row, c) => c === 'type' ? row.type : c === 'payload->>undoes' ? (row.payload.undoes === null || row.payload.undoes === undefined ? undefined : String(row.payload.undoes)) : undefined
  const store = {
    select(_table, _columns) {
      const read = { eq: [], in: null }
      reads.push(read)
      const q = {
        eq(c, v) { read.eq.push([c, v]); return q },
        in(c, values) { read.in = [c, values.length]; const rows = journal.filter((r) => read.eq.every(([k, v]) => field(r, k) === v) && values.includes(field(r, c))); return Promise.resolve({ data: rows, error: null }) }
      }
      return q
    },
    async selectIn(_table, _columns, column, values, chunk = 100, _signal, eq = []) {
      // As scopedStore.selectIn: one request per chunk, each carrying the given equalities.
      for (let i = 0; i < values.length; i += chunk) reads.push({ eq: [...eq], in: [column, Math.min(chunk, values.length - i)] })
      return { rows: journal.filter((r) => eq.every(([k, v]) => field(r, k) === v) && values.includes(field(r, column))), failed: null }
    }
  }
  const log = createActLog({ journal: { append: async () => { throw new Error('unused') } }, store, estateId: 'e1' })
  const seqs = Array.from({ length: 260 }, (_, i) => i + 1)
  const found = await log.reversersOf(seqs)
  assert.deepEqual(found.map((r) => r.seq), [501, 502])
  assert.ok(reads.length >= 3, 'a growing frontier is read in bounded chunks')
  for (const r of reads) {
    assert.deepEqual(r.eq, [['type', 'act.recorded@1']], 'every chunk names the act type, so the partial index serves it')
    assert.equal(r.in[0], 'payload->>undoes')
    assert.ok(r.in[1] <= 100)
  }
})

test('a refused reversal chunk is an error, never "nothing undid it"', async () => {
  const store = { select: () => { const q = { eq: () => q, in: async () => ({ data: null, error: { message: 'URI too long' } }) }; return q }, selectIn: async () => ({ rows: [], failed: 'journal.payload->>undoes could not be read (414): URI too long' }) }
  const log = createActLog({ journal: { append: async () => ({ seq: 1 }) }, store, estateId: 'e1' })
  await assert.rejects(log.reversersOf([1, 2]), /the act log could not be read \(reversals\)/)
})
