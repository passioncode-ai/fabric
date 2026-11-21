// The order of a project's queue (ADR-0208): the owner's rank, the dependency links and the critical path. Pure.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { orderQueue, rankWrites } = await import(path.resolve(import.meta.dirname, '../src/shared/taskRank.ts'))

let n = 0
const task = (id, over = {}) => ({ id, status: 'backlog', rank: null, filed: ++n, ...over })
const blocks = (a, b) => ({ taskId: a, rel: 'blocks', targetKind: 'task', targetId: b })
const follows = (a, b) => ({ taskId: a, rel: 'follows', targetKind: 'task', targetId: b })
const ids = (placed) => placed.map((p) => p.id)
const by = (placed, id) => placed.find((p) => p.id === id)

test('with no rank and no link the queue is in filing order', () => {
  assert.deepEqual(ids(orderQueue([task('a'), task('b'), task('c')], [])), ['a', 'b', 'c'])
})

test("the owner's rank comes first, lower first, and an unplaced task after every placed one", () => {
  const q = orderQueue([task('a'), task('b', { rank: 2 }), task('c', { rank: 1 })], [])
  assert.deepEqual(ids(q), ['c', 'b', 'a'])
  assert.deepEqual(q.map((p) => p.place), [1, 2, 3])
})

test('a task that waits for an open one is blocked and stands after the ready ones', () => {
  const q = orderQueue([task('late'), task('first'), task('free')], [blocks('first', 'late')])
  assert.deepEqual(ids(q), ['first', 'free', 'late'])
  assert.equal(by(q, 'late').ready, false)
  assert.deepEqual(by(q, 'late').waitsFor, ['first'])
  assert.equal(by(q, 'first').unblocks, 1)
})

test('follows reads the other way: the one that follows waits', () => {
  const q = orderQueue([task('after'), task('before')], [follows('after', 'before')])
  assert.deepEqual(ids(q), ['before', 'after'])
  assert.deepEqual(by(q, 'after').waitsFor, ['before'])
})

test('the critical path comes first among unplaced tasks: the head of the longest chain', () => {
  // x -> y (2 long), a -> b -> c (3 long), z alone and filed first.
  const q = orderQueue(
    [task('z'), task('x'), task('y'), task('a'), task('b'), task('c')],
    [blocks('x', 'y'), blocks('a', 'b'), blocks('b', 'c')]
  )
  assert.deepEqual(ids(q).slice(0, 3), ['a', 'x', 'z'])
  assert.equal(by(q, 'a').critical, true)
  assert.equal(by(q, 'b').critical, true)
  assert.equal(by(q, 'x').critical, false)
  assert.equal(by(q, 'z').critical, false, 'a task with no chain is never on the critical path')
  assert.deepEqual(ids(q).slice(3), ['b', 'c', 'y'], 'blocked tasks follow in an order their prerequisites allow')
})

test('a prerequisite inherits the rank of what waits for it', () => {
  // The owner put `goal` first; it waits for `base`. `other` is placed second.
  const q = orderQueue([task('other', { rank: 2 }), task('goal', { rank: 1 }), task('base')], [blocks('base', 'goal')])
  assert.deepEqual(ids(q), ['base', 'other', 'goal'])
  assert.equal(by(q, 'base').inherited, true)
  assert.equal(by(q, 'base').rank, null)
  assert.equal(by(q, 'other').inherited, false)
})

test("the owner's rank beats the critical path", () => {
  const q = orderQueue([task('a'), task('b'), task('mine', { rank: 1 })], [blocks('a', 'b')])
  assert.deepEqual(ids(q), ['mine', 'a', 'b'])
})

test('a closed or unknown prerequisite blocks nothing', () => {
  const q = orderQueue([task('t'), task('done', { status: 'done' }), task('gone', { status: 'cancelled' })], [blocks('done', 't'), blocks('gone', 't'), blocks('nowhere', 't')])
  assert.deepEqual(ids(q), ['t'])
  assert.equal(by(q, 't').ready, true)
})

test('a task in work blocks what waits for it and is itself never placed', () => {
  const q = orderQueue([task('wait'), task('going', { status: 'running', rank: 9 }), task('checked', { status: 'review' })], [blocks('going', 'wait')])
  assert.deepEqual(ids(q), ['wait'])
  assert.equal(by(q, 'wait').ready, false)
  assert.deepEqual(by(q, 'wait').waitsFor, ['going'])
})

test('a prerequisite always stands before what waits for it, whatever the ranks', () => {
  const q = orderQueue([task('c', { rank: 1 }), task('b', { rank: 5 }), task('a', { rank: 9 })], [blocks('a', 'b'), blocks('b', 'c')])
  assert.deepEqual(ids(q), ['a', 'b', 'c'])
})

test('a link to a goal, a spawned link and a self link are not dependencies', () => {
  const q = orderQueue([task('a'), task('b')], [
    { taskId: 'b', rel: 'blocks', targetKind: 'goal', targetId: 'a' },
    { taskId: 'b', rel: 'spawned', targetKind: 'task', targetId: 'a' },
    blocks('a', 'a')
  ])
  assert.deepEqual(ids(q), ['a', 'b'])
  assert.equal(q.every((p) => p.ready && !p.critical), true)
})

test('a cycle that reached the tables still gives every task one place', () => {
  const q = orderQueue([task('a'), task('b'), task('c')], [blocks('a', 'b'), blocks('b', 'a')])
  assert.deepEqual(ids(q).sort(), ['a', 'b', 'c'])
  assert.equal(ids(q)[0], 'c', 'the one task that waits for nothing comes first')
})

test('the same queue orders the same way twice', () => {
  const tasks = [task('a'), task('b'), task('c'), task('d')]
  const links = [blocks('c', 'a')]
  assert.deepEqual(orderQueue(tasks, links), orderQueue([...tasks].reverse(), [...links]))
})

// ── the owner's move ─────────────────────────────────────────────────────────────────────────────────────────────
const q = (...pairs) => pairs.map(([id, rank]) => ({ id, rank }))
const apply = (queue, writes) => queue.map((x) => ({ ...x, rank: writes.find((w) => w.taskId === x.id)?.rank ?? x.rank }))

test('a move between two placed tasks is one write, between their ranks', () => {
  const w = rankWrites(q(['a', 1], ['b', 2], ['c', 3]), 'c', 'a')
  assert.deepEqual(w, [{ taskId: 'c', rank: 1.5 }])
})

test('a move to the top is one write below the first rank', () => {
  assert.deepEqual(rankWrites(q(['a', 1], ['b', 2]), 'b', null), [{ taskId: 'b', rank: 0 }])
})

test('a move to the end is one write above the last rank', () => {
  assert.deepEqual(rankWrites(q(['a', 1], ['b', 2], ['c', 3]), 'a', 'c'), [{ taskId: 'a', rank: 4 }])
})

test('the first move in an unplaced queue places only the moved task when it goes first', () => {
  assert.deepEqual(rankWrites(q(['a', null], ['b', null], ['c', null]), 'c', null), [{ taskId: 'c', rank: 1 }])
})

test('a drop under unplaced tasks pins them too, so the list the owner arranged is the list he gets', () => {
  const queue = q(['a', null], ['b', null], ['c', null], ['d', null])
  const w = rankWrites(queue, 'd', 'b')
  assert.deepEqual(w.map((x) => x.taskId), ['a', 'b', 'd'])
  const after = apply(queue, w)
  assert.deepEqual(ids(orderQueue(after.map((x, i) => ({ ...x, status: 'backlog', filed: i })), [])), ['a', 'b', 'd', 'c'])
})

test('a drop between a placed and an unplaced task stays under the placed ones', () => {
  const queue = q(['a', 1], ['b', 2], ['c', null], ['d', null])
  assert.deepEqual(rankWrites(queue, 'd', 'b'), [{ taskId: 'd', rank: 3 }])
})

test('ranks above the drop that do not ascend are rewritten, the ones that fit are kept', () => {
  // The seen order is not the rank order (a blocked task shown lower, an inherited place): b has 7, shown above a (3).
  const queue = q(['b', 7], ['a', 3], ['c', null], ['z', 10])
  const w = rankWrites(queue, 'c', 'a')
  const after = apply(queue, w)
  const ranks = ['b', 'a', 'c', 'z'].map((id) => after.find((x) => x.id === id).rank)
  assert.deepEqual([...ranks].sort((x, y) => x - y), ranks, 'the ranks ascend in the order he arranged')
  assert.equal(after.find((x) => x.id === 'z').rank, 10, 'a task below the drop is not written')
})

test('a move that changes nothing writes nothing for a placed task', () => {
  assert.deepEqual(rankWrites(q(['a', 1], ['b', 2], ['c', 3]), 'b', 'a'), [])
})

test('a gap that ran out of numbers respaces the whole list', () => {
  const tight = 1 + Number.EPSILON
  const w = rankWrites(q(['a', 1], ['b', tight], ['c', 5]), 'c', 'a')
  assert.deepEqual(apply(q(['a', 1], ['b', tight], ['c', 5]), w).sort((x, y) => x.rank - y.rank).map((x) => x.id), ['a', 'c', 'b'])
  assert.equal(w.every((x) => Number.isInteger(x.rank)), true)
})

test('an id that is not in the queue, or a move onto itself, is refused', () => {
  assert.equal(rankWrites(q(['a', 1]), 'x', null), null)
  assert.equal(rankWrites(q(['a', 1], ['b', 2]), 'a', 'x'), null)
  assert.equal(rankWrites(q(['a', 1]), 'a', 'a'), null)
})
