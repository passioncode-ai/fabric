// fabric_work_release {claims: "session"} reads the projection back (0.3.5 review ER-8), as the single-claim branch
// does and the module header promises: the answer is what the projection holds after the writes, never assumed from
// them. Pure: the read and the append are stand-ins with the shapes workTools.ts gives them.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { releaseEveryOwnClaim } = await import(path.resolve(import.meta.dirname, '../src/main/workTools.ts'))

const A = { id: 'a', work_id: 'w1' }
const B = { id: 'b', work_id: 'w2' }

/** A projection that releases what the appends name, except the ids in `ignored`; `failOn` makes that append throw. */
function world(live, { ignored = [], failOn = null, readFails = 0 } = {}) {
  let rows = [...live]
  let reads = 0
  return {
    appended: [],
    read: async () => { if (++reads > 1 && readFails-- > 0) throw new Error('the claims could not be read'); return [...rows] },
    release: async function (c) {
      if (c.id === failOn) throw new Error('append refused')
      this.appended.push(c.id)
      if (!ignored.includes(c.id)) rows = rows.filter((r) => r.id !== c.id)
      return this.appended.length
    }
  }
}

test('every live claim released and read back: released, with the ids', async () => {
  const w = world([A, B])
  assert.deepEqual(await releaseEveryOwnClaim(w.read, w.release.bind(w)), { released: true, claims: ['a', 'b'] })
})

test('no live claim: released, and said', async () => {
  const w = world([])
  assert.deepEqual(await releaseEveryOwnClaim(w.read, w.release.bind(w)), { released: true, claims: [], note: 'this session holds no live claim' })
})

test('a release the projection ignored is unconfirmed, never reported as done', async () => {
  const w = world([A, B], { ignored: ['b'] })
  const r = await releaseEveryOwnClaim(w.read, w.release.bind(w))
  assert.equal(r.released, false)
  assert.equal(r.code, 'unconfirmed')
  assert.deepEqual(r.claims, ['a'])
  assert.deepEqual(r.unconfirmed, ['b'])
  assert.match(r.reason, /fabric_work_list/)
})

test('an append that throws midway: the ids released so far, the one that failed and the ones not tried', async () => {
  const w = world([A, B, { id: 'c', work_id: 'w3' }], { failOn: 'b' })
  const r = await releaseEveryOwnClaim(w.read, w.release.bind(w))
  assert.equal(r.released, false)
  assert.equal(r.code, 'partial')
  assert.deepEqual(r.claims, ['a'])
  assert.deepEqual(r.unconfirmed, ['b', 'c'])
  assert.match(r.reason, /append refused/)
})

test('a read-back that fails: nothing is claimed as released', async () => {
  const w = world([A], { readFails: 1 })
  const r = await releaseEveryOwnClaim(w.read, w.release.bind(w))
  assert.equal(r.released, false)
  assert.equal(r.code, 'unconfirmed')
  assert.deepEqual(r.claims, [])
  assert.deepEqual(r.unconfirmed, ['a'])
})

test('the tool answers through it', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(path.resolve(import.meta.dirname, '../src/main/workTools.ts'), 'utf8')
  const branch = src.slice(src.indexOf("if (claims === 'session') {"), src.indexOf("if (!claimId && !taskId)"))
  assert.match(branch, /releaseEveryOwnClaim\(/)
})

// ── done → review is a second write (0.3.5 review i2 ER-8) ─────────────────────────────────────────────────────
// Releasing a claim as done appends the release, then the task's move to review. The move is READ BACK, and a
// repeat of a done release whose move did not land finishes it, so a retry never reports success while the task
// still sits in running.
const { moveDoneTaskToReview } = await import(path.resolve(import.meta.dirname, '../src/main/workTools.ts'))

function board(status, { failMove = false, ignoreMove = false, failRead = false } = {}) {
  let st = status
  return {
    moves: 0,
    read: async () => { if (failRead) throw new Error('the board could not be read'); return st === null ? null : { id: 't1', status: st } },
    move: async function () { this.moves++; if (failMove) throw new Error('append refused'); if (!ignoreMove) st = 'review' }
  }
}

test('done: the task moves to review and the answer says so from the read-back', async () => {
  const b = board('running')
  assert.deepEqual(await moveDoneTaskToReview(b.read, (t) => b.move(t)), { task_moved_to: 'review', task_status: 'review' })
  assert.equal(b.moves, 1)
})

test('done: a move that throws or that the projection ignored is said, never reported as moved', async () => {
  const thrown = board('running', { failMove: true })
  const a = await moveDoneTaskToReview(thrown.read, (t) => thrown.move(t))
  assert.equal(a.task_moved_to, null)
  assert.equal(a.task_status, 'running')
  assert.match(a.failed, /append refused/)
  const ignored = board('running', { ignoreMove: true })
  const b = await moveDoneTaskToReview(ignored.read, (t) => ignored.move(t))
  assert.deepEqual([b.task_moved_to, b.task_status], [null, 'running'])
  assert.match(b.failed, /could not be confirmed/)
  const unread = board('running', { failRead: true })
  const c = await moveDoneTaskToReview(unread.read, (t) => unread.move(t))
  assert.equal(c.task_moved_to, null)
  assert.match(c.failed, /could not be read/)
})

test('done, again: a task already in review is not moved twice; no board task, or a closed one, moves nothing', async () => {
  const again = board('review')
  assert.deepEqual(await moveDoneTaskToReview(again.read, (t) => again.move(t)), { task_moved_to: 'review', task_status: 'review' })
  assert.equal(again.moves, 0)
  const none = board(null)
  assert.deepEqual(await moveDoneTaskToReview(none.read, (t) => none.move(t)), { task_moved_to: null, task_status: null })
  const closed = board('done')
  assert.deepEqual(await moveDoneTaskToReview(closed.read, (t) => closed.move(t)), { task_moved_to: null, task_status: 'done' })
  assert.equal(none.moves + closed.moves, 0)
})

test('fabric_work_release goes through the read-back move on a first done release AND on a repeat of one (source)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(path.resolve(import.meta.dirname, '../src/main/workTools.ts'), 'utf8')
  const tool = src.slice(src.indexOf("'fabric_work_release',"), src.indexOf("'fabric_session_observe',"))
  const repeat = tool.slice(tool.indexOf('const toReview'), tool.indexOf('const handedTo'))
  assert.match(repeat, /ending === 'done' && row\.released_how === 'done'/, 'a repeat of a done release finishes its move')
  assert.match(repeat, /const toReview = \(taskId: string\) =>\s*moveDoneTaskToReview\(/)
  assert.match(repeat, /row\.released_how === 'done' && row\.released_at\) \{\s*const m = await toReview\(/)
  const first = tool.slice(tool.indexOf('const handedTo'))
  assert.match(first, /await toReview\(/)
  assert.doesNotMatch(first, /moved = 'review'/, 'never reported from the append')
})
