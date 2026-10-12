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
