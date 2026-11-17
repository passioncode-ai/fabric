// ADR-0195 W2a.2: the board's memory both the window's doors and the board use (`main/boardState.ts`). Plan:
// docs/evidence/plans/2026-11-17-board-apart-waves.md §3. No database: the enrolled sessions are a stand-in.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createBoardState, personEnded, slot } = await import(path.resolve(import.meta.dirname, '../src/main/boardState.ts'))

test('a session the person ended is read once, by its end, and never again', () => {
  const p = personEnded()
  p.mark('s1')
  assert.equal(p.take('s1'), true)
  assert.equal(p.take('s1'), false)
  assert.equal(p.take('never-marked'), false)
})

test('the marks keep the newest, at most the bound, the oldest dropped first', () => {
  const p = personEnded(3)
  for (const id of ['a', 'b', 'c']) p.mark(id)
  p.mark('a') // marked again: newest now
  p.mark('d') // drops b, the oldest
  assert.equal(p.take('b'), false)
  for (const id of ['a', 'c', 'd']) assert.equal(p.take(id), true)
})

test('a binding or a grant the person revokes marks its enrolled sessions, and nobody before the hub exists', () => {
  const p = personEnded()
  p.markBinding('bind-1')
  p.markGrant('grant-1')
  assert.equal(p.take('x'), false)
  p.attach({
    liveOf: (bindingId) => (bindingId === 'bind-1' ? [{ sessionId: 's-b1' }, { sessionId: 's-b2' }] : []),
    idsForGrant: (grantId) => (grantId === 'grant-1' ? ['s-g1'] : [])
  })
  p.markBinding('bind-1')
  p.markGrant('grant-1')
  p.markGrant('grant-other')
  for (const id of ['s-b1', 's-b2', 's-g1']) assert.equal(p.take(id), true)
})

test('a slot reads null until set, then what was set, and null again when cleared', () => {
  const s = slot()
  assert.equal(s.get(), null)
  s.set(7)
  assert.equal(s.get(), 7)
  s.set(null)
  assert.equal(s.get(), null)
})

test('one state object: every part starts empty and each instance is its own', () => {
  const a = createBoardState()
  const b = createBoardState()
  for (const part of ['dispatchWake', 'dispatcher', 'sweep', 'stackHealth']) assert.equal(a[part].get(), null)
  a.branches.set('s1', 'feat/x')
  assert.equal(a.branches.get('s1'), 'feat/x')
  assert.equal(b.branches.get('s1'), null)
  a.personEnded.mark('s1')
  assert.equal(b.personEnded.take('s1'), false)
})
