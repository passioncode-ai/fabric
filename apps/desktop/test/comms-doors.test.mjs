// #region comms-doors-test — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
// ADR-0195 W2c.2b, the third group: the window's thirteen Comms doors as functions (`main/commsDoors.ts`), and the
// same functions served on the board's operator door. The board's read is a stand-in that records what it was asked;
// the door is a real loopback listener under a temporary root, called through the published files as the window will.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { COMMS_DOOR_NAMES, commsDoorTable, createCommsDoors } from '../src/main/commsDoors.ts'
import { callOperatorDoor, startOperatorDoor } from '../src/main/operatorDoor.ts'

const ESTATE = 'estate-1'
const P1 = '11111111-1111-4111-8111-111111111111'
const NOW = Date.parse('2026-11-21T12:00:00Z')

/** A board read that answers each door by its name and records the estate and arguments it was asked with. */
function standIn(over = {}) {
  const calls = []
  const said = (name) => async (...args) => { calls.push([name, ...args]); return { ok: true, door: name } }
  const read = {
    threads: said('threads'), list: said('list'), threadPage: said('threadPage'), heads: said('heads'), responders: said('responders'),
    facts: said('facts'), timeline: said('timeline'), related: said('related'), search: said('search'), pending: said('pending'),
    waiting: async (estate) => { calls.push(['waiting', estate]); return { ok: true, requests: 0 } },
    openArtifact: async (url) => { calls.push(['openArtifact', url]); return typeof url === 'string' && url.startsWith('https:') ? { ok: true } : { ok: false, reason: 'refused' } },
    ...over
  }
  // The journal as the project's requests read it: nothing filed, or a read that fails.
  const selects = []
  const store = (fail = null) => ({
    select: (table, columns) => {
      const call = { table, columns, eq: [] }
      selects.push(call)
      const chain = {
        eq: (c, v) => { call.eq.push([c, v]); return chain },
        gte: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(fail ? { data: null, error: { message: fail } } : { data: [], error: null })
      }
      return chain
    },
    selectIn: async () => ({ rows: [], failed: null })
  })
  const deps = { read, estateId: ESTATE, store: () => store(), now: () => NOW }
  return { read, deps, calls, selects, store }
}

test('the table serves exactly the thirteen doors of the window, each a name the operator door accepts', () => {
  const table = commsDoorTable(createCommsDoors(standIn().deps))
  assert.deepEqual([...table.keys()], [...COMMS_DOOR_NAMES])
  assert.equal(table.size, 13)
})

test('every read is asked for the serving process\'s estate, with the caller\'s arguments unchanged', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  assert.deepEqual(await doors.threads(), { ok: true, door: 'threads' })
  await doors.heads()
  await doors.responders()
  await doors.facts(['m-1', 'm-2'])
  await doors.timeline('req-1')
  await doors.related('th-1')
  await doors.search('доска', 40)
  await doors.pending()
  assert.deepEqual(s.calls, [
    ['threads', ESTATE], ['heads', ESTATE], ['responders', ESTATE], ['facts', ESTATE, ['m-1', 'm-2']],
    ['timeline', ESTATE, 'req-1'], ['related', ESTATE, 'th-1'], ['search', ESTATE, 'доска', 40], ['pending', ESTATE]
  ])
})

test('a page of messages: no thread is the estate\'s page, and a thread that is no string never widens to every thread', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  await doors.list(null, 0)
  await doors.list(undefined, 7, 20)
  await doors.list('th-1', 3, 'many')
  await doors.list({ id: 'th-1' }, 0)
  assert.deepEqual(s.calls, [
    ['list', ESTATE, null, 0, undefined], ['list', ESTATE, null, 7, 20], ['list', ESTATE, 'th-1', 3, undefined],
    // The empty thread is the one the read refuses as invalid (`commsOperatorRead.ts`), never the whole estate.
    ['list', ESTATE, '', 0, undefined]
  ])
})

test('a page of threads holds fifty unless the caller names a number', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  await doors.threadPage({ kind: 'request' }, null)
  await doors.threadPage({ kind: 'request' }, { at: 'x' }, 10)
  await doors.threadPage(null, null, '10')
  assert.deepEqual(s.calls, [
    ['threadPage', ESTATE, { kind: 'request' }, null, 50], ['threadPage', ESTATE, { kind: 'request' }, { at: 'x' }, 10], ['threadPage', ESTATE, null, null, 50]
  ])
})

test('what waits is the board\'s count with its list; callers meanwhile share the one reading, and unavailable travels unchanged', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  const [a, b] = await Promise.all([doors.waiting(), doors.waiting()])
  assert.deepEqual(a, { ok: true, requests: 0, list: [], listComplete: true })
  assert.equal(a, b)
  assert.deepEqual(s.calls, [['waiting', ESTATE]])
  const down = standIn({ waiting: async () => ({ ok: false, error: { code: 'unavailable', message: 'the board did not answer' } }) })
  assert.deepEqual(await createCommsDoors(down.deps).waiting(), { ok: false, error: { code: 'unavailable', message: 'the board did not answer' } })
})

test('one project\'s requests are read from the serving process\'s store; a project that is no id and a failed read reject', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  const view = await doors.projectRequests(P1)
  assert.deepEqual([view.requests, view.capped], [[], false])
  assert.ok(s.selects.length >= 2 && s.selects.every((c) => c.table === 'journal'))
  assert.ok(s.selects.some((c) => c.eq.some(([col, v]) => col === 'payload->>sender_project_id' && v === P1)))
  await assert.rejects(doors.projectRequests('not-a-project'), /Invalid project identity/)
  const broken = createCommsDoors({ ...s.deps, store: () => s.store('db down') })
  await assert.rejects(broken.projectRequests(P1), /could not be read: db down/)
})

test('an artifact\'s link goes to the read, which alone decides what opens', async () => {
  const s = standIn()
  const doors = createCommsDoors(s.deps)
  assert.deepEqual(await doors.openArtifact('https://example.com/a'), { ok: true })
  assert.deepEqual(await doors.openArtifact('file:///etc/passwd'), { ok: false, reason: 'refused' })
  assert.deepEqual(s.calls, [['openArtifact', 'https://example.com/a'], ['openArtifact', 'file:///etc/passwd']])
})

test('the same doors through the board\'s operator door: positional arguments in, the door\'s answer out', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-comms-doors-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const s = standIn()
  const door = await startOperatorDoor({ root: dir, peerAccount: async () => 'own', doors: commsDoorTable(createCommsDoors(s.deps)) })
  t.after(() => door.stop())
  assert.deepEqual(await callOperatorDoor(dir, 'comms.threads', []), { ok: true, value: { ok: true, door: 'threads' } })
  assert.deepEqual(await callOperatorDoor(dir, 'comms.list', ['th-1', 5, 25]), { ok: true, value: { ok: true, door: 'list' } })
  assert.deepEqual(await callOperatorDoor(dir, 'comms.threadPage', [{ kind: 'request', openOnly: true }, null]), { ok: true, value: { ok: true, door: 'threadPage' } })
  assert.deepEqual(await callOperatorDoor(dir, 'comms.search', ['board', null]), { ok: true, value: { ok: true, door: 'search' } })
  assert.deepEqual(await callOperatorDoor(dir, 'comms.waiting', []), { ok: true, value: { ok: true, requests: 0, list: [], listComplete: true } })
  assert.deepEqual(await callOperatorDoor(dir, 'comms.openArtifact', ['javascript:alert(1)']), { ok: true, value: { ok: false, reason: 'refused' } })
  const requests = await callOperatorDoor(dir, 'comms.projectRequests', [P1])
  assert.equal(requests.ok, true)
  assert.deepEqual(requests.value.requests, [])
  assert.deepEqual(s.calls, [
    ['threads', ESTATE], ['list', ESTATE, 'th-1', 5, 25], ['threadPage', ESTATE, { kind: 'request', openOnly: true }, null, 50],
    ['search', ESTATE, 'board', null], ['waiting', ESTATE], ['openArtifact', 'javascript:alert(1)']
  ])
  // A read that rejects is the door's failure answer, never an empty list.
  const refusedProject = await callOperatorDoor(dir, 'comms.projectRequests', ['nope'])
  assert.equal(refusedProject.ok, false)
  // Arguments that are not a list never reach a door.
  const before = s.calls.length
  const refused = await callOperatorDoor(dir, 'comms.facts', { messages: ['m-1'] })
  assert.equal(refused.ok, false)
  assert.equal(s.calls.length, before)
})
// #endregion comms-doors-test
