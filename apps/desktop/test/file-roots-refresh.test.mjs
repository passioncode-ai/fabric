// The file roots are every attached repository, or they stay as they were (release review 2026-10-03,
// iteration 2, data finding 3).
//
// `refreshFileRoots` read `project_repos` in one request and reset the roots to the answer. The gateway
// caps an answer at 1000 rows and says nothing about the rest, so past 1000 repositories folders the
// operator opened closed silently and git watching dropped them. The FAKE IS THE DATABASE (R-007): the
// store is the real `createScopedStore`, over a PostgREST-shaped client capped at 1000 rows.
//
// Pure: no database, no network.
import assert from 'node:assert/strict'
import { refreshFileRootsFrom } from '../src/main/fileRootsRefresh.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'

const MAX_ROWS = 1000
function fakeDb(rows, { failOnPage = null } = {}) {
  let pages = 0
  return {
    from() {
      let from = 0, to = null, count = false
      const order = []
      const q = {
        select(_c, options = {}) { count = options.count === 'exact'; return q },
        eq() { return q },
        order(c) { order.push(c); return q },
        range(a, b) { from = a; to = b; return q },
        then(resolve) {
          pages++
          if (failOnPage !== null && pages === failOnPage) return Promise.resolve({ data: null, error: { message: 'connection reset', code: '08006' }, count: null }).then(resolve)
          // Unordered reads come back in whatever order the database likes: here, reversed.
          let out = order.length ? [...rows].sort((x, y) => String(x.path).localeCompare(String(y.path))) : [...rows].reverse()
          out = out.slice(from, to === null ? undefined : to + 1).slice(0, MAX_ROWS)
          return Promise.resolve({ data: out, error: null, count: count ? rows.length : null }).then(resolve)
        }
      }
      return q
    }
  }
}
const repos = (n) => Array.from({ length: n }, (_, i) => ({ path: `/w/repo-${String(i).padStart(5, '0')}`, estate_id: 'e1' }))
const store = (db) => createScopedStore(db, { kind: 'estate', estateId: 'e1' })

let failures = 0
const test = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')) }
}

await test('2 500 attached repositories are ALL roots — past the gateway cap, nothing drops', async () => {
  let applied = null
  const r = await refreshFileRootsFrom(store(fakeDb(repos(2500))), (p) => { applied = p }, () => {})
  assert.equal(r.state, 'replaced')
  assert.equal(applied?.length, 2500, `the roots were reset to ${applied?.length} of 2500 repositories`)
  assert.equal(new Set(applied).size, 2500, 'a page boundary repeated or skipped a repository')
})

await test('a failed page keeps the current roots and reports the failure — never a partial reset', async () => {
  let applied = null, reported = null
  const r = await refreshFileRootsFrom(store(fakeDb(repos(2500), { failOnPage: 2 })), (p) => { applied = p }, (m) => { reported = m })
  assert.equal(r.state, 'kept')
  assert.equal(applied, null, `the roots were reset to ${applied?.length} paths after a failed page`)
  assert.match(reported ?? '', /project_repos could not be read \(08006\): connection reset/)
})

await test('an empty estate is a real answer: no repositories, no roots', async () => {
  let applied = null
  const r = await refreshFileRootsFrom(store(fakeDb([])), (p) => { applied = p }, () => {})
  assert.equal(r.state, 'replaced')
  assert.deepEqual(applied, [])
})

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall green: the file roots are every attached repository, or unchanged')
