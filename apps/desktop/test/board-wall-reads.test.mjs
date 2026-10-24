// 0.3.12 review i2 ER-3, ER-4, DA-3, DA-4: the wall between businesses reads every Project of the estate (archived ones
// included) by keyset, says why a read failed, and stops at its own deadline; a read that fails walls nothing (W2-5)
// and is logged.
// #region business-wall-reads-tests — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const src = (f) => path.resolve(import.meta.dirname, '../src/main', f)
const { readProjectFacts, readThreadParticipants } = await import(src('boardWallReads.ts'))
const { createBoard, directoryName } = await import(src('boardService.ts'))
const { useOps } = await import(src('opsSink.ts'))

// The operations log, captured.
const lines = []
useOps({ correlate: () => 'c', record: (r) => lines.push(r), begin: () => () => {}, read: () => [], file: () => '', lost: () => 0 })
const logged = (op) => lines.filter((l) => l.op === op).map((l) => `${l.error instanceof Error ? l.error.message : l.error} | ${l.detail?.note ?? ''}`)

// A Supabase-shaped fake of `projects`: filters, keyset and limit applied as PostgREST would; `afterPage` runs after
// each page is answered, so a test can change the table mid-read.
const projectsDb = (table, { afterPage = () => {}, error = null } = {}) => {
  const pages = []
  const from = () => {
    const q = { filters: [], gtId: null, lim: Infinity, signal: null }
    const b = {
      select: () => b,
      eq: (k, v) => { q.filters.push([k, v]); return b },
      gt: (k, v) => { assert.equal(k, 'id'); q.gtId = v; return b },
      range: () => { throw new Error('offset paging is not used') },
      order: (k) => { assert.equal(k, 'id'); return b },
      limit: (n) => { q.lim = n; return b },
      abortSignal: (s) => { q.signal = s; return b },
      then: (ok, ko) => {
        pages.push(q.gtId)
        if (error) return Promise.resolve({ data: null, error }).then(ok, ko)
        const rows = table.filter((r) => q.filters.every(([k, v]) => r[k] === v)).filter((r) => q.gtId === null || r.id > q.gtId)
          .sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, q.lim).map((r) => ({ ...r }))
        afterPage(pages.length)
        return Promise.resolve({ data: rows, error: null }).then(ok, ko)
      }
    }
    return b
  }
  return { db: { from }, pages }
}
const E = 'e1'
const id = (n) => `79000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const row = (n, extra = {}) => ({ id: id(n), estate_id: E, name: `p${n}`, business: null, repo_path: null, status: 'active', ...extra })

test('DA-4: archived Projects are read with their business, marked archived', async () => {
  const { db } = projectsDb([row(1, { business: 'Appvillis', status: 'archived' }), row(2, { business: 'PhoneCo' }), row(3, { estate_id: 'other' })])
  const facts = await readProjectFacts(db, E)
  assert.deepEqual(facts.map((f) => [f.name, f.business, f.archived]), [['p1', 'Appvillis', true], ['p2', 'PhoneCo', false]])
})

test('DA-3: paged by id above the last read, a Project created mid-read neither pushes another past a page nor is read twice', async () => {
  const table = Array.from({ length: 2500 }, (_, i) => row(i * 2 + 10))
  // After the first page, a Project whose id sorts inside the first page is created: offset paging would read the
  // row at the boundary twice (shifted by one); keyset paging reads every row once.
  const { db, pages } = projectsDb(table, { afterPage: (n) => { if (n === 1) table.push(row(11)) } })
  const facts = await readProjectFacts(db, E)
  const ids = facts.map((f) => f.id)
  assert.equal(new Set(ids).size, ids.length, 'no Project read twice')
  assert.equal(ids.length, 2500, 'every Project there at the start is read')
  assert.deepEqual(pages.slice(0, 2), [null, id(10 + 999 * 2)])
})

test('ER-3: a refused projects read throws with the database\'s reason', async () => {
  const { db } = projectsDb([], { error: { message: 'permission denied for table projects' } })
  await assert.rejects(readProjectFacts(db, E), /the projects could not be read: permission denied for table projects/)
})

// The reader's threads, as board_thread_page_operator answers them: `pages` pages, the thread on page `at` (or none).
const threadsDb = ({ pages, at, slowMs = 0 }) => {
  let calls = 0
  const rpc = (fn, args) => {
    assert.equal(fn, 'board_thread_page_operator')
    let signal = null
    const b = {
      abortSignal: (s) => { signal = s; return b },
      then: (ok, ko) => {
        const n = calls++
        const answer = { ok: true, threads: n === at ? [{ id: 't', participants: ['a', 'b'] }] : [{ id: `x${n}`, participants: [] }], more: n + 1 < pages, before: `c${n}` }
        return new Promise((r) => setTimeout(r, slowMs)).then(() => (signal?.aborted ? { data: null, error: { message: 'aborted' } } : { data: answer, error: null })).then(ok, ko)
      }
    }
    return b
  }
  return { db: { rpc }, calls: () => calls }
}

test('ER-4: a thread found on a later page answers its participants; one not found says why', async () => {
  assert.deepEqual(await readThreadParticipants(threadsDb({ pages: 5, at: 3 }).db, E, 'r', 't'), ['a', 'b'])
  await assert.rejects(readThreadParticipants(threadsDb({ pages: 3, at: -1 }).db, E, 'r', 't'), /not among the reader's threads/)
  await assert.rejects(readThreadParticipants(threadsDb({ pages: 60, at: -1 }).db, E, 'r', 't'), /not among the reader's newest 5000 threads/)
})

test('ER-4: a stopped signal ends the paging between pages', async () => {
  const t = threadsDb({ pages: 50, at: -1, slowMs: 5 })
  const stop = new AbortController()
  setTimeout(() => stop.abort(), 12)
  await assert.rejects(readThreadParticipants(t.db, E, 'r', 't', stop.signal), /before the wall's deadline|could not be read: aborted/)
  assert.ok(t.calls() < 5, `paging stopped after ${t.calls()} pages`)
})

// The wall itself, in the board service.
const caller = { estateId: '79000000-0000-4000-8000-000000000001', projectId: id(11), principal: { kind: 'agent', id: 'session-1', label: 'Claude Code', provenance: 'trusted' } }
const stored = { data: { ok: true, repeated: false, message: id(91), thread: id(92), at: '2026-10-23T00:00:00.000Z' }, error: null }
const board = (deps) => {
  const calls = []
  const rpc = async (fn, args) => { calls.push(fn); return fn === 'board_submit' ? stored : { data: null, error: { message: 'no answer' } } }
  return { board: createBoard({ rpc, ...deps }), calls }
}
const post = (key) => ({ idempotency: { epoch: 1, key }, thread: { id: id(92) }, kind: 'message', body: { text: 'hello' } })
const opened = (key, participants) => ({ idempotency: { epoch: 1, key }, thread: { new: { participants } }, kind: 'announcement', body: { text: 'hello' } })
const facts = [
  { id: caller.projectId, name: 'phone-bot', business: 'PhoneCo', repo: null },
  { id: id(22), name: 'messenger', business: 'Appvillis', repo: null, archived: true }
]

test('DA-4: an archived Project\'s business still walls a thread it takes part in', async () => {
  const { board: b, calls } = board({ projectFacts: async () => facts })
  const r = await b.submit(caller, opened('wall-arch-01', [id(22)]))
  assert.equal(r.error?.code, 'not_authorized')
  assert.match(r.error.message, /Appvillis \(messenger\)/)
  assert.equal(calls.length, 0)
})

test('ER-3: a projects read that answers null or throws lets the post through and is logged with its reason', async () => {
  lines.length = 0
  const nulled = board({ projectFacts: async () => null })
  assert.equal((await nulled.board.submit(caller, opened('wall-null-01', [id(22)]))).ok, true)
  assert.deepEqual(logged('board.project-facts-read'), ['no projects read | the wall between businesses is not checked for this post'])
  lines.length = 0
  const thrown = board({ projectFacts: async () => { throw new Error('the projects could not be read: permission denied') } })
  assert.equal((await thrown.board.submit(caller, opened('wall-null-02', [id(22)]))).ok, true)
  assert.deepEqual(logged('board.project-facts-read'), ['the projects could not be read: permission denied | the wall between businesses is not checked for this post'])
})

test('ER-4: the wall\'s reads stop at its deadline: the reads are told to stop, the post goes through, and the miss is logged', async () => {
  lines.length = 0
  let told = null
  const threadParticipants = (_e, _r, _t, signal) => new Promise((resolve) => { signal.addEventListener('abort', () => { told = true; resolve(null) }) })
  const { board: b, calls } = board({ projectFacts: async () => facts, threadParticipants, wallDeadlineMs: 30 })
  const began = Date.now()
  const r = await b.submit(caller, post('wall-late-01'))
  assert.equal(r.ok, true)
  assert.ok(Date.now() - began < 1000, 'answered at the deadline, not when the reads end')
  assert.equal(told, true, 'the reads were told to stop')
  assert.deepEqual(calls, ['board_submit'])
  assert.deepEqual(logged('board.wall-deadline'), ['the wall\'s reads did not finish within 30 ms | the wall between businesses is not checked for this post; it goes through'])
})

test('a thread\'s participants that fail to read are logged with their reason, and the post goes through', async () => {
  lines.length = 0
  const { board: b } = board({ projectFacts: async () => facts, threadParticipants: async () => { throw new Error('the thread is not among the reader\'s newest 5000 threads') } })
  assert.equal((await b.submit(caller, post('wall-miss-01'))).ok, true)
  assert.deepEqual(logged('board.thread-participants-read'), ['the thread is not among the reader\'s newest 5000 threads | the wall between businesses is not checked for this post'])
})
test('DA-4: an archived namesake does not rename a Project in the directory', () => {
  const named = [{ id: id(31), name: 'site', business: null, repo: '/w/site' }, { id: id(32), name: 'site', business: null, repo: '/w/old-site', archived: true }]
  assert.equal(directoryName(id(31), 'site', named), 'site')
  assert.equal(directoryName(id(31), 'site', [...named, { id: id(33), name: 'Site', business: null, repo: '/w/site-2' }]), 'site (site)')
})
// #endregion business-wall-reads-tests
