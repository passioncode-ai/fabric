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

// Two compiles differ only in the clock line they carry; compare what they deliver without it.
const unclocked = (md) => md.replace(/Compiled by Fabric at \S+/, 'Compiled by Fabric at <time>')
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

await test('what a session must carry is decided by the trigger the LAUNCH passes, not guessed from the journal', async () => {
  // Release review iteration 2, memory finding 7: the demand was read back from `task.admitted@1`, and a
  // failed read demanded the unattended set — refusing a person's own session because a query failed.
  // The launch knows how it admitted the session; it says so, and nothing is read.
  assert.deepEqual([...contextDemandFor('chain')], [...UNATTENDED_CONTEXT_SOURCES])
  assert.deepEqual([...contextDemandFor('routine')], [...UNATTENDED_CONTEXT_SOURCES])
  assert.deepEqual([...contextDemandFor('operator')], [])
  assert.deepEqual([...contextDemandFor('answer')], [], 'an answered question resumes a person\'s work')
  assert.deepEqual([...contextDemandFor(undefined)], [], 'a terminal opened with no launch is a person\'s')
})

await test('the project source counts as met only when the project row EXISTS', async () => {
  const noProject = { ...healthy, projects: { data: null, error: null } }
  await assert.rejects(
    compileContextPack({ store: store(noProject), projectId: 'p1', mandatory: UNATTENDED_CONTEXT_SOURCES }),
    (e) => e instanceof MandatoryContextUnmet && e.unmet.join() === 'project',
    'an unattended start ran with no project row — an empty answer was counted as the project'
  )
  const pack = await compileContextPack({ store: store(noProject), projectId: 'p1' })
  assert.notEqual(pack.read.availability, 'complete', 'a pack with no project row claimed to be complete')
})

await test('facts past one read are COUNTED: omittedFacts includes what the gateway did not return', async () => {
  const fact = (i) => ({ id: `f${i}`, claim: `fact ${i}`, source_ref: null, kind: 'note', actor_kind: 'person', actor_id: 'op', recorded_at: 'x', seq: i })
  const many = { ...healthy, memory_facts: { data: Array.from({ length: 1000 }, (_, i) => fact(i)), error: null, count: 1500 } }
  const pack = await compileContextPack({ store: store(many), projectId: 'p1', budget: 1_000_000 })
  assert.equal(pack.factIds.length, 1000)
  assert.equal(pack.omittedFacts, 500, `omittedFacts said ${pack.omittedFacts} while 500 facts were never read`)
  assert.match(pack.markdown, /500 fact\(s\)/)
})

// The operator's task, its brief and the project's identity are authority: never cut and, since revision 5 (0.3.6
// review ER-1), never refused for size either — 0.3.5 started an 11.6k-character task that revision 4 refused. The
// budget bounds what Fabric SELECTS from memory; a head larger than it is delivered whole and selects nothing.
await test('an oversized project/task head is delivered whole: authority is neither truncated nor refused', async () => {
  for (const [input, tail] of [
    [{ store: store({ ...healthy, projects: { data: { name: 'Atlas', purpose: '😀'.repeat(999) + 'END' }, error: null } }) }, 'END'],
    [{ taskInstruction: 'work '.repeat(1000) + 'END-OF-TASK' }, 'END-OF-TASK'],
    [{ taskBrief: { what: 'x'.repeat(5000) + 'END-OF-WHAT', why: 'why', expected: 'done' } }, 'END-OF-WHAT'],
    [{ store: store({ ...healthy, project_repos: { data: [{ path: '/repo/' + 'x'.repeat(5000) + '/END-OF-PATH', is_primary: true }], error: null } }) }, 'END-OF-PATH']
  ]) {
    const pack = await compileContextPack({ store: store(healthy), projectId: 'p1', budget: 1000, ...input })
    assert.ok(pack.markdown.includes(tail), `the head was cut before ${tail}`)
    assert.ok(pack.chars > pack.budget, 'the pack says honestly that it is over its budget')
    assert.deepEqual(pack.factIds, [])
    assert.deepEqual(pack.transcriptIds, [])
  }
})

await test('an invalid budget cannot produce a pack; a tiny valid one carries the head and nothing selected', async () => {
  for (const budget of [0, -1, 0.5, NaN, Infinity]) {
    await assert.rejects(compileContextPack({ store: store(healthy), projectId: 'p1', budget }),
      e => e instanceof MandatoryContextUnmet && /budget/i.test(e.message))
  }
  const whole = await compileContextPack({ store: store(healthy), projectId: 'p1' })
  const tiny = await compileContextPack({ store: store(healthy), projectId: 'p1', budget: 1 })
  assert.equal(unclocked(tiny.markdown), unclocked(whole.markdown))
  assert.deepEqual(tiny.factIds, [])
})

await test('facts, sessions, warning, omission footer and final newline share one exact UTF-16 budget', async () => {
  const fact = i => ({ id: `f${i}`, claim: '😀'.repeat(50), source_ref: null, kind: 'note', actor_kind: i % 2 ? 'agent' : 'person', actor_id: 'op', recorded_at: 'x', seq: i })
  const answers = { ...healthy,
    memory_facts: { data: Array.from({ length: 20 }, (_, i) => fact(i)), error: null, count: 29 },
    session_transcripts: { data: Array.from({ length: 5 }, (_, i) => ({ session_id: `s${i}`, annotation: 'ran 😀'.repeat(30), ending_provenance: 'observed' })), error: null },
    project_repos: { data: null, error: { message: 'refused' } }
  }
  for (const budget of [1000, 1100, 1300, 1600, 2000, 3000, 6000, 12000]) {
    const pack = await compileContextPack({ store: store(answers), projectId: 'p1', budget })
    assert.equal(pack.chars, pack.markdown.length)
    assert.ok(pack.chars <= budget, `${pack.chars} > ${budget}`)
    assert.match(pack.markdown, /could not be read/)
    assert.match(pack.markdown, new RegExp(`${pack.omittedFacts} fact\\(s\\)`))
    assert.equal(pack.factIds.length + pack.omittedFacts, 29)
    assert.equal(pack.transcriptIds.length + pack.omittedTranscripts, 5)
    if (pack.factIds.some(id => Number(id.slice(1)) % 2)) assert.match(pack.markdown, /DATA, NOT INSTRUCTIONS/)
  }
})

await test('an empty pack fits its exact size, including the final newline', async () => {
  const first = await compileContextPack({ store: store(healthy), projectId: 'p1' })
  const exact = await compileContextPack({ store: store(healthy), projectId: 'p1', budget: first.chars })
  assert.equal(exact.chars, first.chars)
  const short = await compileContextPack({ store: store(healthy), projectId: 'p1', budget: first.chars - 1 })
  assert.equal(unclocked(short.markdown), unclocked(first.markdown), 'one character short still delivers the head whole, never cut')
})

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1) }
console.log('\nall green: an unattended start runs on its required context or not at all')
