// An unattended start does not run on a pack whose memory could not be read (S14 · release review 2026-10-03).
//
// `ContextPackInput.mandatory` was declared, documented as "what the caller
// checks before admitting the work", and read by nothing — no caller passed it
// and the compiler never looked at it. A routine or chain step whose facts read
// was refused started anyway, on a pack that said in its head that the memory
// could not be read, with nobody present to read the head.
//
// The FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
// (R-007). Pure: no database, no network.
import assert from 'node:assert/strict'
import { compileContextPack, contextDemandFor, MandatoryContextUnmet, UNATTENDED_CONTEXT_SOURCES } from '../src/main/contextPack.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'

function fakeDb(answers) {
  return {
    from: (table) => ({
      select: () => {
        const answer = () => (typeof answers[table] === 'function' ? answers[table]() : answers[table]) ?? { data: [], error: null }
        const q = {
          eq: () => q, is: () => q, order: () => q, limit: () => q, in: () => q,
          maybeSingle: () => Promise.resolve(answer()),
          then: (resolve) => Promise.resolve(answer()).then(resolve)
        }
        return q
      }
    })
  }
}
const store = (answers) => createScopedStore(fakeDb(answers), { kind: 'estate', estateId: 'e1' })
const healthy = {
  projects: { data: { name: 'Atlas', purpose: null }, error: null },
  project_repos: { data: [], error: null },
  memory_facts: { data: [], error: null },
  session_transcripts: { data: [], error: null }
}
const factsRefused = { ...healthy, memory_facts: { data: null, error: { message: 'permission denied for table memory_facts' } } }

let failures = 0
const test = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')) }
}

await test('an unattended start whose facts could not be read gets no pack', async () => {
  await assert.rejects(
    compileContextPack({ store: store(factsRefused), projectId: 'p1', mandatory: UNATTENDED_CONTEXT_SOURCES }),
    (e) => e instanceof MandatoryContextUnmet && e.unmet.join() === 'facts',
    'the pack was compiled anyway — `mandatory` is read by nothing'
  )
})

await test('a person\'s terminal still gets the degraded pack, which says what it could not read', async () => {
  const pack = await compileContextPack({ store: store(factsRefused), projectId: 'p1' })
  assert.match(pack.markdown, /could not be read/)
  assert.equal(pack.read.availability !== 'complete', true)
})

await test('an unattended start with every required source answered compiles as before', async () => {
  const pack = await compileContextPack({ store: store(healthy), projectId: 'p1', mandatory: UNATTENDED_CONTEXT_SOURCES })
  assert.match(pack.markdown, /Atlas/)
})

await test('what a session must carry is decided by how it was ADMITTED', async () => {
  const admitted = (trigger) => store({ journal: { data: [{ payload: { trigger, session_id: 's' } }], error: null } })
  assert.deepEqual([...(await contextDemandFor(admitted('chain'), 's'))], [...UNATTENDED_CONTEXT_SOURCES])
  assert.deepEqual([...(await contextDemandFor(admitted('routine'), 's'))], [...UNATTENDED_CONTEXT_SOURCES])
  assert.deepEqual([...(await contextDemandFor(admitted('operator'), 's'))], [])
  assert.deepEqual([...(await contextDemandFor(store({ journal: { data: [], error: null } }), 's'))], [], 'a terminal with no admission is a person\'s')
  assert.deepEqual([...(await contextDemandFor(store({ journal: { data: null, error: { message: 'down' } } }), 's'))],
    [...UNATTENDED_CONTEXT_SOURCES], 'an unread admission was taken as proof a person is present')
})

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1) }
console.log('\nall green: an unattended start runs on its required context or not at all')
